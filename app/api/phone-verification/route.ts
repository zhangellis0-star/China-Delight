import { NextResponse } from "next/server";
import { checkVerificationCode, generateCode, normalizePhone, storeVerificationCode } from "@/lib/phone-verification";
import { getSmsConfig, isProduction, sendSms } from "@/lib/sms";

export const runtime = "nodejs";

type VerificationBody = { action?: "send" | "verify"; phone?: string; code?: string };

export async function POST(request: Request) {
  const body = (await request.json()) as VerificationBody;
  const phone = (body.phone ?? "").trim();

  if (!phone || normalizePhone(phone).replace("+", "").length < 10) {
    return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
  }

  if (body.action === "send") {
    const code = generateCode();
    await storeVerificationCode(phone, code);

    const sms = await sendSms(phone, `Your China Delight verification code is ${code}. It expires in 10 minutes.`);
    const { configured } = getSmsConfig();

    // In development without an SMS provider, return the code so it can be tested locally.
    // Never expose the code in production.
    const exposeDevCode = !configured && !isProduction();
    if (exposeDevCode) {
      console.log("[phone-verification] DEV MODE code (no SMS provider configured)", { phone, code });
    }

    return NextResponse.json({
      sent: true,
      smsDelivered: sms.sent,
      devMode: exposeDevCode,
      ...(exposeDevCode ? { devCode: code } : {}),
      message: sms.sent ? "Verification code sent." : exposeDevCode ? "Development mode: code shown below (no SMS provider configured)." : "Verification code generated."
    });
  }

  if (body.action === "verify") {
    const code = (body.code ?? "").trim();
    if (!code) {
      return NextResponse.json({ verified: false, status: "invalid", error: "Enter the 6-digit code." }, { status: 400 });
    }

    const status = await checkVerificationCode(phone, code);
    const messages: Record<typeof status, string> = {
      verified: "Phone verified.",
      invalid: "Invalid code. Please try again.",
      expired: "Code expired. Please request a new code.",
      not_found: "No code found. Please request a new code.",
      too_many_attempts: "Too many attempts. Please request a new code."
    };

    return NextResponse.json({ verified: status === "verified", status, message: messages[status] }, { status: status === "verified" ? 200 : 400 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
