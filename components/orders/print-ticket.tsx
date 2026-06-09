"use client";

import { useEffect, useState } from "react";
import { customizationParts } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import type { CartItem, OrderStatus, PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

const alertWords = ["allergy", "allergic", "peanut", "shellfish", "gluten", " no ", "extra", "sauce"];

function hasInstructionAlert(value?: string) {
  if (!value) return false;
  const text = ` ${value.toLowerCase()} `;
  return alertWords.some((word) => text.includes(word));
}

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
  estimated_ready_minutes?: number | null;
  estimated_ready_at?: string | null;
  confirmation_email_sent_at?: string | null;
  confirmation_email_error?: string | null;
  ready_email_sent_at?: string | null;
  ready_email_error?: string | null;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  processing_fee?: number | null;
  tip_amount?: number | null;
  promo_code?: string | null;
  discount_amount?: number | null;
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
    totals: { subtotal: number; discount?: number; tax: number; processingFee?: number; tip?: number; total: number; promoCode?: string | null };
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
    estimated_ready_minutes: null,
    estimated_ready_at: null,
    confirmation_email_sent_at: null,
    confirmation_email_error: null,
    ready_email_sent_at: null,
    ready_email_error: null,
    status: parsed.status,
    subtotal: parsed.totals.subtotal,
    tax: parsed.totals.tax,
    processing_fee: parsed.totals.processingFee ?? 0,
    tip_amount: parsed.totals.tip ?? 0,
    promo_code: parsed.totals.promoCode ?? null,
    discount_amount: parsed.totals.discount ?? 0,
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

  const pickupTime = order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
  const paymentText = order.payment_method === "stripe" ? `Stripe / ${order.payment_status ?? "unpaid"}` : "Pay in store / Pay at pickup";
  const paymentBanner = order.payment_method === "stripe" && order.payment_status === "paid" ? "PAID ONLINE" : "PAY AT PICKUP";

  return (
    <section className="receipt-ticket mx-auto max-w-2xl bg-white px-4 py-8 text-black print:p-0">
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 3mm;
          }
          header,
          footer,
          .no-print {
            display: none !important;
          }
          html,
          body {
            background: white !important;
            color: black !important;
            width: 80mm;
            margin: 0 !important;
          }
          .receipt-ticket {
            width: 74mm !important;
            max-width: 74mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            color: black !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
          .receipt-box {
            border: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .receipt-break {
            border-top: 2px dashed black !important;
          }
          .receipt-item,
          .receipt-line {
            break-inside: avoid;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .receipt-payment {
            border: 3px solid black !important;
            color: black !important;
            background: white !important;
          }
        }
      `}</style>
      <button onClick={() => window.print()} className="no-print mb-6 rounded-md bg-china-red px-5 py-3 font-black text-white">
        Print ticket
      </button>
      <div className="receipt-box border-2 border-black p-5">
        <h1 className="text-center text-2xl font-black print:text-[18pt]">China Delight</h1>
        <p className="mt-1 text-center text-sm font-bold">Kitchen / Pickup Ticket</p>
        <p className="receipt-line mt-3 text-center text-4xl font-black leading-tight print:text-[24pt]">#{order.order_number}</p>
        <p className="receipt-payment mt-3 rounded-md border-4 border-black p-2 text-center text-3xl font-black print:text-[20pt]">{paymentBanner}</p>
        <div className="receipt-break mt-4 grid gap-1 border-y-2 border-black py-3 text-base print:text-[11pt]">
          <p className="receipt-line">
            <strong>Name:</strong> {order.customer_name}
          </p>
          <p className="receipt-line text-2xl font-black print:text-[16pt]">
            <strong>Phone:</strong> {order.customer_phone}
          </p>
          <p className="receipt-line">
            <strong>Pickup:</strong> {pickupTime}
          </p>
          {order.estimated_ready_at && (
            <p className="receipt-line font-black">
              <strong>Ready:</strong> {formatPickupDateTime(order.estimated_ready_at)}
            </p>
          )}
          <p className="receipt-line text-lg font-black">
            <strong>Payment:</strong> {paymentText}
          </p>
          <p className="receipt-line">
            <strong>Status:</strong> {order.status}
          </p>
          {order.customer_notes && (
            <p className={`receipt-line ${hasInstructionAlert(order.customer_notes) ? "border-2 border-black p-2 text-xl font-black print:text-[14pt]" : ""}`}>
              <strong>Order notes:</strong> {order.customer_notes}
            </p>
          )}
        </div>
        <div className="mt-5 grid gap-4">
          {order.order_items.map((item, index) => {
            const alert = hasInstructionAlert(`${customizationParts(item.customization).join(" ")} ${String(item.customization?.notes ?? "")}`);
            return (
            <div key={`${item.item_number}-${index}`} className={`receipt-item border-b border-black pb-3 ${alert ? "border-2 p-2" : ""}`}>
              <p className="receipt-line text-xl font-black leading-tight print:text-[15pt]">
                {item.quantity} x {item.item_number ? `#${item.item_number} ` : ""}{item.item_name}
              </p>
              <p className="receipt-line text-sm font-bold">{formatPrice(item.unit_price)} each</p>
              {customizationParts(item.customization).length > 0 && (
                <div className="mt-1 grid gap-1 text-base print:text-[11pt]">
                  {customizationParts(item.customization).map((part) => (
                    <p key={part} className={`receipt-line ${part.startsWith("Lunch") || part.startsWith("Includes") || part.startsWith("Notes") ? "font-black" : ""}`}>
                      {part}
                    </p>
                  ))}
                  {item.customization?.notes ? <p className="receipt-line font-black">Special instructions: {String(item.customization.notes)}</p> : null}
                </div>
              )}
            </div>
          );
          })}
        </div>
        <div className="receipt-break mt-5 grid gap-1 border-t-2 border-black pt-3 text-right text-base print:text-[11pt]">
          <p className="receipt-line">Subtotal: {formatPrice(order.subtotal)}</p>
          {Number(order.discount_amount ?? 0) > 0 && (
            <p className="receipt-line">Promo discount{order.promo_code ? ` (${order.promo_code})` : ""}: -{formatPrice(Number(order.discount_amount))}</p>
          )}
          <p className="receipt-line">Tax: {formatPrice(order.tax)}</p>
          <p className="receipt-line">Processing fee: {formatPrice(order.processing_fee ?? 0)}</p>
          <p className="receipt-line">Tip: {formatPrice(order.tip_amount ?? 0)}</p>
          <p className="receipt-line text-2xl font-black print:text-[17pt]">Total: {formatPrice(order.total)}</p>
        </div>
      </div>
    </section>
  );
}
