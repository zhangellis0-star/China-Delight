import { isPastClosingTime } from "@/lib/order-rules";
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

// Whether today's orders should already be included in the sweep: only once the store's actual
// hours (see lib/order-rules.ts storeWindow — these vary by day: 10pm Mon-Thu/Sun, 10:30pm
// Fri-Sat) say it's currently closed. This is deliberately the physical store hours, not the
// earlier online-ordering cutoff, since a customer can still be picking up an already-placed
// order right up until the store itself closes. Today is included only once today's closing time
// has passed. Before opening (including the midnight cron, which runs on the new date) the store
// is also closed, but today has not happened yet: including it would close every order scheduled
// for later today before the kitchen ever saw it.
export function currentAutoPickupCutoff(now = new Date()) {
  const today = easternDateKey(now);
  return isPastClosingTime(now) ? addEasternDays(today, 1) : today;
}

// The cutoff is exclusive: an order is only closed once its entire business date (creation AND
// any scheduled pickup) is strictly before this date. There is no fixed clock time baked in
// anywhere — this is driven entirely by the store's real, day-varying hours (currentAutoPickupCutoff
// above), checked live every time this runs. That makes the close-out automatically robust to
// being checked at any moment: whenever it runs, it reflects whatever "closed" actually means
// right now, so a missed check, a delayed cron, or a skipped day all self-correct the next time
// something calls this instead of only ever handling one exact pre-computed calendar day.
// A manually supplied `date` (admin testing/backfill) closes out that day and everything before
// it, by using the following day as the exclusive cutoff.
export function resolveAutoPickupCutoff(requestedDate: string | null, now = new Date()) {
  if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return addEasternDays(requestedDate, 1);
  return currentAutoPickupCutoff(now);
}

export function isAutoPickupCandidate(order: AutoPickupOrder, cutoffDateExclusive: string) {
  if (!order.created_at || easternDateKey(new Date(order.created_at)) >= cutoffDateExclusive) return false;
  if (!activeOrderStatuses.includes(order.status as (typeof activeOrderStatuses)[number])) return false;
  if (order.scheduled_pickup_time && easternDateKey(new Date(order.scheduled_pickup_time)) >= cutoffDateExclusive) return false;
  return true;
}
