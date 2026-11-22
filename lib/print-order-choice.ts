import { easternDateKey } from "@/lib/operations";
import { activeOrderStatuses } from "@/lib/order-status";

type Candidate = { status: string | null; created_at: string | null };

// The tablet app asks for a ticket by display number, which repeats every day, so several orders
// can match. Printing the wrong one sends the kitchen someone else's food, so this picks an order
// only when the choice is unambiguous:
//   1. exactly one open (new/accepted) order with the number, otherwise
//   2. exactly one order with the number placed today (a reprint), otherwise
//   3. the only order with the number at all.
// Anything else is refused. Printing by order ID needs the rebuilt tablet app.
export function chooseOrderToPrint<T extends Candidate>(matches: T[], now = new Date()): { order: T } | { ambiguous: true } | null {
  if (matches.length === 0) return null;
  const open = matches.filter((order) => activeOrderStatuses.includes(order.status as (typeof activeOrderStatuses)[number]));
  if (open.length === 1) return { order: open[0] };
  if (open.length > 1) return { ambiguous: true };
  const today = easternDateKey(now);
  const placedToday = matches.filter((order) => order.created_at && easternDateKey(new Date(order.created_at)) === today);
  if (placedToday.length === 1) return { order: placedToday[0] };
  if (matches.length === 1) return { order: matches[0] };
  return { ambiguous: true };
}
