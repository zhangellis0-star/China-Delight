import { NextResponse } from "next/server";
import { adminSessionMaxAgeSeconds, getAdminCookieName, isAdminConfigured, isCorrectAdminPassword, signAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  if (!isCorrectAdminPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieName(), signAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: adminSessionMaxAgeSeconds
  });

  return response;
}
