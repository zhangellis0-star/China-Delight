// Phone verification code storage and checking.
// Primary store is the Supabase `phone_verifications` table; when Supabase is not configured
// we fall back to an in-memory map so local development never breaks. Codes expire after 10 minutes.

import { getSupabaseAdmin } from "@/lib/supabase-server";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export type VerifyStatus = "verified" | "invalid" | "expired" | "not_found" | "too_many_attempts";

// Keep only digits (and a leading +) so the same number matches regardless of formatting.
export function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ---- In-memory fallback (used only when Supabase is unavailable) ----
type MemoryRecord = { code: string; expiresAt: number; attempts: number };
const memoryStore = new Map<string, MemoryRecord>();

export async function storeVerificationCode(phone: string, code: string) {
  const normalized = normalizePhone(phone);
  const expiresAt = Date.now() + CODE_TTL_MS;
  const supabase = getSupabaseAdmin();

  if (supabase) {
    // Clear any prior codes for this phone, plus globally expired rows, then insert the fresh code.
    await supabase.from("phone_verifications").delete().eq("phone", normalized);
    await supabase.from("phone_verifications").delete().lt("expires_at", new Date().toISOString());
    const { error } = await supabase.from("phone_verifications").insert({
      phone: normalized,
      code,
      expires_at: new Date(expiresAt).toISOString()
    });
    if (error) {
      console.error("[phone-verification] Supabase insert failed; using memory fallback", { message: error.message });
      memoryStore.set(normalized, { code, expiresAt, attempts: 0 });
    }
    return;
  }

  memoryStore.set(normalized, { code, expiresAt, attempts: 0 });
}

export async function checkVerificationCode(phone: string, code: string): Promise<VerifyStatus> {
  const normalized = normalizePhone(phone);
  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data, error } = await supabase
      .from("phone_verifications")
      .select("id, code, attempts, expires_at")
      .eq("phone", normalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[phone-verification] Supabase lookup failed; using memory fallback", { message: error.message });
      return checkMemory(normalized, code);
    }
    if (!data) return "not_found";
    if (new Date(data.expires_at).getTime() < Date.now()) {
      await supabase.from("phone_verifications").delete().eq("id", data.id);
      return "expired";
    }
    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) return "too_many_attempts";

    if (data.code !== code) {
      await supabase.from("phone_verifications").update({ attempts: (data.attempts ?? 0) + 1 }).eq("id", data.id);
      return "invalid";
    }

    await supabase.from("phone_verifications").update({ verified: true }).eq("id", data.id);
    return "verified";
  }

  return checkMemory(normalized, code);
}

function checkMemory(normalized: string, code: string): VerifyStatus {
  const record = memoryStore.get(normalized);
  if (!record) return "not_found";
  if (record.expiresAt < Date.now()) {
    memoryStore.delete(normalized);
    return "expired";
  }
  if (record.attempts >= MAX_ATTEMPTS) return "too_many_attempts";
  if (record.code !== code) {
    record.attempts += 1;
    return "invalid";
  }
  memoryStore.delete(normalized);
  return "verified";
}
