import net from "node:net";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { customizationParts } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const printerHost = "192.168.1.172";
const printerPort = 9100;
const lineWidth = 42;
const execFileAsync = promisify(execFile);
const windowsPrinterNames = ["receipt", "bar", "packer", "sushi"] as const;
const windowsPrinterTargets = new Set<string>(windowsPrinterNames);

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

type PrinterTarget = "epson_tcp" | typeof windowsPrinterNames[number];

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

function plainTextTicket(order: PrintOrder) {
  return `${ticketLines(order).join("\r\n")}\r\n\r\n\r\n`;
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

async function sendToWindowsPrinter(order: PrintOrder, printerName: string) {
  if (!windowsPrinterTargets.has(printerName)) {
    throw new Error(`Unsupported Windows printer "${printerName}".`);
  }

  const ticketPath = path.join(os.tmpdir(), `china-delight-ticket-${order.order_number}-${Date.now()}.txt`);
  await fs.writeFile(ticketPath, plainTextTicket(order), "utf8");

  const script = `
$ticketPath = $args[0]
$printerName = $args[1]
$printers = [System.Drawing.Printing.PrinterSettings]::InstalledPrinters
$matchedPrinter = $null
foreach ($printer in $printers) {
  if ($printer -ieq $printerName) {
    $matchedPrinter = $printer
    break
  }
}
if (-not $matchedPrinter) {
  throw "Windows printer '$printerName' is not installed. Installed printers: $($printers -join ', ')"
}
Add-Type -AssemblyName System.Drawing
$content = Get-Content -LiteralPath $ticketPath -Raw
$font = New-Object System.Drawing.Font("Consolas", 9)
$brush = [System.Drawing.Brushes]::Black
$printDoc = New-Object System.Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = $matchedPrinter
$printDoc.DocumentName = "China Delight Kitchen Ticket"
$printDoc.add_PrintPage({
  param($sender, $eventArgs)
  $eventArgs.Graphics.DrawString($content, $font, $brush, 0, 0)
})
$printDoc.Print()
`;

  try {
    await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script, ticketPath, printerName], { timeout: 15000 });
  } finally {
    await fs.unlink(ticketPath).catch(() => undefined);
  }
}

function normalizePrinterTarget(value: unknown): PrinterTarget {
  const target = typeof value === "string" ? value.trim() : "";
  if (target === "epson_tcp" || windowsPrinterTargets.has(target)) return target as PrinterTarget;
  return "epson_tcp";
}

export async function POST(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { orderNumber?: string; printerTarget?: string };
  const orderNumber = body.orderNumber?.trim();
  const printerTarget = normalizePrinterTarget(body.printerTarget);
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
    if (printerTarget === "epson_tcp") {
      await sendToPrinter(escposTicket(order as PrintOrder));
      return NextResponse.json({ ok: true, printerTarget, printerLabel: `Epson TCP ${printerHost}:${printerPort}` });
    }

    await sendToWindowsPrinter(order as PrintOrder, printerTarget);
    return NextResponse.json({ ok: true, printerTarget, printerLabel: `Windows printer: ${printerTarget}` });
  } catch (error) {
    console.error("[print-ticket] Kitchen print failed", {
      orderNumber,
      printerTarget,
      ...(printerTarget === "epson_tcp" ? { host: printerHost, port: printerPort } : { windowsPrinter: printerTarget }),
      message: error instanceof Error ? error.message : "Unknown printer error"
    });
    return NextResponse.json(
      {
        error:
          printerTarget === "epson_tcp"
            ? error instanceof Error
              ? `Epson TCP ${printerHost}:${printerPort} failed: ${error.message}`
              : `Epson TCP ${printerHost}:${printerPort} failed with an unknown error.`
            : error instanceof Error
              ? error.message
              : "Windows printer did not respond."
      },
      { status: 502 }
    );
  }
}
