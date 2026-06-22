import { menuItems } from "@/data/menu";
import { cmd, feed, lineWidth, moneyLine, text, wrapLine } from "@/lib/escpos";
import { formatPickupDateTime } from "@/lib/order-rules";
import { restaurant } from "@/lib/restaurant";

// Tax/processing-fee percentages shown on the ticket, e.g. "7.35" and "6" (matches AirPrint).
const taxPercent = Number((restaurant.taxRate * 100).toFixed(2));
const processingFeePercent = Number((restaurant.processingFeeRate * 100).toFixed(2));

// Menu lookup so the ticket can hide a spice level the customer never changed. The customer order
// form defaults spice to "Hot" for spicy menu items and "None" for everything else
// (see components/menu/menu-item-card.tsx); a stored value equal to that default was not customized.
const menuById = new Map(menuItems.map((item) => [item.id, item]));

function defaultSpiceLevel(menuItemId?: string | null): string {
  const menuItem = menuItemId ? menuById.get(menuItemId) : undefined;
  return menuItem?.spicy ? "Hot" : "None";
}

export type PrintOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_notes?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
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
    menu_item_id?: string | null;
    item_number?: string | null;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown> | null;
  }>;
};

type OrderItem = PrintOrder["order_items"][number];

// Split an item's customization into "info" (size / combo includes / lunch picks — printed plainly)
// and "custom" (anything the customer changed — printed in a very obvious CUSTOMER CHANGED block).
// Default spice that was never changed is omitted entirely.
function classifyItem(item: OrderItem): { customLines: string[]; infoLines: string[]; notes: string; freeOffer: boolean } {
  const c = (item.customization ?? {}) as Record<string, unknown>;
  const customLines: string[] = [];
  const infoLines: string[] = [];

  const freeOffer = Boolean(c.specialOffer);

  const size = typeof c.size === "string" ? c.size : "";
  if (size && size.trim().toLowerCase() !== "order") infoLines.push(`Size: ${size}`);

  const included = Array.isArray(c.includedItems) ? c.includedItems : [];
  if (included.length) infoLines.push(`Includes: ${included.join(", ")}`);

  if (typeof c.lunchRice === "string" && c.lunchRice) infoLines.push(`Lunch rice: ${c.lunchRice}`);
  if (typeof c.lunchSide === "string" && c.lunchSide) infoLines.push(`Lunch side: ${c.lunchSide}`);

  if (typeof c.rice === "string" && c.rice) customLines.push(`Rice: ${c.rice}`);

  // Spice: only when the customer changed it from the menu item's default.
  if (typeof c.spiceLevel === "string" && c.spiceLevel.trim()) {
    const chosen = c.spiceLevel.trim();
    if (chosen.toLowerCase() !== defaultSpiceLevel(item.menu_item_id).toLowerCase()) {
      customLines.push(`Spice: ${chosen}`);
    }
  }

  if (c.sauceOnSide) customLines.push("Sauce on side");
  if (c.noOnion) customLines.push("No onion");
  if (c.noBroccoli) customLines.push("No broccoli");

  const addOns = Array.isArray(c.addOns) ? c.addOns : [];
  if (addOns.length) customLines.push(`Add-ons: ${addOns.join(", ")}`);

  const extraAmount = Number((c as { extraChargeAmount?: unknown }).extraChargeAmount ?? 0);
  const extraLabel = typeof c.extraChargeLabel === "string" ? c.extraChargeLabel : "";
  if (extraLabel || extraAmount > 0) customLines.push(`${extraLabel || "Extra charge"} (+$${extraAmount.toFixed(2)})`);

  const notes = typeof c.notes === "string" ? c.notes.trim() : "";

  return { customLines, infoLines, notes, freeOffer };
}

function pickupText(order: PrintOrder) {
  return isScheduled(order) ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
}

function isScheduled(order: PrintOrder) {
  return Boolean(order.scheduled_pickup_time) && (!order.pickup_time_type || order.pickup_time_type === "scheduled");
}

function isTestOrder(order: PrintOrder) {
  return order.order_number.toUpperCase().startsWith("TEST");
}

function paymentText(order: PrintOrder) {
  if (order.payment_method === "stripe") {
    return `PAID ONLINE${order.payment_status ? ` / ${String(order.payment_status).toUpperCase()}` : ""}`;
  }
  return "PAY AT PICKUP";
}

// Kitchen / pickup ticket for 80mm thermal paper. Mirrors the AirPrint ticket
// (components/orders/print-ticket.tsx) as closely as ESC/POS allows: name+phone+address header,
// centered order number, a prominent pickup block right after it (BIG scheduled-pickup warning when
// scheduled, otherwise a clear ASAP block — never both), customer name/phone, ordered/ready time,
// order notes, items with modifiers/special instructions + line price, then totals with tax/fee %.
export function escposTicket(order: PrintOrder) {
  const divider = "-".repeat(lineWidth);
  const doubleDivider = "=".repeat(lineWidth);
  const chunks: Buffer[] = [cmd.init, cmd.fontA, cmd.alignLeft, cmd.sizeNormal, cmd.boldOff];
  const line = (value: string) => chunks.push(Buffer.from(`${value}\n`, "ascii"));
  const wrapped = (value: string, indent = 0) => {
    const pad = " ".repeat(indent);
    for (const part of wrapLine(value, lineWidth - indent)) line(`${pad}${part}`);
  };

  // Header: restaurant name + phone + address, centered.
  chunks.push(cmd.alignCenter, cmd.boldOn);
  line("CHINA DELIGHT");
  chunks.push(cmd.boldOff);
  line(text(restaurant.phone));
  line(text(restaurant.address));
  line("KITCHEN TICKET");
  if (isTestOrder(order)) {
    chunks.push(cmd.boldOn, cmd.sizeTall);
    line("*** TEST ORDER ***");
    chunks.push(cmd.sizeNormal, cmd.boldOff);
  }
  chunks.push(cmd.alignLeft);
  line(divider);

  // Order number: centered, double height (matches the AirPrint "#order" line).
  chunks.push(cmd.alignCenter, cmd.boldOn, cmd.sizeLarge);
  line(`#${text(order.order_number)}`);
  chunks.push(cmd.sizeNormal, cmd.boldOff, cmd.alignLeft);
  line(divider);

  // Pickup block right after the order number (like AirPrint). Scheduled = BIG warning; otherwise a
  // clear ASAP block. Never show both, and no conflicting ready/ASAP line when scheduled.
  if (isScheduled(order)) {
    chunks.push(cmd.boldOn);
    line("PICKUP: SCHEDULED");
    wrapped(text(pickupText(order)).toUpperCase(), 2);
    chunks.push(cmd.boldOff);
  } else {
    chunks.push(cmd.boldOn);
    line("PICKUP: ASAP");
    chunks.push(cmd.boldOff);
  }
  chunks.push(cmd.boldOn);
  line(`PAYMENT: ${paymentText(order)}`);
  chunks.push(cmd.boldOff);
  line(divider);

  // Customer info, left aligned. Phone enlarged for quick pickup calls (matches AirPrint).
  line(`NAME: ${text(order.customer_name)}`);
  line(`PHONE: ${text(order.customer_phone)}`);
  if (order.created_at) line(`ORDERED: ${text(formatPickupDateTime(order.created_at))}`);
  if (!isScheduled(order) && order.estimated_ready_at) line(`READY: ${text(formatPickupDateTime(order.estimated_ready_at))}`);

  if (order.customer_notes) {
    line(doubleDivider);
    chunks.push(cmd.boldOn);
    line("CUSTOMER NOTES:");
    wrapped(text(order.customer_notes).toUpperCase());
    chunks.push(cmd.boldOff);
    line(doubleDivider);
  }
  line(divider);

  // Items: name big + bold, line price, plain info lines (size/combo/lunch), and a very obvious
  // "CUSTOMER CHANGED" block for anything the customer customized (incl. special instructions).
  // A default spice level the customer never changed is not printed at all.
  for (const item of order.order_items ?? []) {
    const itemTitle = `${item.quantity} x ${item.item_number ? `#${item.item_number} ` : ""}${item.item_name}`;
    chunks.push(cmd.boldOn);
    wrapped(itemTitle.toUpperCase());
    chunks.push(cmd.boldOff);
    line(moneyLine("", Number(item.unit_price || 0) * Number(item.quantity || 0)));

    const { customLines, infoLines, notes, freeOffer } = classifyItem(item);

    if (freeOffer) {
      chunks.push(cmd.boldOn);
      line("** FREE SPECIAL OFFER **");
      chunks.push(cmd.boldOff);
    }

    for (const info of infoLines) {
      wrapped(`- ${info}`, 2);
    }

    if (customLines.length > 0 || notes) {
      line(divider);
      chunks.push(cmd.boldOn);
      line("SPECIAL INSTRUCTIONS:");
      for (const change of customLines) {
        wrapped(`- ${change.toUpperCase()}`, 2);
      }
      if (notes) {
        wrapped(`- NOTE: ${notes.toUpperCase()}`, 2);
      }
      chunks.push(cmd.boldOff);
    }
    line(divider);
  }

  // Totals: full-width money lines with tax/fee percentages; grand total enlarged (matches AirPrint).
  line(moneyLine("Subtotal", Number(order.subtotal || 0)));
  if (Number(order.discount_amount ?? 0) > 0) {
    line(moneyLine(`Promo${order.promo_code ? ` ${order.promo_code}` : ""}`, -Number(order.discount_amount ?? 0)));
  }
  line(moneyLine(`Tax (${taxPercent}%)`, Number(order.tax || 0)));
  line(moneyLine(`Processing fee (${processingFeePercent}%)`, Number(order.processing_fee ?? 0)));
  line(moneyLine("Tip", Number(order.tip_amount ?? 0)));
  line(doubleDivider);
  chunks.push(cmd.boldOn, cmd.sizeTall);
  line(moneyLine("TOTAL", Number(order.total || 0)));
  chunks.push(cmd.sizeNormal, cmd.boldOff);

  chunks.push(feed(4), cmd.cut);
  return Buffer.concat(chunks);
}
