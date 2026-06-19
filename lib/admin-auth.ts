import { createHmac, timingSafeEqual } from "crypto";

const cookieName = "china_delight_admin";

// Sessions are valid for 12 hours. The expiry timestamp lives inside the signed
// token, so a stolen cookie stops working after this window and the value cannot
// be extended without ADMIN_PASSWORD.
export const adminSessionMaxAgeSeconds = 60 * 60 * 12;

export function getAdminCookieName() {
  return cookieName;
}

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

export function isAdminConfigured() {
  return secret().length > 0;
}

function signExpiry(expiresAtMs: number) {
  return createHmac("sha256", secret()).update(`admin:${expiresAtMs}`).digest("hex");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Compares the submitted login password without leaking timing or length:
// both sides are HMACed to fixed-size digests before the timing-safe compare.
export function isCorrectAdminPassword(candidate: string) {
  if (!isAdminConfigured()) return false;
  const key = "china-delight-password-check";
  const expected = createHmac("sha256", key).update(secret()).digest("hex");
  const provided = createHmac("sha256", key).update(candidate).digest("hex");
  return safeEqual(provided, expected);
}

export function signAdminSession(now = Date.now()) {
  const expiresAtMs = now + adminSessionMaxAgeSeconds * 1000;
  return `${expiresAtMs}.${signExpiry(expiresAtMs)}`;
}

export function isValidAdminSession(value?: string) {
  if (!isAdminConfigured() || !value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const expiresAtMs = Number(value.slice(0, dot));
  if (!Number.isSafeInteger(expiresAtMs) || Date.now() >= expiresAtMs) return false;
  return safeEqual(value.slice(dot + 1), signExpiry(expiresAtMs));
}
