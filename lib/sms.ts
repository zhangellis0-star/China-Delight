// SMS provider abstraction. Twilio is used when its env keys are present; otherwise the app
// runs in development mode and does not actually send a text. No secrets are hardcoded here.

export function getSmsConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() ?? "";
  const configured = Boolean(accountSid && authToken && fromNumber);
  return { accountSid, authToken, fromNumber, configured };
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

type SendResult = { sent: boolean; provider: "twilio" | "none"; error?: string };

// Sends an SMS via Twilio's REST API (no SDK dependency). Returns sent:false in dev mode
// so callers can fall back to showing the code locally without breaking checkout.
export async function sendSms(to: string, message: string): Promise<SendResult> {
  const { accountSid, authToken, fromNumber, configured } = getSmsConfig();
  if (!configured) {
    return { sent: false, provider: "none" };
  }

  try {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ To: to, From: fromNumber, Body: message });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[sms] Twilio send failed", { status: response.status });
      return { sent: false, provider: "twilio", error: `Twilio responded ${response.status}: ${detail.slice(0, 200)}` };
    }
    return { sent: true, provider: "twilio" };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown SMS error";
    console.error("[sms] Twilio send threw", { message: messageText });
    return { sent: false, provider: "twilio", error: messageText };
  }
}
