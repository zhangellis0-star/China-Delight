"use client";

import { useEffect, useState } from "react";
import { customizationParts } from "@/lib/order-display";
import { estimatedPickupWindow } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import type { CartItem, OrderStatus, PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

type TicketOrder = {
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  customer_notes?: string | null;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  pickup_time_type?: PickupTimeType;
  scheduled_pickup_time?: string | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  processing_fee?: number | null;
  total: number;
  order_items: Array<{
    item_number: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown>;
  }>;
};

function localTicket(orderNumber: string): TicketOrder | null {
  const saved = window.localStorage.getItem("china-delight-last-order");
  if (!saved) return null;
  const parsed = JSON.parse(saved) as {
    orderNumber: string;
    customer: { name: string; phone: string; email?: string; notes?: string; paymentMethod?: PaymentMethod; pickupTimeType?: PickupTimeType; scheduledPickupTime?: string };
    items: CartItem[];
    totals: { subtotal: number; tax: number; processingFee?: number; total: number };
    status: OrderStatus;
  };
  if (parsed.orderNumber !== orderNumber) return null;
  return {
    order_number: parsed.orderNumber,
    customer_name: parsed.customer.name,
    customer_phone: parsed.customer.phone,
    customer_email: parsed.customer.email,
    customer_notes: parsed.customer.notes,
    payment_method: parsed.customer.paymentMethod,
    payment_status: "unpaid",
    pickup_time_type: parsed.customer.pickupTimeType,
    scheduled_pickup_time: parsed.customer.scheduledPickupTime,
    status: parsed.status,
    subtotal: parsed.totals.subtotal,
    tax: parsed.totals.tax,
    processing_fee: parsed.totals.processingFee ?? 0,
    total: parsed.totals.total,
    order_items: parsed.items.map((item) => ({
      item_number: item.number,
      item_name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      customization: item.customization
    }))
  };
}

export function PrintTicket({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<TicketOrder | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/orders?q=${encodeURIComponent(orderNumber)}`);
      const data = await response.json();
      const found = (data.orders ?? []).find((candidate: TicketOrder) => candidate.order_number === orderNumber) ?? localTicket(orderNumber);
      setOrder(found ?? null);
    }
    load();
  }, [orderNumber]);

  if (!order) return <section className="mx-auto max-w-2xl px-4 py-10 font-bold">Order not found.</section>;

  const pickupTime = order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? new Date(order.scheduled_pickup_time).toLocaleString() : "ASAP";
  const paymentText = order.payment_method === "stripe" ? `Stripe / ${order.payment_status ?? "unpaid"}` : "Pay at pickup / cash";

  return (
    <section className="mx-auto max-w-2xl bg-white px-4 py-8 text-black print:max-w-none print:p-0">
      <style jsx global>{`
        @media print {
          header,
          footer,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
      <button onClick={() => window.print()} className="no-print mb-6 rounded-md bg-china-red px-5 py-3 font-black text-white">
        Print ticket
      </button>
      <div className="border-2 border-black p-5">
        <h1 className="text-center text-3xl font-black">China Delight</h1>
        <p className="mt-2 text-center text-5xl font-black">Order {order.order_number}</p>
        <div className="mt-5 grid gap-1 border-y-2 border-black py-3 text-lg">
          <p>
            <strong>Name:</strong> {order.customer_name}
          </p>
          <p>
            <strong>Phone:</strong> {order.customer_phone}
          </p>
          <p>
            <strong>Pickup:</strong> {pickupTime}
          </p>
          <p>
            <strong>Estimate:</strong> {estimatedPickupWindow(order.order_items)}
          </p>
          <p>
            <strong>Payment:</strong> {paymentText}
          </p>
          <p>
            <strong>Status:</strong> {order.status}
          </p>
          {order.customer_notes && (
            <p>
              <strong>Order notes:</strong> {order.customer_notes}
            </p>
          )}
        </div>
        <div className="mt-5 grid gap-4">
          {order.order_items.map((item, index) => (
            <div key={`${item.item_number}-${index}`} className="border-b border-black pb-3">
              <p className="text-xl font-black">
                {item.quantity} x #{item.item_number} {item.item_name}
              </p>
              {customizationParts(item.customization).length > 0 && (
                <div className="mt-1 grid gap-1 text-lg">
                  {customizationParts(item.customization).map((part) => (
                    <p key={part} className={part.startsWith("Lunch") || part.startsWith("Includes") || part.startsWith("Notes") ? "font-black" : ""}>
                      {part}
                    </p>
                  ))}
                  {item.customization?.notes ? <p className="font-black">Special instructions: {String(item.customization.notes)}</p> : null}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 grid gap-1 text-right text-lg">
          <p>Subtotal: {formatPrice(order.subtotal)}</p>
          <p>Tax: {formatPrice(order.tax)}</p>
          <p>Processing fee: {formatPrice(order.processing_fee ?? 0)}</p>
          <p className="text-2xl font-black">Total: {formatPrice(order.total)}</p>
        </div>
      </div>
    </section>
  );
}
