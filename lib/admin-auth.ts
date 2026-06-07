import { createHmac, timingSafeEqual } from "crypto";

const cookieName = "china_delight_admin";

export function getAdminCookieName() {
  return cookieName;
}

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

export function isAdminConfigured() {
  return secret().length > 0;
}

export function signAdminSession() {
  return createHmac("sha256", secret()).update("admin").digest("hex");
}

export function isValidAdminSession(value?: string) {
  if (!isAdminConfigured() || !value) return false;
  const expected = signAdminSession();
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
