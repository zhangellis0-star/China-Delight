import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";

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

async function parseResendResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function sendDebugEmail(to: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.ORDER_FROM_EMAIL?.trim() ?? "";

  if (!apiKey) {
    return NextResponse.json({ sent: false, error: "RESEND_API_KEY is missing." }, { status: 500 });
  }
  if (!from) {
    return NextResponse.json({ sent: false, error: "ORDER_FROM_EMAIL is missing." }, { status: 500 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: "China Delight test email",
      html: "<p>If you received this, Resend is working.</p>",
      text: "If you received this, Resend is working."
    })
  });

  const resendResponse = await parseResendResponse(response);
  if (!response.ok) {
    return NextResponse.json(
      {
        sent: false,
        status: response.status,
        statusText: response.statusText,
        resendResponse
      },
      { status: response.status }
    );
  }

  return NextResponse.json({
    sent: true,
    status: response.status,
    resendResponse
  });
}

export async function GET(request: Request) {
  if (!(await isAllowed(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const to = new URL(request.url).searchParams.get("to")?.trim() ?? "";
  if (!to) {
    return NextResponse.json({ error: "Missing test recipient. Add ?to=email@example.com to the URL." }, { status: 400 });
  }
  if (!isValidEmail(to)) {
    return NextResponse.json({ error: "Enter a valid test recipient email." }, { status: 400 });
  }

  try {
    return await sendDebugEmail(to);
  } catch (error) {
    return NextResponse.json(
      {
        sent: false,
        error: error instanceof Error ? error.message : "Email test failed."
      },
      { status: 500 }
    );
  }
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

  try {
    return await sendDebugEmail(to);
  } catch (error) {
    return NextResponse.json(
      {
        sent: false,
        error: error instanceof Error ? error.message : "Email test failed."
      },
      { status: 500 }
    );
  }
}
