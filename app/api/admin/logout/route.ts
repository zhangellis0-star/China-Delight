import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName } from "@/lib/admin-auth";

export async function POST() {
  cookies().delete(getAdminCookieName());
  return NextResponse.json({ ok: true });
}
