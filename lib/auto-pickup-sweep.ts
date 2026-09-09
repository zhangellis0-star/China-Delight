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
    .select("order_number, status, created_at, scheduled_pickup_time")
    .in("status", activeOrderStatuses)
    .limit(2000);
  if (error) throw error;

  const candidates = ((data ?? []) as AutoPickupOrder[]).filter((order) => isAutoPickupCandidate(order, cutoff));
  if (candidates.length === 0) return { matched: 0, updated: 0, orderNumbers: [] as string[] };

  const orderNumbers = candidates.map((order) => order.order_number);
  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "picked_up", updated_at: new Date().toISOString() })
    .in("order_number", orderNumbers)
    .in("status", activeOrderStatuses)
    .select("order_number, status");
  if (updateError) throw updateError;

  const updatedOrderNumbers = new Set((updated ?? []).map((order) => order.order_number));
  const updatedCandidates = candidates.filter((order) => updatedOrderNumbers.has(order.order_number));
  await Promise.allSettled(
    updatedCandidates.map((order) =>
      updateOrderStatusInGoogleSheets({
        orderNumber: order.order_number,
        oldStatus: order.status,
        newStatus: "picked_up",
        updatedAt: new Date()
      })
    )
  );

  return { matched: candidates.length, updated: updated?.length ?? 0, orderNumbers: [...updatedOrderNumbers] };
}
