import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Kitchen tickets must be printed from the China Delight Admin Printer tablet app." },
    { status: 410 }
  );
}
