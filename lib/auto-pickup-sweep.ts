import { isAutoPickupCandidate, type AutoPickupOrder } from "@/lib/auto-pickup";
import { updateOrderStatusInGoogleSheets } from "@/lib/google-sheets";
import { activeOrderStatuses } from "@/lib/order-status";
import type { getSupabaseAdmin } from "@/lib/supabase-server";

// Shared by the daily cron backup (app/api/admin/auto-pickup) and the live, hours-driven trigger
// (app/api/orders GET, called on every admin poll while the store is closed) — see
// lib/auto-pickup.ts for why the cutoff itself is never a fixed clock time.
export async function runAutoPickupSweep(supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>, cutoff: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, scheduled_pickup_time")
    .in("status", activeOrderStatuses)
    .limit(2000);
  if (error) throw error;

  const candidates = ((data ?? []) as Array<AutoPickupOrder & { id: string }>).filter((order) => isAutoPickupCandidate(order, cutoff));
  if (candidates.length === 0) return { matched: 0, updated: 0, orderNumbers: [] as string[] };

  // Update by row id. order_number repeats every day, so updating by number would also close any
  // other open order that shares it, such as one scheduled for a later day.
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "picked_up", updated_at: new Date().toISOString() })
    .in("id", candidates.map((order) => order.id))
    .in("status", activeOrderStatuses)
    .select("id");
  if (updateError) throw updateError;

  const updatedIds = new Set((updated ?? []).map((order) => order.id as string));
  const updatedCandidates = candidates.filter((order) => updatedIds.has(order.id));
  await Promise.allSettled(
    updatedCandidates.map((order) =>
      updateOrderStatusInGoogleSheets({
        orderId: order.id,
        orderNumber: order.order_number,
        createdAt: order.created_at ? new Date(order.created_at) : undefined,
        oldStatus: order.status,
        newStatus: "picked_up",
        updatedAt: new Date()
      })
    )
  );

  return { matched: candidates.length, updated: updatedCandidates.length, orderNumbers: updatedCandidates.map((order) => order.order_number) };
}
