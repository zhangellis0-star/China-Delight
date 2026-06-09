import type { CartItem, MenuItem } from "@/types";

export const lunchAvailabilityMessage = "Lunch specials are available Monday-Saturday, 11:00 AM-3:00 PM.";
export const closedOrderingMessage = "Online ordering is currently closed. The restaurant may still be open for in-person or phone orders.";
export const comboIncludedItems = ["Pork Fried Rice", "Egg Roll"];

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ZonedParts = {
  day: number;
  hour: number;
  minute: number;
};

function easternParts(date = new Date()): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return {
    day: Math.max(0, day),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  };
}

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

function formatTime(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

export function isRestaurantOpen(date = new Date()) {
  const parts = easternParts(date);
  const now = minutes(parts.hour, parts.minute);
  const window = onlineOrderingWindow(parts.day);
  return now >= window.open && now < window.close;
}

export function isStoreOpen(date = new Date()) {
  const parts = easternParts(date);
  const now = minutes(parts.hour, parts.minute);
  const window = storeWindow(parts.day);
  return now >= window.open && now < window.close;
}

export function nextOpeningLabel(date = new Date()) {
  const parts = easternParts(date);
  const now = minutes(parts.hour, parts.minute);
  const today = onlineOrderingWindow(parts.day);
  if (now < today.open) return `Online ordering opens today at ${formatTime(today.open)}.`;

  const nextDay = (parts.day + 1) % 7;
  const next = onlineOrderingWindow(nextDay);
  return `Online ordering opens ${dayNames[nextDay]} at ${formatTime(next.open)}.`;
}

export function isLunchAvailable(date = new Date()) {
  const parts = easternParts(date);
  if (parts.day === 0) return false;
  const now = minutes(parts.hour, parts.minute);
  return now >= minutes(11, 0) && now < minutes(15, 0);
}

export function isLunchItem(item: Pick<MenuItem | CartItem, "category">) {
  return item.category === "Lunch Special";
}

export function isComboItem(item: Pick<MenuItem | CartItem, "category">) {
  return item.category === "Special Combination Platters";
}

export function estimatedPickupWindow(items: Array<Pick<CartItem, "quantity">>) {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return count >= 5 ? "25-35 minutes" : "15-20 minutes";
}

// ---- Customer-facing ready-time messaging ----
// A ready time is only shown once the restaurant accepts the order and sets estimated_ready_at.
export const READY_PENDING_TEXT = "Waiting for restaurant confirmation.";
export const ASAP_PICKUP_NOTE = "ASAP pickup. The restaurant will confirm your ready time.";
export const CONFIRMATION_PENDING_EMAIL_NOTE = "We received your order. You'll receive another update when your pickup time is confirmed.";

// Returns the confirmed ready time (America/New_York) once the restaurant has accepted, else null.
export function confirmedReadyTime(estimatedReadyAt?: string | null) {
  if (!estimatedReadyAt) return null;
  const date = new Date(estimatedReadyAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(date);
}

// ---- Scheduled pickup (America/New_York) ----

const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LUNCH_OPEN = minutes(11, 0);
const LUNCH_CLOSE = minutes(15, 0); // 3:00 PM
const PREP_BUFFER_MINUTES = 15;

export type PickupOption = { value: string; label: string; weekday: number };

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

// Calendar weekday for a Y-M-D date (timezone-independent; uses the date as a pure calendar value).
function weekdayForYmd(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// "Now" expressed as America/New_York calendar + clock parts.
function easternNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

// Allowed pickup dates: today (ET) through the end of next month. Lunch orders exclude Sundays.
export function getPickupDateOptions(now = new Date(), opts: { hasLunchItem?: boolean } = {}): PickupOption[] {
  const today = easternNowParts(now);
  const endMonth = today.month === 12 ? 1 : today.month + 1;
  const endYear = today.month === 12 ? today.year + 1 : today.year;
  const lastDayOfNextMonth = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();

  const options: PickupOption[] = [];
  let cursor = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const end = new Date(Date.UTC(endYear, endMonth - 1, lastDayOfNextMonth));

  let first = true;
  while (cursor.getTime() <= end.getTime()) {
    const cy = cursor.getUTCFullYear();
    const cm = cursor.getUTCMonth() + 1;
    const cd = cursor.getUTCDate();
    const weekday = cursor.getUTCDay();
    if (!opts.hasLunchItem || weekday !== 0) {
      const base = `${dayShort[weekday]}, ${monthShort[cm - 1]} ${cd}`;
      options.push({ value: `${cy}-${pad(cm)}-${pad(cd)}`, label: first ? `Today · ${base}` : base, weekday });
    }
    first = false;
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return options;
}

// 15-minute pickup slots within store hours for a date, honoring lunch window and same-day cutoff.
export function getPickupTimeSlots(dateStr: string, opts: { hasLunchItem?: boolean; now?: Date; allowAfterOnlineCutoff?: boolean } = {}) {
  if (!dateStr) return [] as Array<{ value: string; label: string }>;
  const [year, month, day] = dateStr.split("-").map(Number);
  const weekday = weekdayForYmd(year, month, day);

  // Lunch specials: Monday–Saturday only.
  if (opts.hasLunchItem && weekday === 0) return [];

  const window = opts.allowAfterOnlineCutoff ? storeWindow(weekday) : onlineOrderingWindow(weekday);
  let open = window.open;
  let close = window.close;
  if (opts.hasLunchItem) {
    open = Math.max(open, LUNCH_OPEN);
    close = Math.min(close, LUNCH_CLOSE);
  }

  const now = opts.now ?? new Date();
  const today = easternNowParts(now);
  const isToday = year === today.year && month === today.month && day === today.day;
  let earliest = open;
  if (isToday) {
    const cutoff = minutes(today.hour, today.minute) + PREP_BUFFER_MINUTES;
    earliest = Math.max(open, Math.ceil(cutoff / 15) * 15);
  }

  const slots: Array<{ value: string; label: string }> = [];
  for (let mn = earliest; mn <= close; mn += 15) {
    slots.push({ value: `${pad(Math.floor(mn / 60))}:${pad(mn % 60)}`, label: formatTime(mn) });
  }
  return slots;
}

// Returns an error message if the scheduled date/time is missing or invalid, else null.
export function validateScheduledPickup(dateStr: string, timeStr: string, opts: { hasLunchItem?: boolean; now?: Date; allowAfterOnlineCutoff?: boolean } = {}) {
  if (!dateStr) return "Please choose a pickup date.";
  if (!timeStr) return "Please choose a pickup time.";
  const allowed = getPickupDateOptions(opts.now ?? new Date(), { hasLunchItem: opts.hasLunchItem }).some((option) => option.value === dateStr);
  if (!allowed) {
    return opts.hasLunchItem ? "Lunch specials are only available Monday-Saturday. Please choose another date." : "Please choose a pickup date within the allowed range.";
  }
  const slots = getPickupTimeSlots(dateStr, opts);
  if (slots.length === 0) return "No pickup times available for this date.";
  if (!slots.some((slot) => slot.value === timeStr)) {
    return opts.hasLunchItem ? "Lunch specials are only available 11:00 AM-3:00 PM. Please choose a valid time." : "Please choose a valid pickup time during store hours.";
  }
  return null;
}

export function validateScheduledPickupISO(value: string, opts: { hasLunchItem?: boolean; now?: Date; allowAfterOnlineCutoff?: boolean } = {}) {
  if (!value) return "Please choose a scheduled pickup time.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Please choose a valid pickup time.";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const timeStr = `${get("hour")}:${get("minute")}`;
  return validateScheduledPickup(dateStr, timeStr, opts);
}

// America/New_York offset (ms) at a given instant.
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

// Convert an Eastern wall-clock date+time into a UTC ISO string (DST-aware) for timestamptz storage.
export function buildScheduledPickupISO(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return "";
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = easternOffsetMs(new Date(guess));
  let utc = guess - offset;
  const corrected = easternOffsetMs(new Date(utc));
  if (corrected !== offset) utc = guess - corrected;
  return new Date(utc).toISOString();
}

// Display a stored pickup time (ISO or legacy string) clearly in America/New_York.
export function formatPickupDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}
