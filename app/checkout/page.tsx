"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CreditCard } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";
import type { CheckoutCustomer } from "@/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const totals = calculateCart(items);
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CheckoutCustomer>({
    name: "",
    phone: "",
    email: "",
    fulfillment: "pickup",
    address: "",
    notes: "",
    paymentMethod: "pay_at_pickup",
    pickupTimeType: "asap",
    scheduledPickupTime: ""
  });

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    setLoading(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items, totals })
    });
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      alert(data.error ?? "Could not place the order. Please call the restaurant.");
      return;
    }
    if (!data.supabaseSaved) {
      console.warn("[checkout] Order confirmation is using localStorage fallback", {
        orderNumber: data.orderNumber,
        supabaseError: data.supabaseError ?? null
      });
    }
    window.localStorage.setItem("china-delight-last-order", JSON.stringify({ orderNumber: data.orderNumber, customer, items, totals, status: "new" }));
    if (data.checkoutUrl) {
      // Keep the cart intact until payment completes; the confirmation page clears it.
      window.location.href = data.checkoutUrl;
    } else {
      clearCart();
      router.push(`/confirmation?order=${data.orderNumber}`);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black">Checkout</h1>
      <form onSubmit={submitOrder} className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              Name
              <input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
            <label className="grid gap-1 font-bold">
              Phone
              <input required value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
            <label className="grid gap-1 font-bold sm:col-span-2">
              Email optional
              <input type="email" value={customer.email ?? ""} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
          </div>

          <div>
            <p className="font-black">Pickup or delivery</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["pickup", "delivery"] as const).map((value) => (
                <label key={value} className={`rounded-md border p-4 font-black ${customer.fulfillment === value ? "border-china-red bg-red-50 text-china-red" : "border-stone-300"}`}>
                  <input className="mr-2" type="radio" checked={customer.fulfillment === value} onChange={() => setCustomer({ ...customer, fulfillment: value })} />
                  {value === "pickup" ? "Pickup" : "Delivery"}
                </label>
              ))}
            </div>
          </div>

          {customer.fulfillment === "delivery" && (
            <label className="grid gap-1 font-bold">
              Delivery address
              <textarea required value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} className="focus-ring min-h-24 rounded-md border border-stone-300 p-3" />
            </label>
          )}

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <Clock className="h-5 w-5 text-china-red" />
              Pickup time
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(["asap", "scheduled"] as const).map((value) => (
                <label key={value} className={`rounded-md border p-3 font-black ${customer.pickupTimeType === value ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                  <input className="mr-2" type="radio" checked={customer.pickupTimeType === value} onChange={() => setCustomer({ ...customer, pickupTimeType: value })} />
                  {value === "asap" ? "ASAP" : "Scheduled pickup time"}
                </label>
              ))}
            </div>
            {customer.pickupTimeType === "scheduled" && (
              <input
                required
                type="datetime-local"
                value={customer.scheduledPickupTime}
                onChange={(event) => setCustomer({ ...customer, scheduledPickupTime: event.target.value })}
                className="focus-ring mt-3 h-12 w-full rounded-md border border-stone-300 bg-white px-3"
              />
            )}
          </div>

          <label className="grid gap-1 font-bold">
            Order notes
            <textarea value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} className="focus-ring min-h-24 rounded-md border border-stone-300 p-3" placeholder="Pickup time, delivery directions, allergy notes..." />
          </label>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <CreditCard className="h-5 w-5 text-china-red" />
              Payment
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className={`rounded-md border p-3 font-black ${customer.paymentMethod === "pay_at_pickup" ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                <input className="mr-2" type="radio" checked={customer.paymentMethod === "pay_at_pickup"} onChange={() => setCustomer({ ...customer, paymentMethod: "pay_at_pickup" })} />
                Pay at pickup / cash
              </label>
              <label className={`rounded-md border p-3 font-black ${customer.paymentMethod === "stripe" ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                <input className="mr-2" type="radio" checked={customer.paymentMethod === "stripe"} onChange={() => setCustomer({ ...customer, paymentMethod: "stripe" })} />
                Pay online with Stripe
              </label>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-700">Stripe Checkout opens only when online payment is selected and Stripe keys are configured.</p>
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-warm">
          <h2 className="text-2xl font-black">Review</h2>
          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <div key={item.cartId} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.quantity} x {item.name}
                </span>
                <span className="font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatPrice(totals.tax)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black">
              <span>Total</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
          </div>
          <button disabled={loading || items.length === 0} className="focus-ring mt-6 min-h-12 w-full rounded-md bg-china-red px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
            {loading ? "Placing order..." : "Place order"}
          </button>
        </aside>
      </form>
    </section>
  );
}
