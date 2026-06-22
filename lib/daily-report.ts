import { cmd, feed, lineWidth, moneyLine, text } from "@/lib/escpos";

// End-of-day summary. Test orders (order_number starting "TEST") are excluded from all
// financial totals so they never inflate the real numbers.
export type DailyReportOrder = {
  order_number: string;
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at?: string | null;
  subtotal: number | null;
  tax: number | null;
  processing_fee?: number | null;
  tip_amount?: number | null;
  discount_amount?: number | null;
  total: number | null;
  order_items?: Array<{
    item_number?: string | null;
    item_name?: string | null;
    quantity?: number | null;
  }> | null;
};

export type DailyReportSummary = {
  totalOrders: number;
  cancelledOrders: number;
  statusCounts: {
    new: number;
    accepted: number;
    preparing: number;
    ready: number;
    picked_up: number;
    completed: number;
    cancelled: number;
  };
  itemSummary: Array<{
    name: string;
    quantity: number;
  }>;
  foodSales: number;
  discounts: number;
  tax: number;
  processingFees: number;
  tips: number;
  cashTotal: number;
  stripeTotal: number;
  grandTotal: number;
};

function isTest(order: DailyReportOrder) {
  return order.order_number.toUpperCase().startsWith("TEST");
}

export function summarizeDailyOrders(orders: DailyReportOrder[]): DailyReportSummary {
  const real = orders.filter((order) => !isTest(order));
  const counted = real.filter((order) => order.status !== "cancelled");
  const num = (value: number | null | undefined) => Number(value || 0);
  const itemRows = new Map<string, { name: string; quantity: number }>();

  for (const order of counted) {
    for (const item of order.order_items ?? []) {
      const quantity = Number(item.quantity || 0);
      if (!quantity) continue;
      const name = text(`${item.item_number ? `#${item.item_number} ` : ""}${item.item_name ?? "Item"}`);
      const current = itemRows.get(name) ?? { name, quantity: 0 };
      current.quantity += quantity;
      itemRows.set(name, current);
    }
  }

  return {
    totalOrders: real.length,
    cancelledOrders: real.filter((order) => order.status === "cancelled").length,
    statusCounts: {
      new: real.filter((order) => order.status === "new").length,
      accepted: real.filter((order) => order.status === "accepted").length,
      preparing: real.filter((order) => order.status === "preparing").length,
      ready: real.filter((order) => order.status === "ready").length,
      picked_up: real.filter((order) => order.status === "picked_up").length,
      completed: real.filter((order) => order.status === "completed").length,
      cancelled: real.filter((order) => order.status === "cancelled").length
    },
    itemSummary: Array.from(itemRows.values()).sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name)),
    foodSales: counted.reduce((sum, order) => sum + num(order.subtotal), 0),
    discounts: counted.reduce((sum, order) => sum + num(order.discount_amount), 0),
    tax: counted.reduce((sum, order) => sum + num(order.tax), 0),
    processingFees: counted.reduce((sum, order) => sum + num(order.processing_fee), 0),
    tips: counted.reduce((sum, order) => sum + num(order.tip_amount), 0),
    cashTotal: counted.filter((order) => order.payment_method !== "stripe").reduce((sum, order) => sum + num(order.total), 0),
    stripeTotal: counted
      .filter((order) => order.payment_method === "stripe" && order.payment_status === "paid")
      .reduce((sum, order) => sum + num(order.total), 0),
    grandTotal: counted.reduce((sum, order) => sum + num(order.total), 0)
  };
}

function countLine(label: string, value: number) {
  const left = text(label);
  const right = String(value);
  return `${left}${" ".repeat(Math.max(1, lineWidth - left.length - right.length))}${right}`;
}

export function escposDailyReport(summary: DailyReportSummary, opts: { dateLabel: string; printedAtLabel: string }) {
  const divider = "-".repeat(lineWidth);
  const doubleDivider = "=".repeat(lineWidth);
  const chunks: Buffer[] = [cmd.init];
  const line = (value: string) => chunks.push(Buffer.from(`${value}\n`, "ascii"));

  chunks.push(cmd.alignCenter, cmd.boldOn, cmd.sizeLarge);
  line("CHINA DELIGHT");
  chunks.push(cmd.sizeTall);
  line("DAILY REPORT");
  chunks.push(cmd.sizeNormal);
  line("CHINA DELIGHT DAILY REPORT");
  chunks.push(cmd.sizeNormal, cmd.boldOff);
  line(text(opts.dateLabel));
  line(doubleDivider);

  chunks.push(cmd.alignLeft);
  chunks.push(cmd.boldOn);
  line(countLine("Total orders", summary.totalOrders));
  chunks.push(cmd.boldOff);
  line(divider);

  line(moneyLine("Gross sales", summary.grandTotal));
  line(moneyLine("Food subtotal", summary.foodSales));
  if (summary.discounts > 0) line(moneyLine("Promo / discounts", -summary.discounts));
  line(moneyLine("Tax", summary.tax));
  line(moneyLine("Tips", summary.tips));
  if (summary.processingFees > 0) line(moneyLine("Processing fees", summary.processingFees));
  line(divider);

  line(moneyLine("Cash / pay at pickup", summary.cashTotal));
  line(moneyLine("Online / paid", summary.stripeTotal));
  line(doubleDivider);

  chunks.push(cmd.boldOn, cmd.sizeTall);
  line(moneyLine("GRAND TOTAL", summary.grandTotal));
  chunks.push(cmd.sizeNormal, cmd.boldOff);
  line(divider);

  chunks.push(cmd.boldOn);
  line("STATUS COUNTS");
  chunks.push(cmd.boldOff);
  line(countLine("New", summary.statusCounts.new));
  line(countLine("Accepted", summary.statusCounts.accepted));
  line(countLine("Preparing", summary.statusCounts.preparing));
  line(countLine("Ready", summary.statusCounts.ready));
  line(countLine("Completed", summary.statusCounts.completed));
  line(countLine("Picked up", summary.statusCounts.picked_up));
  line(countLine("Cancelled", summary.statusCounts.cancelled));

  if (summary.itemSummary.length) {
    line(divider);
    chunks.push(cmd.boldOn);
    line("ITEM SUMMARY");
    chunks.push(cmd.boldOff);
    for (const item of summary.itemSummary) {
      line(countLine(item.name.slice(0, lineWidth - 6), item.quantity));
    }
  }

  line(doubleDivider);
  chunks.push(cmd.alignCenter);
  line(`Printed ${text(opts.printedAtLabel)}`);
  chunks.push(cmd.alignLeft);

  chunks.push(feed(4), cmd.cut);
  return Buffer.concat(chunks);
}
