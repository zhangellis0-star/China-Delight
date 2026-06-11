import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { easternDateKey } from "@/lib/operations";
import { sendToPrinter, printerLabel } from "@/lib/escpos";
import { escposDailyReport, summarizeDailyOrders } from "@/lib/daily-report";
import type { DailyReportOrder } from "@/lib/daily-report";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dedupeKey = "daily_report";
const tz = "America/New_York";

function easternLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(date);
}

function easternTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);
}

export async function POST(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { auto?: boolean; force?: boolean };
  const now = new Date();
  const todayKey = easternDateKey(now);

  // Read the dedupe marker. Auto (scheduled 10pm) runs skip if today's report already printed.
  const { data: dedupeRow } = await supabase.from("operational_settings").select("value").eq("key", dedupeKey).maybeSingle();
  const lastPrintedDate = (dedupeRow?.value as { lastPrintedDate?: string } | null)?.lastPrintedDate ?? null;
  if (body.auto && !body.force && lastPrintedDate === todayKey) {
    return NextResponse.json({ ok: true, skipped: true, reason: "Daily report already printed today.", date: todayKey });
  }

  // Pull a generous window and filter to today's Eastern calendar day (avoids tz-boundary math).
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("order_number, status, payment_method, payment_status, subtotal, tax, processing_fee, tip_amount, discount_amount, total, created_at")
    .gte("created_at", windowStart)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const todays = (orders ?? []).filter((order) => order.created_at && easternDateKey(new Date(order.created_at)) === todayKey) as DailyReportOrder[];
  const summary = summarizeDailyOrders(todays);

  try {
    await sendToPrinter(escposDailyReport(summary, { dateLabel: easternLabel(now), printedAtLabel: easternTimeLabel(now) }));
  } catch (printError) {
    const message = printError instanceof Error ? printError.message : "Unknown printer error";
    console.error("[daily-report] print failed", { date: todayKey, message });
    return NextResponse.json({ error: `${printerLabel} failed: ${message}`, summary }, { status: 502 });
  }

  // Only the scheduled (auto) run records the dedupe marker, so manual test prints never
  // suppress the real 10pm report.
  if (body.auto) {
    await supabase
      .from("operational_settings")
      .upsert({ key: dedupeKey, value: { lastPrintedDate: todayKey }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ ok: true, printerLabel, date: todayKey, summary });
}
