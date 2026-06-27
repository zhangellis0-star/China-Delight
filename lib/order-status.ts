import type { OrderStatus } from "@/types";

export type LegacyOrderStatus = "preparing" | "ready" | "completed" | "cancelled";
export type AnyOrderStatus = OrderStatus | LegacyOrderStatus | string;

export const activeOrderStatuses: OrderStatus[] = ["new", "accepted"];
export const finalOrderStatuses: OrderStatus[] = ["picked_up"];
export const editableOrderStatuses: OrderStatus[] = ["new", "accepted", "picked_up"];

export function normalizeOrderStatus(status: AnyOrderStatus | null | undefined): OrderStatus {
  if (status === "new" || status === "accepted") return status;
  return "picked_up";
}

export function orderStatusLabel(status: AnyOrderStatus | null | undefined) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "new") return "New";
  if (normalized === "accepted") return "Accepted";
  return "Picked Up";
}
