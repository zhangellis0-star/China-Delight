import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminConfigured, signAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  cookies().set(getAdminCookieName(), signAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });

  return NextResponse.json({ ok: true });
}
