import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { busyExtraMinutes, defaultOperationalSettings, getOperationalSettings, nextStoreBoundary, orderingAllowed, saveOperationalSettings } from "@/lib/operations";
import type { BusyMode, OrderingOverrideMode } from "@/lib/operations";

export const dynamic = "force-dynamic";

function authorized() {
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

function response(settings: Awaited<ReturnType<typeof getOperationalSettings>>) {
  return NextResponse.json({
    settings,
    orderingAllowed: orderingAllowed(settings),
    busyExtraMinutes: busyExtraMinutes(settings.busyMode),
    nextBoundary: nextStoreBoundary()
  });
}

export async function GET() {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getOperationalSettings();
  return response(settings);
}

export async function PATCH(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    orderingOverrideMode?: OrderingOverrideMode;
    busyMode?: BusyMode;
    soldOutItemId?: string;
    soldOutAction?: "add" | "remove" | "clear";
  };
  const settings = await getOperationalSettings();
  const nextSettings = { ...settings, orderingOverride: { ...settings.orderingOverride }, soldOutItemIds: [...settings.soldOutItemIds] };

  if (body.orderingOverrideMode) {
    if (body.orderingOverrideMode === "normal") nextSettings.orderingOverride = { mode: "normal", expiresAt: null };
    else nextSettings.orderingOverride = { mode: body.orderingOverrideMode, expiresAt: nextStoreBoundary().iso };
  }

  if (body.busyMode) nextSettings.busyMode = body.busyMode;

  if (body.soldOutAction) {
    nextSettings.soldOutDate = defaultOperationalSettings().soldOutDate;
    if (body.soldOutAction === "clear") nextSettings.soldOutItemIds = [];
    if (body.soldOutAction === "add" && body.soldOutItemId) nextSettings.soldOutItemIds = Array.from(new Set([...nextSettings.soldOutItemIds, body.soldOutItemId]));
    if (body.soldOutAction === "remove" && body.soldOutItemId) nextSettings.soldOutItemIds = nextSettings.soldOutItemIds.filter((id) => id !== body.soldOutItemId);
  }

  const saved = await saveOperationalSettings(nextSettings);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  return response(nextSettings);
}
