import { createHash } from "crypto";
import type { getSupabaseAdmin } from "@/lib/supabase-server";

type Supabase = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

export const maxLoginFailures = 10;
export const loginWindowMinutes = 15;

// Counts wrong admin passwords per network address in the admin_login_attempts table (see
// sql/schema.sql). Only a hash of the address is stored. Limiting is per address, never global,
// so a stranger guessing can't lock the restaurant itself out. If the table is missing or the
// database is unreachable, logins are not blocked: the password check still applies.
export function loginAttemptKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`admin-login:${address}`).digest("hex");
}

type AttemptRow = { failures: number; window_started_at: string };

function windowActive(row: AttemptRow | null, now: Date) {
  return Boolean(row && now.getTime() - new Date(row.window_started_at).getTime() < loginWindowMinutes * 60 * 1000);
}

async function readAttempts(supabase: Supabase, key: string) {
  const { data, error } = await supabase.from("admin_login_attempts").select("failures, window_started_at").eq("key", key).maybeSingle();
  if (error) {
    console.warn("[admin-login] attempt limit unavailable", { code: error.code });
    return { ok: false as const };
  }
  return { ok: true as const, row: data as AttemptRow | null };
}

export async function isLoginLocked(supabase: Supabase | null, key: string, now = new Date()) {
  if (!supabase) return false;
  const result = await readAttempts(supabase, key);
  return result.ok && windowActive(result.row, now) && (result.row?.failures ?? 0) >= maxLoginFailures;
}

export async function recordLoginFailure(supabase: Supabase | null, key: string, now = new Date()) {
  if (!supabase) return;
  const result = await readAttempts(supabase, key);
  if (!result.ok) return;
  const row = windowActive(result.row, now) ? result.row! : null;
  const { error } = await supabase.from("admin_login_attempts").upsert({
    key,
    failures: row ? row.failures + 1 : 1,
    window_started_at: row ? row.window_started_at : now.toISOString()
  });
  if (error) console.warn("[admin-login] attempt not recorded", { code: error.code });
}

export async function clearLoginFailures(supabase: Supabase | null, key: string) {
  if (!supabase) return;
  const { error } = await supabase.from("admin_login_attempts").delete().eq("key", key);
  if (error) console.warn("[admin-login] attempts not cleared", { code: error.code });
}
