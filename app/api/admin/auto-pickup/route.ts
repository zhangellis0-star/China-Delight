import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { updateOrderStatusInGoogleSheets } from "@/lib/google-sheets";
import { activeOrderStatuses } from "@/lib/order-status";
import { easternDateKey } from "@/lib/operations";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AutoPickupOrder = {
  order_number: string;
  status: string;
  created_at: string | null;
  scheduled_pickup_time?: string | null;
};

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const querySecret = new URL(request.url).searchParams.get("secret") ?? "";
  if (cronSecret && (auth === `Bearer ${cronSecret}` || headerSecret === cronSecret || querySecret === cronSecret)) return true;
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

function easternTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: easternDateKey(now),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function isAutoPickupTime(now = new Date()) {
  const parts = easternTimeParts(now);
  return parts.hour === 23 && parts.minute === 59;
}

function isManualRun(url: URL) {
  const flag = (url.searchParams.get("manual") ?? url.searchParams.get("test") ?? url.searchParams.get("force") ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || Boolean(url.searchParams.get("date"));
}

function targetBusinessDate(now = new Date()) {
  const { hour } = easternTimeParts(now);
  if (hour < 2) return easternDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return easternDateKey(now);
}

function queryWindowForDateKey(dateKey: string) {
  const noon = new Date(`${dateKey}T12:00:00Z`);
  return {
    start: new Date(noon.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    end: new Date(noon.getTime() + 36 * 60 * 60 * 1000).toISOString()
  };
}

async function runAutoPickup(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const url = new URL(request.url);
  const manual = isManualRun(url);
  const easternNow = easternTimeParts();
  if (!manual && !isAutoPickupTime()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "Auto-pickup only runs at 11:59 PM America/New_York. Use an authenticated manual/test request to run outside that minute.",
      easternDate: easternNow.date,
      easternTime: `${String(easternNow.hour).padStart(2, "0")}:${String(easternNow.minute).padStart(2, "0")}`
    });
  }

  const requestedDate = url.searchParams.get("date");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : targetBusinessDate();
  const window = queryWindowForDateKey(date);

  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status, created_at, scheduled_pickup_time")
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = ((data ?? []) as AutoPickupOrder[]).filter((order) => {
    if (!order.created_at || easternDateKey(new Date(order.created_at)) !== date) return false;
    if (!activeOrderStatuses.includes(order.status as (typeof activeOrderStatuses)[number])) return false;
    if (order.scheduled_pickup_time && easternDateKey(new Date(order.scheduled_pickup_time)) > date) return false;
    return true;
  });

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, date, matched: 0, updated: 0 });
  }

  const orderNumbers = candidates.map((order) => order.order_number);
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "picked_up", updated_at: new Date().toISOString() })
    .in("order_number", orderNumbers)
    .in("status", activeOrderStatuses)
    .select("order_number, status");
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const updatedOrderNumbers = new Set((updated ?? []).map((order) => order.order_number));
  const updatedCandidates = candidates.filter((order) => updatedOrderNumbers.has(order.order_number));
  await Promise.allSettled(
    updatedCandidates.map((order) =>
      updateOrderStatusInGoogleSheets({
        orderNumber: order.order_number,
        oldStatus: order.status,
        newStatus: "picked_up",
        updatedAt: new Date()
      })
    )
  );

  console.log("[auto-pickup] marked orders picked_up", { date, matched: candidates.length, updated: updated?.length ?? 0 });
  return NextResponse.json({ ok: true, date, manual, matched: candidates.length, updated: updated?.length ?? 0, orderNumbers: [...updatedOrderNumbers] });
}

export async function GET(request: Request) {
  return runAutoPickup(request);
}

export async function POST(request: Request) {
  return runAutoPickup(request);
}
