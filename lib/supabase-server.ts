import { createClient } from "@supabase/supabase-js";

const placeholderFragments = ["your-real-project-ref", "project-ref", "your-actual-project-ref", "cwoxicyrqlcgtaculyrj"];

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^["']|["']$/g, "").trim() ?? "";
}

export function getSupabaseConfig() {
  const rawUrl = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || cleanEnv(process.env.SUPABASE_URL);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanEnv(process.env.SUPABASE_SERVICE_KEY);
  let url: URL | null = null;
  let validationError: string | null = null;

  if (!rawUrl) {
    validationError = "Missing Supabase URL.";
  } else {
    try {
      url = new URL(rawUrl);
      if (url.protocol !== "https:") validationError = "Supabase URL must use https.";
      if (!url.hostname.endsWith(".supabase.co")) validationError = "Supabase URL hostname must end with .supabase.co.";
      if (placeholderFragments.some((fragment) => rawUrl.includes(fragment))) validationError = "Supabase URL is a placeholder or known bad value.";
    } catch {
      validationError = "Supabase URL is not a valid URL.";
    }
  }

  if (!serviceKey && !validationError) validationError = "Missing Supabase service role key.";

  return {
    url: validationError ? "" : rawUrl,
    serviceKey: validationError ? "" : serviceKey,
    hostname: url?.hostname ?? null,
    validationError,
    safeStatus: {
      hasNextPublicUrl: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL).length > 0,
      hasServerUrl: cleanEnv(process.env.SUPABASE_URL).length > 0,
      hasServiceRoleKey: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY).length > 0,
      hasServiceKeyAlias: cleanEnv(process.env.SUPABASE_SERVICE_KEY).length > 0,
      urlLength: rawUrl.length,
      serviceKeyLength: serviceKey.length,
      hostname: url?.hostname ?? null,
      resolvedUrlName: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "NEXT_PUBLIC_SUPABASE_URL" : cleanEnv(process.env.SUPABASE_URL) ? "SUPABASE_URL" : null,
      resolvedServiceKeyName: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ? "SUPABASE_SERVICE_ROLE_KEY" : cleanEnv(process.env.SUPABASE_SERVICE_KEY) ? "SUPABASE_SERVICE_KEY" : null,
      validationError
    }
  };
}

export function getSupabaseEnvStatus() {
  return getSupabaseConfig().safeStatus;
}

export function getSupabaseAdmin() {
  const { url, serviceKey, safeStatus } = getSupabaseConfig();
  console.log("[supabase] server config detection", safeStatus);
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false }
  });
}
