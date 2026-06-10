import { NextResponse } from "next/server";
import { isDebugRouteAllowed } from "@/lib/debug-auth";
import { getEmailDiagnostics } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDebugRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(getEmailDiagnostics());
}
