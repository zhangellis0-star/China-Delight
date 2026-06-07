import { NextResponse } from "next/server";
import { getEmailDiagnostics } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getEmailDiagnostics());
}
