import net from "node:net";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { customizationParts } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local Epson TM-m30 / M335A receipt printer on the restaurant network.
// ESC/POS over a raw TCP socket (port 9100). Override with PRINTER_IP / PRINTER_PORT.
const printerHost = process.env.PRINTER_IP?.trim() || "192.168.1.172";
const printerPort = Number(process.env.PRINTER_PORT) || 9100;
// 80mm thermal paper fits 48 Font-A columns; use the full width so the ticket
// fills the paper instead of leaving a wide blank margin on the right.
const lineWidth = 48;

type PrintOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_notes?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  pickup_time_type?: string | null;
  scheduled_pickup_time?: string | null;
  estimated_ready_at?: string | null;
  status: string;
  subtotal: number;
  tax: number;
  processing_fee?: number | null;
  tip_amount?: number | null;
  promo_code?: string | null;
  discount_amount?: number | null;
  total: number;
  order_items: Array<{
    item_number?: string | null;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown> | null;
  }>;
};

function text(value: unknown) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E\n]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapLine(value: string, width = lineWidth) {
  const words = text(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function moneyLine(label: string, value: number) {
  const left = text(label);
  const right = formatPrice(value);
  return `${left}${" ".repeat(Math.max(1, lineWidth - left.length - right.length))}${right}`;
}

function paymentBanner(order: PrintOrder) {
  return order.payment_method === "stripe" && order.payment_status === "paid" ? "PAID ONLINE" : "PAY AT PICKUP";
}

function pickupText(order: PrintOrder) {
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
}

// Customization lines for one item. Reuses the shared customizationParts logic
// but drops the default "Size: order" (a plain a-la-carte order with no real size
// choice) so unmodified items don't print a noisy, meaningless modifiers section.
function ticketModifiers(customization?: Record<string, unknown> | null) {
  return customizationParts(customization ?? {}).filter((part) => part.trim().toLowerCase() !== "size: order");
}

// ESC/POS control sequences. Character size is GS ! n where the high nibble is the
// width multiplier and the low nibble the height multiplier (0 = 1x, 1 = 2x).
const ESC = 0x1b;
const GS = 0x1d;
const cmd = {
  init: Buffer.from([ESC, 0x40]),
  alignLeft: Buffer.from([ESC, 0x61, 0x00]),
  alignCenter: Buffer.from([ESC, 0x61, 0x01]),
  boldOn: Buffer.from([ESC, 0x45, 0x01]),
  boldOff: Buffer.from([ESC, 0x45, 0x00]),
  sizeNormal: Buffer.from([GS, 0x21, 0x00]),
  sizeTall: Buffer.from([GS, 0x21, 0x01]), // Double height (same width, so 48 cols still fit).
  sizeLarge: Buffer.from([GS, 0x21, 0x11]), // Double height + double width.
  cut: Buffer.from([GS, 0x56, 0x42, 0x00]) // Partial cut.
};

function feed(lines: number) {
  return Buffer.from([ESC, 0x64, Math.max(0, lines)]); // ESC d n: print and feed n lines.
}

function escposTicket(order: PrintOrder) {
  const divider = "-".repeat(lineWidth);
  const doubleDivider = "=".repeat(lineWidth);
  const chunks: Buffer[] = [cmd.init];
  const line = (value: string) => chunks.push(Buffer.from(`${value}\n`, "ascii"));
  const wrapped = (value: string, indent = 0) => {
    const pad = " ".repeat(indent);
    for (const part of wrapLine(value, lineWidth - indent)) line(`${pad}${part}`);
  };

  // Header: hardware-centered so the big title stays centered at any font size.
  chunks.push(cmd.alignCenter, cmd.boldOn, cmd.sizeLarge);
  line("CHINA DELIGHT");
  chunks.push(cmd.sizeNormal);
  line("Kitchen / Pickup Ticket");
  chunks.push(cmd.boldOff);
  line(doubleDivider);
  chunks.push(cmd.boldOn, cmd.sizeLarge);
  line(`#${text(order.order_number)}`);
  chunks.push(cmd.sizeTall);
  line(paymentBanner(order));
  chunks.push(cmd.sizeNormal, cmd.boldOff);
  line(doubleDivider);

  // Customer info, left aligned. Name/phone/pickup are enlarged for quick reads.
  chunks.push(cmd.alignLeft, cmd.boldOn, cmd.sizeTall);
  line(`NAME: ${text(order.customer_name)}`);
  line(`PHONE: ${text(order.customer_phone)}`);
  line(`PICKUP: ${text(pickupText(order))}`);
  chunks.push(cmd.sizeNormal);
  if (order.estimated_ready_at) line(`READY: ${text(formatPickupDateTime(order.estimated_ready_at))}`);
  chunks.push(cmd.boldOff);
  line(`PAYMENT: ${paymentBanner(order)}`);
  line(`STATUS: ${text(order.status).toUpperCase()}`);

  if (order.customer_notes) {
    line(divider);
    chunks.push(cmd.boldOn);
    line("ORDER NOTES:");
    wrapped(text(order.customer_notes).toUpperCase());
    chunks.push(cmd.boldOff);
  }
  line(doubleDivider);

  // Items: each name printed large and bold; modifiers/notes only when present.
  for (const item of order.order_items ?? []) {
    const itemTitle = `${item.quantity} x ${item.item_number ? `#${item.item_number} ` : ""}${item.item_name}`;
    chunks.push(cmd.boldOn, cmd.sizeTall);
    wrapped(itemTitle.toUpperCase());
    chunks.push(cmd.sizeNormal, cmd.boldOff);
    line(`   ${formatPrice(Number(item.unit_price || 0))} each`);
    for (const part of ticketModifiers(item.customization)) {
      wrapped(`- ${part.toUpperCase()}`, 3);
    }
    const notes = item.customization?.notes;
    if (notes) {
      chunks.push(cmd.boldOn);
      wrapped(`* SPECIAL: ${String(notes).toUpperCase()}`, 3);
      chunks.push(cmd.boldOff);
    }
    line(divider);
  }

  // Totals: full-width money lines; grand total enlarged.
  line(moneyLine("Subtotal", Number(order.subtotal || 0)));
  if (Number(order.discount_amount ?? 0) > 0) {
    line(moneyLine(`Promo${order.promo_code ? ` ${order.promo_code}` : ""}`, -Number(order.discount_amount ?? 0)));
  }
  line(moneyLine("Tax", Number(order.tax || 0)));
  line(moneyLine("Processing fee", Number(order.processing_fee ?? 0)));
  line(moneyLine("Tip", Number(order.tip_amount ?? 0)));
  line(doubleDivider);
  chunks.push(cmd.boldOn, cmd.sizeTall);
  line(moneyLine("TOTAL", Number(order.total || 0)));
  chunks.push(cmd.sizeNormal, cmd.boldOff);

  chunks.push(feed(4), cmd.cut);
  return Buffer.concat(chunks);
}

function sendToPrinter(payload: Buffer) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host: printerHost, port: printerPort });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Printer connection timed out."));
    }, 6000);

    socket.once("connect", () => {
      socket.write(payload, (error) => {
        if (error) {
          clearTimeout(timeout);
          socket.destroy();
          reject(error);
          return;
        }
        socket.end();
      });
    });
    socket.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function POST(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { orderNumber?: string };
  const orderNumber = body.orderNumber?.trim();
  if (!orderNumber) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_number", orderNumber)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found." }, { status: 404 });
  }

  try {
    await sendToPrinter(escposTicket(order as PrintOrder));
    return NextResponse.json({ ok: true, printerLabel: `Epson TCP ${printerHost}:${printerPort}` });
  } catch (printError) {
    const message = printError instanceof Error ? printError.message : "Unknown printer error";
    console.error("[print-ticket] Kitchen print failed", { orderNumber, host: printerHost, port: printerPort, message });
    return NextResponse.json({ error: `Epson TCP ${printerHost}:${printerPort} failed: ${message}` }, { status: 502 });
  }
}
