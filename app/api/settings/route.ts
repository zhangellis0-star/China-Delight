import { NextResponse } from "next/server";
import { busyExtraMinutes, getOperationalSettings, operationalBoundary, orderingAllowed } from "@/lib/operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0"
};

export async function GET() {
  const settings = await getOperationalSettings();
  return NextResponse.json({
    orderingAllowed: orderingAllowed(settings),
    orderingOverride: settings.orderingOverride,
    busyMode: settings.busyMode,
    busyExtraMinutes: busyExtraMinutes(settings.busyMode),
    soldOutItemIds: settings.soldOutItemIds,
    nextBoundary: operationalBoundary(settings)
  }, {
    headers: noStoreHeaders
  });
}
