import { NextResponse } from "next/server";
import { adminSessionMaxAgeSeconds, getAdminCookieName, isAdminConfigured, isCorrectAdminPassword, signAdminSession } from "@/lib/admin-auth";
import { clearLoginFailures, isLoginLocked, loginAttemptKey, loginWindowMinutes, recordLoginFailure } from "@/lib/login-throttle";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!isAdminConfigured()) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const attemptKey = loginAttemptKey(request);
  if (await isLoginLocked(supabase, attemptKey)) {
    return NextResponse.json({ error: `Too many wrong passwords. Try again in ${loginWindowMinutes} minutes.` }, { status: 429 });
  }

  if (!isCorrectAdminPassword(password)) {
    await recordLoginFailure(supabase, attemptKey);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  await clearLoginFailures(supabase, attemptKey);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieName(), signAdminSession(), {
    httpOnly: true,
    sameSite: "lax",
    // Always secure in production, whether or not NEXT_PUBLIC_SITE_URL is set; plain http only for
    // local development.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminSessionMaxAgeSeconds
  });

  return response;
}
