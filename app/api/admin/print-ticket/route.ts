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
const lineWidth = 42;

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

function center(value: string) {
  const clean = text(value).slice(0, lineWidth);
  const left = Math.max(0, Math.floor((lineWidth - clean.length) / 2));
  return `${" ".repeat(left)}${clean}`;
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

function ticketLines(order: PrintOrder) {
  const lines: string[] = [];
  const divider = "-".repeat(lineWidth);
  const doubleDivider = "=".repeat(lineWidth);

  lines.push(center("CHINA DELIGHT"));
  lines.push(center("KITCHEN / PICKUP TICKET"));
  lines.push(doubleDivider);
  lines.push(center(`#${order.order_number}`));
  lines.push(center(paymentBanner(order)));
  lines.push(doubleDivider);
  lines.push(`NAME: ${text(order.customer_name)}`);
  lines.push(`PHONE: ${text(order.customer_phone)}`);
  lines.push(`PICKUP: ${text(pickupText(order))}`);
  if (order.estimated_ready_at) lines.push(`READY: ${text(formatPickupDateTime(order.estimated_ready_at))}`);
  lines.push(`PAYMENT: ${paymentBanner(order)}`);
  lines.push(`STATUS: ${text(order.status).toUpperCase()}`);
  if (order.customer_notes) {
    lines.push(divider);
    lines.push("ORDER NOTES:");
    lines.push(...wrapLine(order.customer_notes.toUpperCase()));
  }
  lines.push(doubleDivider);

  for (const item of order.order_items ?? []) {
    const itemTitle = `${item.quantity} x ${item.item_number ? `#${item.item_number} ` : ""}${item.item_name}`;
    lines.push(...wrapLine(itemTitle.toUpperCase()));
    lines.push(`  ${formatPrice(Number(item.unit_price || 0))} each`);
    const modifiers = customizationParts(item.customization ?? {});
    if (modifiers.length) {
      lines.push("  MODIFIERS:");
      for (const part of modifiers) {
        lines.push(...wrapLine(`    - ${part}`));
      }
    }
    const notes = item.customization?.notes;
    if (notes) {
      lines.push("  SPECIAL NOTES:");
      lines.push(...wrapLine(`    ${String(notes).toUpperCase()}`));
    }
    lines.push(divider);
  }

  lines.push(moneyLine("Subtotal", Number(order.subtotal || 0)));
  if (Number(order.discount_amount ?? 0) > 0) {
    lines.push(moneyLine(`Promo${order.promo_code ? ` ${order.promo_code}` : ""}`, -Number(order.discount_amount ?? 0)));
  }
  lines.push(moneyLine("Tax", Number(order.tax || 0)));
  lines.push(moneyLine("Processing fee", Number(order.processing_fee ?? 0)));
  lines.push(moneyLine("Tip", Number(order.tip_amount ?? 0)));
  lines.push(doubleDivider);
  lines.push(moneyLine("TOTAL", Number(order.total || 0)));

  return lines;
}

function escposTicket(order: PrintOrder) {
  const bodyLines = ticketLines(order).slice(6);

  return Buffer.concat([
    Buffer.from([0x1b, 0x40]), // Initialize printer.
    Buffer.from([0x1b, 0x61, 0x01]), // Center.
    Buffer.from([0x1b, 0x45, 0x01]), // Bold on.
    Buffer.from(`${center("CHINA DELIGHT")}\n`, "ascii"),
    Buffer.from("KITCHEN / PICKUP TICKET\n", "ascii"),
    Buffer.from([0x1d, 0x21, 0x11]), // Double width + double height.
    Buffer.from(`#${text(order.order_number)}\n`, "ascii"),
    Buffer.from([0x1d, 0x21, 0x00]), // Normal size.
    Buffer.from(`${paymentBanner(order)}\n`, "ascii"),
    Buffer.from([0x1b, 0x45, 0x00]), // Bold off.
    Buffer.from([0x1b, 0x61, 0x00]), // Left.
    Buffer.from(bodyLines.join("\n"), "ascii"),
    Buffer.from([0x0a, 0x0a, 0x0a]),
    Buffer.from([0x1d, 0x56, 0x42, 0x00]) // Partial cut.
  ]);
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
