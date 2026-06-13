import { cmd, feed, lineWidth, moneyLine, text, wrapLine } from "@/lib/escpos";
import { customizationParts } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { restaurant } from "@/lib/restaurant";

export type PrintOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_notes?: string | null;
  pickup_time_type?: string | null;
  scheduled_pickup_time?: string | null;
  estimated_ready_at?: string | null;
  created_at?: string | null;
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

function pickupText(order: PrintOrder) {
  return isScheduled(order) ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
}

function isScheduled(order: PrintOrder) {
  return Boolean(order.scheduled_pickup_time) && (!order.pickup_time_type || order.pickup_time_type === "scheduled");
}

function isTestOrder(order: PrintOrder) {
  return order.order_number.toUpperCase().startsWith("TEST");
}

// Customization lines for one item. Reuses the shared customizationParts logic but drops the
// default "Size: order" (a plain a-la-carte order with no real size choice) so unmodified items
// don't print a noisy, meaningless modifiers section.
function ticketModifiers(customization?: Record<string, unknown> | null) {
  return customizationParts(customization ?? {}).filter((part) => part.trim().toLowerCase() !== "size: order");
}

// Kitchen / pickup ticket for 80mm thermal paper. Mirrors the updated AirPrint layout:
// restaurant name + phone header, a modest (not huge) order number, name/phone/pickup,
// the order placed time, order notes, then each item with its modifiers and special notes.
export function escposTicket(order: PrintOrder) {
  const divider = "-".repeat(lineWidth);
  const doubleDivider = "=".repeat(lineWidth);
  const chunks: Buffer[] = [cmd.init];
  const line = (value: string) => chunks.push(Buffer.from(`${value}\n`, "ascii"));
  const wrapped = (value: string, indent = 0) => {
    const pad = " ".repeat(indent);
    for (const part of wrapLine(value, lineWidth - indent)) line(`${pad}${part}`);
  };

  // Header: hardware-centered so the title stays centered at any font size.
  chunks.push(cmd.alignCenter, cmd.boldOn, cmd.sizeLarge);
  line("CHINA DELIGHT");
  chunks.push(cmd.sizeNormal);
  line(text(restaurant.phone));
  line("Kitchen / Pickup Ticket");
  if (isTestOrder(order)) {
    chunks.push(cmd.sizeTall);
    line("*** TEST ORDER ***");
    chunks.push(cmd.sizeNormal);
  }
  chunks.push(cmd.boldOff);
  line(divider);

  // Order number: modest size (double height only), not the full double-width banner.
  chunks.push(cmd.boldOn, cmd.sizeTall);
  line(`Order #${text(order.order_number)}`);
  chunks.push(cmd.sizeNormal, cmd.boldOff);
  line(doubleDivider);

  // Customer info, left aligned. Name/phone are enlarged for quick reads.
  chunks.push(cmd.alignLeft, cmd.boldOn, cmd.sizeTall);
  line(`NAME: ${text(order.customer_name)}`);
  line(`PHONE: ${text(order.customer_phone)}`);
  chunks.push(cmd.sizeNormal);
  chunks.push(cmd.boldOff);
  if (isScheduled(order)) {
    line(doubleDivider);
    chunks.push(cmd.alignCenter, cmd.boldOn, cmd.sizeTall);
    line("SCHEDULED PICKUP:");
    wrapped(text(pickupText(order)).toUpperCase());
    chunks.push(cmd.sizeNormal, cmd.boldOff, cmd.alignLeft);
    line(doubleDivider);
  } else {
    chunks.push(cmd.boldOn);
    line(`PICKUP: ${text(pickupText(order))}`);
    chunks.push(cmd.boldOff);
  }
  if (order.created_at) line(`ORDERED: ${text(formatPickupDateTime(order.created_at))}`);
  if (!isScheduled(order) && order.estimated_ready_at) line(`READY: ${text(formatPickupDateTime(order.estimated_ready_at))}`);

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
