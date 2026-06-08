import { NextResponse } from "next/server";
import { busyExtraMinutes, getOperationalSettings, nextStoreBoundary, orderingAllowed } from "@/lib/operations";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getOperationalSettings();
  return NextResponse.json({
    orderingAllowed: orderingAllowed(settings),
    orderingOverride: settings.orderingOverride,
    busyMode: settings.busyMode,
    busyExtraMinutes: busyExtraMinutes(settings.busyMode),
    soldOutItemIds: settings.soldOutItemIds,
    nextBoundary: nextStoreBoundary()
  });
}
