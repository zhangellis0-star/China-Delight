import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { resolveAutoPickupCutoff } from "@/lib/auto-pickup";
import { runAutoPickupSweep } from "@/lib/auto-pickup-sweep";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This cron is a resilience backup for days when nobody has the admin dashboard open — the
// primary, hours-driven trigger lives in app/api/orders GET (runs on every admin poll once the
// store's real hours say it's closed; see lib/auto-pickup.ts). Firing once daily, late at night,
// is just about *when this backup checks*, not about deciding what to close: the actual decision
// still comes entirely from currentAutoPickupCutoff's live store-hours check.
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
  const cutoff = resolveAutoPickupCutoff(url.searchParams.get("date"));

  const { matched, updated, orderNumbers } = await runAutoPickupSweep(supabase, cutoff);
  console.log("[auto-pickup] marked orders picked_up", { cutoff, matched, updated });
  return NextResponse.json({ ok: true, cutoff, manual, matched, updated, orderNumbers });
}

export async function GET(request: Request) {
  return runAutoPickup(request).catch((error) => NextResponse.json({ error: error instanceof Error ? error.message : "Auto-pickup failed." }, { status: 500 }));
}

export async function POST(request: Request) {
  return runAutoPickup(request).catch((error) => NextResponse.json({ error: error instanceof Error ? error.message : "Auto-pickup failed." }, { status: 500 }));
}
