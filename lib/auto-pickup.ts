import { activeOrderStatuses } from "@/lib/order-status";
import { easternDateKey } from "@/lib/operations";

export type AutoPickupOrder = {
  order_number: string;
  status: string;
  created_at: string | null;
  scheduled_pickup_time?: string | null;
};

export function easternTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: easternDateKey(now),
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

// The cron runs at 05:00 UTC. On Vercel Hobby it may start at any point in
// the following hour, which is 12:00-12:59 AM EST or 1:00-1:59 AM EDT.
// Both windows must close the previous New York business day.
export function targetBusinessDate(now = new Date()) {
  const { hour } = easternTimeParts(now);
  if (hour < 2) return easternDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  return easternDateKey(now);
}

export function resolveAutoPickupDate(requestedDate: string | null, now = new Date()) {
  return requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : targetBusinessDate(now);
}

export function queryWindowForDateKey(dateKey: string) {
  const noon = new Date(`${dateKey}T12:00:00Z`);
  return {
    start: new Date(noon.getTime() - 36 * 60 * 60 * 1000).toISOString(),
    end: new Date(noon.getTime() + 36 * 60 * 60 * 1000).toISOString()
  };
}

export function isAutoPickupCandidate(order: AutoPickupOrder, date: string) {
  if (!order.created_at || easternDateKey(new Date(order.created_at)) !== date) return false;
  if (!activeOrderStatuses.includes(order.status as (typeof activeOrderStatuses)[number])) return false;
  if (order.scheduled_pickup_time && easternDateKey(new Date(order.scheduled_pickup_time)) > date) return false;
  return true;
}
