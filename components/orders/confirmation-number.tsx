"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { customizationText } from "@/lib/order-display";
import { ASAP_PICKUP_NOTE, READY_PENDING_TEXT, confirmedReadyTime, formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import { restaurant } from "@/lib/restaurant";
import { useCart } from "@/components/cart/cart-provider";
import type { CartItem, CheckoutCustomer, PaymentStatus } from "@/types";

type LastOrder = {
  orderNumber: string;
  customer: CheckoutCustomer;
  items: CartItem[];
  totals: { subtotal: number; tax: number; processingFee?: number; tip?: number; total: number };
};

type SupabaseConfirmationOrder = {
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_notes?: string | null;
  payment_method: "stripe" | "pay_at_pickup";
  payment_status?: PaymentStatus;
  pickup_time_type: "asap" | "scheduled";
  scheduled_pickup_time?: string | null;
  estimated_ready_minutes?: number | null;
  estimated_ready_at?: string | null;
  subtotal: number;
  tax: number;
  processing_fee?: number | null;
  tip_amount?: number | null;
  total: number;
  order_items: Array<{
    item_number: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown>;
  }>;
};

function pickupTime(customer: CheckoutCustomer) {
  return customer.pickupTimeType === "scheduled" && customer.scheduledPickupTime ? formatPickupDateTime(customer.scheduledPickupTime) : ASAP_PICKUP_NOTE;
}

function supabasePickupTime(order: SupabaseConfirmationOrder) {
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? formatPickupDateTime(order.scheduled_pickup_time) : ASAP_PICKUP_NOTE;
}

// Ready time is shown only after the restaurant accepts and sets estimated_ready_at.
function readyLabel(order: { estimated_ready_at?: string | null }) {
  return confirmedReadyTime(order.estimated_ready_at) ?? READY_PENDING_TEXT;
}

export function ConfirmationNumber() {
  const params = useSearchParams();
  const orderNumber = params.get("order") ?? "Pending";
  const { clearCart } = useCart();
  const clearedRef = useRef(false);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [supabaseOrder, setSupabaseOrder] = useState<SupabaseConfirmationOrder | null>(null);

  useEffect(() => {
    // Reaching the confirmation page means the order is placed (cash) or paid (Stripe redirect back) — safe to empty the cart once.
    if (clearedRef.current) return;
    if (orderNumber && orderNumber !== "Pending") {
      clearedRef.current = true;
      clearCart();
    }
  }, [orderNumber, clearCart]);

  useEffect(() => {
    async function loadSupabaseOrder() {
      if (!orderNumber || orderNumber === "Pending") return;
      const response = await fetch(`/api/order-confirmation/${encodeURIComponent(orderNumber)}`);
      if (!response.ok) return;
      const data = (await response.json()) as { order: SupabaseConfirmationOrder | null };
      if (data.order) setSupabaseOrder(data.order);
    }

    loadSupabaseOrder();

    const saved = window.localStorage.getItem("china-delight-last-order");
    if (!saved) return;
    const parsed = JSON.parse(saved) as LastOrder;
    if (parsed.orderNumber === orderNumber) setLastOrder(parsed);
  }, [orderNumber]);

  return (
    <div className="mt-3 rounded-lg bg-white p-5 text-left shadow-warm">
      <p className="text-center text-4xl font-black text-china-red">{orderNumber}</p>
      {supabaseOrder ? (
        <div className="mt-5 grid gap-3 text-stone-800">
          <p>
            <strong>Customer:</strong> {supabaseOrder.customer_name}
          </p>
          <p>
            <strong>Payment:</strong> {supabaseOrder.payment_method === "stripe" ? `Stripe / ${supabaseOrder.payment_status ?? "unpaid"}` : "Pay at pickup / cash"}
          </p>
          <p>
            <strong>Pickup time:</strong> {supabasePickupTime(supabaseOrder)}
          </p>
          <p>
            <strong>Ready time:</strong> {readyLabel(supabaseOrder)}
          </p>
          <p className="rounded-md bg-china-paper p-3 text-sm font-bold text-stone-700">
            {supabaseOrder.pickup_time_type !== "scheduled" && !confirmedReadyTime(supabaseOrder.estimated_ready_at) ? `${ASAP_PICKUP_NOTE} ` : ""}You'll receive an email when your order is ready for pickup.
          </p>
          <div>
            <strong>Items:</strong>
            <div className="mt-2 grid gap-2">
              {supabaseOrder.order_items.map((item, index) => (
                <div key={`${item.item_number}-${index}`} className="flex flex-col justify-between gap-2 rounded-md bg-china-paper p-3 sm:flex-row">
                  <span>
                    {item.quantity} x #{item.item_number} {item.item_name}
                    {customizationText(item.customization) && <span className="block text-sm text-stone-600">{customizationText(item.customization)}</span>}
                    {item.customization?.notes ? <span className="block text-sm font-bold text-stone-700">Notes: {String(item.customization.notes)}</span> : null}
                  </span>
                  <span className="font-bold">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-1 border-t border-stone-200 pt-3 text-right">
            <p>Subtotal: {formatPrice(supabaseOrder.subtotal)}</p>
            <p>Tax: {formatPrice(supabaseOrder.tax)}</p>
            <p>Processing fee: {formatPrice(supabaseOrder.processing_fee ?? 0)}</p>
            <p>Tip: {formatPrice(supabaseOrder.tip_amount ?? 0)}</p>
            <p className="text-2xl font-black">Total: {formatPrice(supabaseOrder.total)}</p>
          </div>
          <div className="rounded-md bg-red-50 p-3 text-sm font-bold text-china-red">
            Call us if you need to change your order: {restaurant.phone}. {restaurant.address}.
          </div>
        </div>
      ) : lastOrder ? (
        <div className="mt-5 grid gap-3 text-stone-800">
          <p>
            <strong>Customer:</strong> {lastOrder.customer.name}
          </p>
          <p>
            <strong>Payment:</strong> {lastOrder.customer.paymentMethod === "stripe" ? "Paid online / Stripe" : "Pay at pickup / cash"}
          </p>
          <p>
            <strong>Pickup time:</strong> {pickupTime(lastOrder.customer)}
          </p>
          <p>
            <strong>Ready time:</strong> {READY_PENDING_TEXT}
          </p>
          <p className="rounded-md bg-china-paper p-3 text-sm font-bold text-stone-700">
            {lastOrder.customer.pickupTimeType !== "scheduled" ? `${ASAP_PICKUP_NOTE} ` : ""}You'll receive an email when your order is ready for pickup.
          </p>
          <div>
            <strong>Items:</strong>
            <div className="mt-2 grid gap-2">
              {lastOrder.items.map((item) => (
                <div key={item.cartId} className="flex flex-col justify-between gap-2 rounded-md bg-china-paper p-3 sm:flex-row">
                  <span>
                    {item.quantity} x #{item.number} {item.name}
                    {customizationText(item.customization) && <span className="block text-sm text-stone-600">{customizationText(item.customization)}</span>}
                    {item.customization.notes ? <span className="block text-sm font-bold text-stone-700">Notes: {item.customization.notes}</span> : null}
                  </span>
                  <span className="font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-1 border-t border-stone-200 pt-3 text-right">
            <p>Subtotal: {formatPrice(lastOrder.totals.subtotal)}</p>
            <p>Tax: {formatPrice(lastOrder.totals.tax)}</p>
            <p>Processing fee: {formatPrice(lastOrder.totals.processingFee ?? 0)}</p>
            <p>Tip: {formatPrice(lastOrder.totals.tip ?? 0)}</p>
            <p className="text-2xl font-black">Total: {formatPrice(lastOrder.totals.total)}</p>
          </div>
          <div className="rounded-md bg-red-50 p-3 text-sm font-bold text-china-red">
            Call us if you need to change your order: {restaurant.phone}. {restaurant.address}.
          </div>
        </div>
      ) : null}
    </div>
  );
}
