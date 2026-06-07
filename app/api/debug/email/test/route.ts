import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { sendTestEmail } from "@/lib/email";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function isAllowed(request: Request) {
  if (process.env.NODE_ENV === "development") return true;
  if (isValidAdminSession(cookies().get(getAdminCookieName())?.value)) return true;

  const headerPassword = request.headers.get("x-admin-password");
  if (headerPassword && process.env.ADMIN_PASSWORD && headerPassword === process.env.ADMIN_PASSWORD) return true;
  return false;
}

export async function POST(request: Request) {
  let body: { to?: string; adminPassword?: string } = {};
  try {
    body = (await request.json()) as { to?: string; adminPassword?: string };
  } catch {
    body = {};
  }

  const headerAllowed = await isAllowed(request);
  const passwordAllowed = Boolean(process.env.ADMIN_PASSWORD && body.adminPassword === process.env.ADMIN_PASSWORD);
  if (!headerAllowed && !passwordAllowed) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const to = body.to?.trim() ?? "";
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Enter a valid test recipient email." }, { status: 400 });
  }

  const result = await sendTestEmail(to);
  if (!result.sent) {
    return NextResponse.json(
      {
        sent: false,
        skipped: result.skipped ?? false,
        error: result.error ?? "Email was not sent."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true });
}
