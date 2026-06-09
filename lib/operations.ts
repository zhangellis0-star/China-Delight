import { isRestaurantOpen } from "@/lib/order-rules";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export type OrderingOverrideMode = "normal" | "open" | "paused";
export type BusyMode = "normal" | "busy" | "very_busy";

export type OperationalSettings = {
  orderingOverride: { mode: OrderingOverrideMode; expiresAt: string | null };
  busyMode: BusyMode;
  soldOutDate: string | null;
  soldOutItemIds: string[];
};

const settingsKey = "restaurant_operations";
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

function storeWindow(day: number) {
  if (day === 0) return { open: minutes(12, 0), close: minutes(22, 0) };
  if (day === 5 || day === 6) return { open: minutes(11, 0), close: minutes(22, 30) };
  return { open: minutes(11, 0), close: minutes(22, 0) };
}

function onlineOrderingWindow(day: number) {
  const window = storeWindow(day);
  return { ...window, close: day === 0 ? minutes(20, 15) : minutes(21, 0) };
}

function easternParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    dayOfMonth: Number(get("day")),
    day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second"))
  };
}

function easternOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUTC - date.getTime();
}

function easternWallTimeToISO(year: number, month: number, day: number, totalMinutes: number) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = easternOffsetMs(new Date(guess));
  let utc = guess - offset;
  const corrected = easternOffsetMs(new Date(utc));
  if (corrected !== offset) utc = guess - corrected;
  return new Date(utc).toISOString();
}

function addDays(year: number, month: number, day: number, days: number) {
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, dayOfMonth: date.getUTCDate(), day: date.getUTCDay() };
}

export function easternDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function formatBoundaryLabel(date: Date, reference = new Date()) {
  const parts = easternParts(date);
  const label = `${dayNames[parts.day]} at ${formatBoundaryTime(minutes(parts.hour, parts.minute))}`;
  return easternDateKey(date) === easternDateKey(reference) ? `today at ${formatBoundaryTime(minutes(parts.hour, parts.minute))}` : label;
}

export function nextStoreBoundary(date = new Date()) {
  const parts = easternParts(date);
  const nowMinutes = minutes(parts.hour, parts.minute);
  const todayWindow = onlineOrderingWindow(parts.day);
  const todayStoreWindow = storeWindow(parts.day);
  if (nowMinutes < todayWindow.open) {
    return { label: `today at ${formatBoundaryTime(todayWindow.open)}`, iso: easternWallTimeToISO(parts.year, parts.month, parts.dayOfMonth, todayWindow.open) };
  }
  if (nowMinutes < todayWindow.close) {
    return { label: `today at ${formatBoundaryTime(todayWindow.close)}`, iso: easternWallTimeToISO(parts.year, parts.month, parts.dayOfMonth, todayWindow.close) };
  }
  if (nowMinutes < todayStoreWindow.close) {
    return { label: `today at ${formatBoundaryTime(todayStoreWindow.close)}`, iso: easternWallTimeToISO(parts.year, parts.month, parts.dayOfMonth, todayStoreWindow.close) };
  }
  const next = addDays(parts.year, parts.month, parts.dayOfMonth, 1);
  const nextWindow = onlineOrderingWindow(next.day);
  return { label: `${dayNames[next.day]} at ${formatBoundaryTime(nextWindow.open)}`, iso: easternWallTimeToISO(next.year, next.month, next.dayOfMonth, nextWindow.open) };
}

export function orderingOverrideExpiresAt(mode: OrderingOverrideMode, date = new Date()) {
  if (mode === "normal") return null;
  if (mode === "open" && !isRestaurantOpen(date)) {
    return new Date(date.getTime() + 15 * 60 * 1000).toISOString();
  }
  return nextStoreBoundary(date).iso;
}

export function operationalBoundary(settings: OperationalSettings, date = new Date()) {
  if (settings.orderingOverride.mode !== "normal" && settings.orderingOverride.expiresAt) {
    const expiresAt = new Date(settings.orderingOverride.expiresAt);
    if (!Number.isNaN(expiresAt.getTime())) {
      return { label: formatBoundaryLabel(expiresAt, date), iso: expiresAt.toISOString() };
    }
  }
  return nextStoreBoundary(date);
}

function formatBoundaryTime(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function defaultOperationalSettings(): OperationalSettings {
  return {
    orderingOverride: { mode: "normal", expiresAt: null },
    busyMode: "normal",
    soldOutDate: easternDateKey(),
    soldOutItemIds: []
  };
}

export function normalizeOperationalSettings(value: Partial<OperationalSettings> | null | undefined): OperationalSettings {
  const defaults = defaultOperationalSettings();
  const settings: OperationalSettings = {
    orderingOverride: {
      mode: value?.orderingOverride?.mode ?? defaults.orderingOverride.mode,
      expiresAt: value?.orderingOverride?.expiresAt ?? null
    },
    busyMode: value?.busyMode ?? defaults.busyMode,
    soldOutDate: value?.soldOutDate ?? defaults.soldOutDate,
    soldOutItemIds: Array.isArray(value?.soldOutItemIds) ? value.soldOutItemIds : []
  };

  if (settings.orderingOverride.expiresAt && new Date(settings.orderingOverride.expiresAt).getTime() <= Date.now()) {
    settings.orderingOverride = { mode: "normal", expiresAt: null };
  }
  if (settings.soldOutDate !== easternDateKey()) {
    settings.soldOutDate = easternDateKey();
    settings.soldOutItemIds = [];
  }
  return settings;
}

export async function getOperationalSettings() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return defaultOperationalSettings();
  const { data, error } = await supabase.from("operational_settings").select("value").eq("key", settingsKey).maybeSingle();
  if (error) {
    console.error("[operations] Failed to load settings", { message: error.message, code: error.code });
    return defaultOperationalSettings();
  }
  return normalizeOperationalSettings(data?.value as Partial<OperationalSettings> | null | undefined);
}

export async function saveOperationalSettings(settings: OperationalSettings) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "Supabase is not configured." };
  const { error } = await supabase
    .from("operational_settings")
    .upsert({ key: settingsKey, value: settings, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[operations] Failed to save settings", { message: error.message, code: error.code });
    return { error: error.message };
  }
  const { data, error: readBackError } = await supabase.from("operational_settings").select("value").eq("key", settingsKey).single();
  if (readBackError) {
    console.error("[operations] Failed to read back saved settings", { message: readBackError.message, code: readBackError.code });
    return { error: readBackError.message };
  }
  const savedSettings = normalizeOperationalSettings(data?.value as Partial<OperationalSettings> | null | undefined);
  if (savedSettings.orderingOverride.mode !== settings.orderingOverride.mode) {
    const message = "Operational settings save verification failed.";
    console.error("[operations] Settings save verification mismatch", {
      requestedMode: settings.orderingOverride.mode,
      savedMode: savedSettings.orderingOverride.mode
    });
    return { error: message };
  }
  return { error: null, settings: savedSettings };
}

export function orderingAllowed(settings: OperationalSettings, date = new Date()) {
  if (settings.orderingOverride.mode === "open") return true;
  if (settings.orderingOverride.mode === "paused") return false;
  return isRestaurantOpen(date);
}

export function busyExtraMinutes(mode: BusyMode) {
  if (mode === "very_busy") return 20;
  if (mode === "busy") return 10;
  return 0;
}
