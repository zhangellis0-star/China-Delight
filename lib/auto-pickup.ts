import { activeOrderStatuses } from "@/lib/order-status";
import { easternDateKey } from "@/lib/operations";

export type AutoPickupOrder = {
  order_number: string;
  status: string;
  created_at: string | null;
  scheduled_pickup_time?: string | null;
};

// Add days to a "YYYY-MM-DD" Eastern date key. Anchoring on UTC noon (never near a DST
// transition) avoids wall-clock edge cases when re-deriving the Eastern date.
export function addEasternDays(dateKey: string, days: number) {
  const noon = new Date(`${dateKey}T12:00:00Z`);
  return easternDateKey(new Date(noon.getTime() + days * 24 * 60 * 60 * 1000));
}

// The cutoff is exclusive: an order is only closed once its entire business date (creation AND
// any scheduled pickup) is strictly before this date. The daily cron passes no `date`, so the
// cutoff is always "today" — sweeping every order left over from yesterday and any earlier day
// that was somehow missed. This makes the close-out robust to the cron firing late, being
// delayed by the platform, or even skipping a day outright: whenever it next runs, it fully
// catches up instead of only ever handling one exact calendar day (the previous design compared
// against a single computed "target date" and silently missed everything else if that guess was
// wrong or the cron didn't fire in the expected hour).
// A manually supplied `date` (admin testing/backfill) closes out that day and everything before
// it, by using the following day as the exclusive cutoff.
export function resolveAutoPickupCutoff(requestedDate: string | null, now = new Date()) {
  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return addEasternDays(requestedDate, 1);
  return easternDateKey(now);
}

export function isAutoPickupCandidate(order: AutoPickupOrder, cutoffDateExclusive: string) {
  if (!order.created_at || easternDateKey(new Date(order.created_at)) >= cutoffDateExclusive) return false;
  if (!activeOrderStatuses.includes(order.status as (typeof activeOrderStatuses)[number])) return false;
  if (order.scheduled_pickup_time && easternDateKey(new Date(order.scheduled_pickup_time)) >= cutoffDateExclusive) return false;
  return true;
}
