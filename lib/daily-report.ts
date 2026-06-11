import { cmd, feed, lineWidth, moneyLine, text } from "@/lib/escpos";

// End-of-day summary. Test orders (order_number starting "TEST") are excluded from all
// financial totals so they never inflate the real numbers.
export type DailyReportOrder = {
  order_number: string;
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
  subtotal: number | null;
  tax: number | null;
  processing_fee?: number | null;
  tip_amount?: number | null;
  discount_amount?: number | null;
  total: number | null;
};

export type DailyReportSummary = {
  totalOrders: number;
  cancelledOrders: number;
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

  return {
    totalOrders: real.length,
    cancelledOrders: real.filter((order) => order.status === "cancelled").length,
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
  chunks.push(cmd.sizeNormal, cmd.boldOff);
  line(text(opts.dateLabel));
  line(`Printed ${text(opts.printedAtLabel)}`);
  line(doubleDivider);

  chunks.push(cmd.alignLeft);
  chunks.push(cmd.boldOn);
  line(countLine("Orders", summary.totalOrders));
  line(countLine("Cancelled orders", summary.cancelledOrders));
  chunks.push(cmd.boldOff);
  line(divider);

  line(moneyLine("Food sales (subtotal)", summary.foodSales));
  if (summary.discounts > 0) line(moneyLine("Promo / discounts", -summary.discounts));
  line(moneyLine("Tax collected", summary.tax));
  line(moneyLine("Processing fees", summary.processingFees));
  line(moneyLine("Tips", summary.tips));
  line(divider);

  line(moneyLine("Pay at pickup (cash)", summary.cashTotal));
  line(moneyLine("Paid online (Stripe)", summary.stripeTotal));
  line(doubleDivider);

  chunks.push(cmd.boldOn, cmd.sizeTall);
  line(moneyLine("GRAND TOTAL", summary.grandTotal));
  chunks.push(cmd.sizeNormal, cmd.boldOff);

  chunks.push(feed(4), cmd.cut);
  return Buffer.concat(chunks);
}
