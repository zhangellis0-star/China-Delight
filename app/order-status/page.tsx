"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import type { OrderStatus, PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

type LookupOrder = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  pickupTimeType?: PickupTimeType;
  scheduledPickupTime?: string | null;
  estimatedPickup: string;
  total?: number;
};

const statusLabels: Record<OrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled"
};

export default function OrderStatusPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<LookupOrder | null>(null);

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOrder(null);

    const response = await fetch("/api/order-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, phone })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not find that order.");
      return;
    }
    setOrder(data.order);
  }

  const pickupLabel = order?.pickupTimeType === "scheduled" && order.scheduledPickupTime ? new Date(order.scheduledPickupTime).toLocaleString() : "ASAP";

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="font-black uppercase tracking-[0.16em] text-china-red">Order status</p>
      <h1 className="mt-2 text-3xl font-black sm:text-4xl">Check your order</h1>
      <p className="mt-3 leading-7 text-stone-700">Enter your order number and phone number. We only show orders that match both.</p>

      <form onSubmit={lookup} className="mt-6 grid gap-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <label className="grid gap-1 font-bold">
          Order number
          <input required value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="CD-123456-ABC" className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
        </label>
        <label className="grid gap-1 font-bold">
          Phone number
          <input required value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
        </label>
        {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 font-bold text-china-red">{error}</p>}
        <button disabled={loading} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-china-red px-5 py-3 font-black text-white disabled:bg-stone-400">
          <Search className="h-5 w-5" />
          {loading ? "Checking..." : "Check status"}
        </button>
      </form>

      {order && (
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-warm">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-china-red">{order.orderNumber}</p>
          <p className="mt-2 text-3xl font-black">{statusLabels[order.status]}</p>
          <div className="mt-4 grid gap-2 text-stone-700">
            <p>
              <strong>Pickup:</strong> {pickupLabel}
            </p>
            <p>
              <strong>Estimated pickup:</strong> {order.estimatedPickup}
            </p>
            <p>
              <strong>Payment:</strong> {order.paymentMethod === "stripe" ? `Stripe / ${order.paymentStatus ?? "unpaid"}` : "Pay at pickup / cash"}
            </p>
            {typeof order.total === "number" && (
              <p>
                <strong>Total:</strong> {formatPrice(order.total)}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
