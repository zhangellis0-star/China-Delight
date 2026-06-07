import type { CartItem, MenuItem } from "@/types";

export const lunchAvailabilityMessage = "Lunch specials are available Monday-Saturday, 11:00 AM-3:00 PM.";
export const closedOrderingMessage = "China Delight is currently closed. Online ordering is available during store hours.";
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
  const window = storeWindow(parts.day);
  return now >= window.open && now < window.close;
}

export function nextOpeningLabel(date = new Date()) {
  const parts = easternParts(date);
  const now = minutes(parts.hour, parts.minute);
  const today = storeWindow(parts.day);
  if (now < today.open) return `Opens today at ${formatTime(today.open)}.`;

  const nextDay = (parts.day + 1) % 7;
  const next = storeWindow(nextDay);
  return `Next opening: ${dayNames[nextDay]} at ${formatTime(next.open)}.`;
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
