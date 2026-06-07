"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatPrice } from "@/lib/pricing";
import { useCart } from "@/components/cart/cart-provider";
import type { CartItem, CheckoutCustomer } from "@/types";

type LastOrder = {
  orderNumber: string;
  customer: CheckoutCustomer;
  items: CartItem[];
  totals: { subtotal: number; tax: number; total: number };
};

type SupabaseConfirmationOrder = {
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_notes?: string | null;
  payment_method: "stripe" | "pay_at_pickup";
  pickup_time_type: "asap" | "scheduled";
  scheduled_pickup_time?: string | null;
  subtotal: number;
  tax: number;
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
  return customer.pickupTimeType === "scheduled" && customer.scheduledPickupTime ? new Date(customer.scheduledPickupTime).toLocaleString() : "ASAP";
}

function supabasePickupTime(order: SupabaseConfirmationOrder) {
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? new Date(order.scheduled_pickup_time).toLocaleString() : "ASAP";
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
            <strong>Payment:</strong> {supabaseOrder.payment_method === "stripe" ? "Paid online / Stripe" : "Pay at pickup / cash"}
          </p>
          <p>
            <strong>Pickup time:</strong> {supabasePickupTime(supabaseOrder)}
          </p>
          <div>
            <strong>Items:</strong>
            <div className="mt-2 grid gap-2">
              {supabaseOrder.order_items.map((item, index) => (
                <div key={`${item.item_number}-${index}`} className="flex justify-between gap-3 rounded-md bg-china-paper p-3">
                  <span>
                    {item.quantity} x #{item.item_number} {item.item_name}
                  </span>
                  <span className="font-bold">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-right text-2xl font-black">Total: {formatPrice(supabaseOrder.total)}</p>
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
          <div>
            <strong>Items:</strong>
            <div className="mt-2 grid gap-2">
              {lastOrder.items.map((item) => (
                <div key={item.cartId} className="flex justify-between gap-3 rounded-md bg-china-paper p-3">
                  <span>
                    {item.quantity} x #{item.number} {item.name}
                  </span>
                  <span className="font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-right text-2xl font-black">Total: {formatPrice(lastOrder.totals.total)}</p>
        </div>
      ) : null}
    </div>
  );
}
