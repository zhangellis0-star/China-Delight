import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { easternDateKey } from "@/lib/operations";
import { sendToPrinter, printerLabel } from "@/lib/escpos";
import { escposDailyReport, summarizeDailyOrders } from "@/lib/daily-report";
import type { DailyReportOrder, DailyReportSummary } from "@/lib/daily-report";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tz = "America/New_York";
const activePrints = new Set<string>();

function easternLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function easternTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

function isDateKey(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function dateFromKey(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function queryWindowForDateKey(value: string) {
  const noon = dateFromKey(value);
  return {
    start: new Date(noon.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    end: new Date(noon.getTime() + 36 * 60 * 60 * 1000).toISOString()
  };
}

function dateLabel(dateKey: string) {
  return easternLabel(dateFromKey(dateKey));
}

function itemSummary(order: DailyReportOrder) {
  return (order.order_items ?? [])
    .map((item) => `${item.quantity ?? 0}x ${item.item_number ? `#${item.item_number} ` : ""}${item.item_name ?? ""}`.trim())
    .filter(Boolean)
    .join("; ");
}

function isTestOrder(order: DailyReportOrder) {
  return order.order_number.toUpperCase().startsWith("TEST");
}

function reportDetails(date: string, orders: DailyReportOrder[]) {
  const testOrdersExcluded = orders.filter(isTestOrder).length;
  const realOrders = orders.filter((order) => !isTestOrder(order));
  const summary = summarizeDailyOrders(orders);
  return {
    date,
    dateLabel: dateLabel(date),
    testOrdersExcluded,
    summary,
    orders: realOrders
      .sort((left, right) => new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime())
      .map((order) => ({
        orderNumber: order.order_number,
        createdAt: order.created_at ?? null,
        timeLabel: order.created_at ? easternTimeLabel(new Date(order.created_at)) : "",
        customerName: order.customer_name ?? "",
        customerPhone: order.customer_phone ?? "",
        status: order.status,
        paymentMethod: order.payment_method ?? "pay_at_pickup",
        paymentStatus: order.payment_status ?? null,
        subtotal: Number(order.subtotal || 0),
        tax: Number(order.tax || 0),
        processingFee: Number(order.processing_fee || 0),
        tip: Number(order.tip_amount || 0),
        discount: Number(order.discount_amount || 0),
        total: Number(order.total || 0),
        itemsSummary: itemSummary(order)
      }))
  };
}

async function ordersForDate(dateKey: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { orders: [] as DailyReportOrder[], error: "Supabase is not configured." };
  const window = queryWindowForDateKey(dateKey);
  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status, payment_method, payment_status, customer_name, customer_phone, subtotal, tax, processing_fee, tip_amount, discount_amount, total, created_at, order_items(item_number, item_name, quantity)")
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .limit(2000);
  if (error) return { orders: [] as DailyReportOrder[], error: error.message };
  return { orders: ((data ?? []) as DailyReportOrder[]).filter((order) => order.created_at && easternDateKey(new Date(order.created_at)) === dateKey), error: null };
}

async function recentReports(days: number) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { reports: [] as Array<{ date: string; dateLabel: string; testOrdersExcluded: number; summary: DailyReportSummary }>, error: "Supabase is not configured." };
  const safeDays = Math.min(30, Math.max(1, Math.round(days)));
  const now = new Date();
  const windowStart = new Date(now.getTime() - (safeDays + 3) * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status, payment_method, payment_status, subtotal, tax, processing_fee, tip_amount, discount_amount, total, created_at")
    .gte("created_at", windowStart)
    .limit(5000);
  if (error) return { reports: [], error: error.message };
  const todayKey = easternDateKey(now);
  const keys: string[] = [];
  for (let index = 0; index < safeDays; index += 1) {
    const key = easternDateKey(new Date(now.getTime() - index * 24 * 60 * 60 * 1000));
    if (!keys.includes(key) && key <= todayKey) keys.push(key);
  }
  const byDate = new Map<string, DailyReportOrder[]>();
  for (const order of (data ?? []) as DailyReportOrder[]) {
    if (!order.created_at) continue;
    const key = easternDateKey(new Date(order.created_at));
    if (!keys.includes(key)) continue;
    byDate.set(key, [...(byDate.get(key) ?? []), order]);
  }
  return {
    reports: keys.map((date) => {
      const orders = byDate.get(date) ?? [];
      return {
        date,
        dateLabel: dateLabel(date),
        testOrdersExcluded: orders.filter(isTestOrder).length,
        summary: summarizeDailyOrders(orders)
      };
    }),
    error: null
  };
}

export async function GET(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || easternDateKey(new Date());
  if (!isDateKey(date)) return NextResponse.json({ error: "Use a report date in YYYY-MM-DD format." }, { status: 400 });
  const days = Number(searchParams.get("days") ?? 7);
  const [{ orders, error }, recent] = await Promise.all([ordersForDate(date), recentReports(Number.isFinite(days) ? days : 7)]);
  if (error) return NextResponse.json({ error }, { status: 500 });
  if (recent.error) return NextResponse.json({ error: recent.error }, { status: 500 });
  return NextResponse.json({ report: reportDetails(date, orders), recentReports: recent.reports });
}

export async function POST(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { date?: string };
  const now = new Date();
  const reportDate = body.date && isDateKey(body.date) ? body.date : easternDateKey(now);
  const printKey = `daily-report:${reportDate}`;

  if (activePrints.has(printKey)) {
    return NextResponse.json({ error: "Daily report is already printing. Wait for it to finish before trying again." }, { status: 409 });
  }
  activePrints.add(printKey);

  try {
    const { orders, error } = await ordersForDate(reportDate);
    if (error) return NextResponse.json({ error }, { status: 500 });
    const summary = summarizeDailyOrders(orders);

    await sendToPrinter(escposDailyReport(summary, { dateLabel: dateLabel(reportDate), printedAtLabel: easternTimeLabel(now) }));

    return NextResponse.json({ ok: true, printerLabel, date: reportDate, summary });
  } catch (printError) {
    const message = printError instanceof Error ? printError.message : "Unknown printer error";
    console.error("[daily-report] print failed", { date: reportDate, message });
    return NextResponse.json({ error: `${printerLabel} failed: ${message}` }, { status: 502 });
  } finally {
    activePrints.delete(printKey);
  }
}
