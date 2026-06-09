import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { busyExtraMinutes, defaultOperationalSettings, getOperationalSettings, operationalBoundary, orderingAllowed, orderingOverrideExpiresAt, saveOperationalSettings } from "@/lib/operations";
import type { BusyMode, OrderingOverrideMode } from "@/lib/operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0"
};

function authorized() {
  if (process.env.NODE_ENV === "development") return true;
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

function response(settings: Awaited<ReturnType<typeof getOperationalSettings>>) {
  return NextResponse.json({
    settings,
    orderingAllowed: orderingAllowed(settings),
    busyExtraMinutes: busyExtraMinutes(settings.busyMode),
    nextBoundary: operationalBoundary(settings)
  }, {
    headers: noStoreHeaders
  });
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: noStoreHeaders
  });
}

function isOrderingOverrideMode(value: unknown): value is OrderingOverrideMode {
  return value === "normal" || value === "open" || value === "paused";
}

export async function GET() {
  if (!authorized()) return errorResponse("Unauthorized", 401);
  const settings = await getOperationalSettings();
  return response(settings);
}

export async function PATCH(request: Request) {
  if (!authorized()) return errorResponse("Unauthorized", 401);
  const body = (await request.json()) as {
    orderingOverrideMode?: OrderingOverrideMode;
    orderingOverride?: { mode?: OrderingOverrideMode };
    mode?: OrderingOverrideMode;
    busyMode?: BusyMode;
    soldOutItemId?: string;
    soldOutAction?: "add" | "remove" | "clear";
  };
  const settings = await getOperationalSettings();
  const nextSettings = { ...settings, orderingOverride: { ...settings.orderingOverride }, soldOutItemIds: [...settings.soldOutItemIds] };
  const requestedOverrideMode = body.orderingOverrideMode ?? body.orderingOverride?.mode ?? body.mode;

  if (requestedOverrideMode !== undefined) {
    if (!isOrderingOverrideMode(requestedOverrideMode)) {
      return errorResponse("Invalid ordering override mode.", 400);
    }
    if (requestedOverrideMode === "normal") nextSettings.orderingOverride = { mode: "normal", expiresAt: null };
    else nextSettings.orderingOverride = { mode: requestedOverrideMode, expiresAt: orderingOverrideExpiresAt(requestedOverrideMode) };
  }

  if (body.busyMode) nextSettings.busyMode = body.busyMode;

  if (body.soldOutAction) {
    nextSettings.soldOutDate = defaultOperationalSettings().soldOutDate;
    if (body.soldOutAction === "clear") nextSettings.soldOutItemIds = [];
    if (body.soldOutAction === "add" && body.soldOutItemId) nextSettings.soldOutItemIds = Array.from(new Set([...nextSettings.soldOutItemIds, body.soldOutItemId]));
    if (body.soldOutAction === "remove" && body.soldOutItemId) nextSettings.soldOutItemIds = nextSettings.soldOutItemIds.filter((id) => id !== body.soldOutItemId);
  }

  const saved = await saveOperationalSettings(nextSettings);
  if (saved.error) return errorResponse(saved.error, 500);
  const savedSettings = saved.settings ?? (await getOperationalSettings());
  if (requestedOverrideMode !== undefined && savedSettings.orderingOverride.mode !== requestedOverrideMode) {
    return errorResponse("Ordering override did not persist.", 500);
  }
  return response(savedSettings);
}
