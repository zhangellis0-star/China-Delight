import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import {
  isAutoPickupCandidate,
  queryWindowForDateKey,
  resolveAutoPickupDate,
  type AutoPickupOrder
} from "@/lib/auto-pickup";
import { updateOrderStatusInGoogleSheets } from "@/lib/google-sheets";
import { activeOrderStatuses } from "@/lib/order-status";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const querySecret = new URL(request.url).searchParams.get("secret") ?? "";
  if (cronSecret && (auth === `Bearer ${cronSecret}` || headerSecret === cronSecret || querySecret === cronSecret)) return true;
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

function isManualRun(url: URL) {
  const flag = (url.searchParams.get("manual") ?? url.searchParams.get("test") ?? url.searchParams.get("force") ?? "").toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || Boolean(url.searchParams.get("date"));
}

async function runAutoPickup(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const url = new URL(request.url);
  const manual = isManualRun(url);
  const date = resolveAutoPickupDate(url.searchParams.get("date"));
  const window = queryWindowForDateKey(date);

  const { data, error } = await supabase
    .from("orders")
    .select("order_number, status, created_at, scheduled_pickup_time")
    .gte("created_at", window.start)
    .lt("created_at", window.end)
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates = ((data ?? []) as AutoPickupOrder[]).filter((order) => isAutoPickupCandidate(order, date));

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
