"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Printer, RefreshCw, Search, Volume2, VolumeX } from "lucide-react";
import { customizationText } from "@/lib/order-display";
import { estimatedPickupWindow } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import type { CartItem, OrderStatus, PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

type AdminOrder = {
  id?: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  fulfillment_type: string;
  delivery_address?: string | null;
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
  total: number;
  created_at?: string;
  order_items: Array<{
    item_number: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown>;
  }>;
};

const statuses: Array<OrderStatus | "all"> = ["all", "new", "accepted", "preparing", "ready", "completed", "cancelled"];
const quickStatuses: OrderStatus[] = ["preparing", "ready", "completed", "cancelled"];
const readyMinuteOptions = [10, 15, 20, 25, 30, 35, 45];
const statusStyles: Record<OrderStatus, string> = {
  new: "bg-red-100 text-china-red border-red-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-amber-100 text-amber-900 border-amber-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  completed: "bg-stone-100 text-stone-700 border-stone-200",
  cancelled: "bg-zinc-200 text-zinc-800 border-zinc-300"
};

function paymentLabel(method?: PaymentMethod, status?: PaymentStatus) {
  if (method !== "stripe") return "Pay at pickup / cash";
  if (status === "paid") return "Stripe - Paid";
  if (status === "failed") return "Stripe - Payment failed";
  if (status === "refunded") return "Stripe - Refunded";
  return "Stripe - Awaiting payment";
}

function pickupLabel(order: AdminOrder) {
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? new Date(order.scheduled_pickup_time).toLocaleString() : "ASAP";
}

function readyLabel(order: AdminOrder) {
  if (order.estimated_ready_at) return new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (order.estimated_ready_minutes) return `${order.estimated_ready_minutes} minutes`;
  return estimatedPickupWindow(order.order_items);
}

function normalizeLocalOrder(saved: string | null): AdminOrder[] {
  if (!saved) return [];
  const parsed = JSON.parse(saved) as {
    orderNumber: string;
    customer: {
      name: string;
      phone: string;
      email?: string;
      fulfillment: string;
      address?: string;
      notes?: string;
      paymentMethod?: PaymentMethod;
      pickupTimeType?: PickupTimeType;
      scheduledPickupTime?: string;
    };
    items: CartItem[];
    totals: { subtotal: number; tax: number; processingFee?: number; tip?: number; total: number };
    status: OrderStatus;
  };
  return [
    {
      order_number: parsed.orderNumber,
      customer_name: parsed.customer.name,
      customer_phone: parsed.customer.phone,
      customer_email: parsed.customer.email,
      fulfillment_type: parsed.customer.fulfillment,
      delivery_address: parsed.customer.address,
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
      total: parsed.totals.total,
      order_items: parsed.items.map((item) => ({
        item_number: item.number,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        customization: item.customization
      }))
    }
  ];
}

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [readyMinutes, setReadyMinutes] = useState<Record<string, string>>({});
  const [customReadyMinutes, setCustomReadyMinutes] = useState<Record<string, string>>({});
  const previousNewOrders = useRef<Set<string>>(new Set());
  const updatingOrdersRef = useRef<Set<string>>(new Set());

  function playNewOrderSound() {
    if (muted || !audioUnlocked) return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  }

  function toggleMute() {
    setAudioUnlocked(true);
    setMuted((current) => !current);
  }

  const loadOrders = useCallback(
    async (options: { manual?: boolean } = {}) => {
      if (updatingOrdersRef.current.size > 0) {
        if (options.manual) setRefreshError("Finish saving the status change before refreshing.");
        return;
      }
      setRefreshing(true);
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      try {
        const response = await fetch(`/api/orders?${params.toString()}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to refresh orders.");
        const localOrders = normalizeLocalOrder(window.localStorage.getItem("china-delight-last-order"));
        const nextOrders = [...(data.orders ?? []), ...localOrders].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        const nextNew = new Set(nextOrders.filter((order) => order.status === "new").map((order) => order.order_number));
        const hasFreshNew = [...nextNew].some((orderNumber) => !previousNewOrders.current.has(orderNumber));
        if (hasFreshNew && previousNewOrders.current.size > 0) playNewOrderSound();
        previousNewOrders.current = nextNew;
        setOrders(nextOrders);
        setLastUpdated(new Date());
        setRefreshError(null);
      } catch {
        setRefreshError("Orders could not refresh. Please try again.");
      } finally {
        setRefreshing(false);
      }
    },
    [query, status, muted, audioUnlocked]
  );

  useEffect(() => {
    loadOrders();
    const timer = window.setInterval(loadOrders, 15000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = status === "all" || order.status === status;
      const text = `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase();
      return matchesStatus && (!normalized || text.includes(normalized));
    });
  }, [orders, query, status]);

  function selectedReadyMinutes(orderNumber: string) {
    const choice = readyMinutes[orderNumber] ?? "20";
    const value = choice === "custom" ? Number(customReadyMinutes[orderNumber]) : Number(choice);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 20;
  }

  async function updateStatus(orderNumber: string, nextStatus: OrderStatus, estimatedReadyMinutes?: number) {
    updatingOrdersRef.current = new Set(updatingOrdersRef.current).add(orderNumber);
    setUpdatingOrders(new Set(updatingOrdersRef.current));
    setOrders((current) => current.map((order) => (order.order_number === orderNumber ? { ...order, status: nextStatus } : order)));
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, status: nextStatus, estimatedReadyMinutes })
      });
      if (!response.ok) throw new Error("Status update failed.");
      setRefreshError(null);
    } catch {
      setRefreshError("Status could not be saved. Please refresh and try again.");
    } finally {
      const nextUpdating = new Set(updatingOrdersRef.current);
      nextUpdating.delete(orderNumber);
      updatingOrdersRef.current = nextUpdating;
      setUpdatingOrders(nextUpdating);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-black uppercase tracking-[0.16em] text-china-red">Admin</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Orders dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <p className="rounded-md bg-white px-4 py-3 font-bold text-stone-700 shadow-sm">{visible.length} visible orders</p>
          <button
            onClick={() => loadOrders({ manual: true })}
            disabled={refreshing || updatingOrders.size > 0}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-3 font-bold text-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh now
          </button>
          <button onClick={toggleMute} className="focus-ring inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-3 font-bold text-stone-700">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            {muted ? "Unmute" : "Mute"}
          </button>
          <button onClick={logout} className="focus-ring rounded-md border border-stone-300 bg-white px-4 py-3 font-bold text-stone-700">
            Sign out
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-sm font-bold text-stone-600 sm:flex-row sm:flex-wrap sm:items-center">
        <span>Auto-refreshing every 15 seconds.</span>
        <span>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading latest orders..."}</span>
        {refreshError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{refreshError}</span>}
      </div>

      <div className="mt-6 grid gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_240px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, order number, or item" className="focus-ring h-14 w-full rounded-md border border-stone-300 pl-12 pr-4 text-lg" />
        </label>
        <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "all")} className="focus-ring h-14 rounded-md border border-stone-300 px-4 text-lg font-bold">
          {statuses.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All statuses" : value}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {statuses.map((value) => (
          <button
            key={value}
            onClick={() => setStatus(value)}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-4 py-2 font-black ${
              status === value ? "border-china-red bg-china-red text-white" : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4">
        {visible.map((order) => (
          <article key={order.order_number} className={`rounded-lg border p-5 shadow-sm ${order.status === "new" ? "border-china-red bg-red-50/70" : "border-stone-200 bg-white"}`}>
            <div className="flex flex-col justify-between gap-4 lg:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-china-red">{order.order_number}</p>
                  <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${statusStyles[order.status]}`}>{order.status}</span>
                  {order.status === "new" && <span className="rounded-md bg-china-red px-2 py-1 text-xs font-black uppercase text-white">New Order</span>}
                </div>
                <h2 className="mt-1 text-2xl font-black">{order.customer_name}</h2>
                <p className="text-stone-600">
                  {order.customer_phone} {order.customer_email ? `| ${order.customer_email}` : ""} | {order.fulfillment_type}
                </p>
                <p className="mt-1 text-stone-600">
                  {paymentLabel(order.payment_method, order.payment_status)} | Pickup: {pickupLabel(order)}
                </p>
                <p className="mt-1 font-bold text-stone-700">Ready estimate: {readyLabel(order)}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-black uppercase">
                  {order.confirmation_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Confirmation email sent</span>}
                  {order.confirmation_email_error && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Confirmation email failed</span>}
                  {order.ready_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Ready email sent</span>}
                  {order.ready_email_error && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Ready email failed</span>}
                </div>
                {order.delivery_address && <p className="mt-1 text-stone-600">{order.delivery_address}</p>}
                {order.customer_notes && <p className="mt-1 text-stone-600">Notes: {order.customer_notes}</p>}
              </div>
              <div className="grid gap-2 sm:min-w-60">
                <select
                  value={order.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as OrderStatus;
                    updateStatus(order.order_number, nextStatus, nextStatus === "accepted" ? selectedReadyMinutes(order.order_number) : undefined);
                  }}
                  disabled={updatingOrders.has(order.order_number)}
                  className="focus-ring h-12 rounded-md border border-stone-300 px-3 font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statuses.filter((value) => value !== "all").map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                {order.status === "new" && (
                  <div className="grid gap-2 rounded-md border border-stone-200 bg-white p-3">
                    <label className="grid gap-1 text-sm font-black text-stone-700">
                      Ready in
                      <select
                        value={readyMinutes[order.order_number] ?? "20"}
                        onChange={(event) => setReadyMinutes((current) => ({ ...current, [order.order_number]: event.target.value }))}
                        className="focus-ring h-11 rounded-md border border-stone-300 px-3"
                      >
                        {readyMinuteOptions.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} minutes
                          </option>
                        ))}
                        <option value="custom">Custom minutes</option>
                      </select>
                    </label>
                    {(readyMinutes[order.order_number] ?? "20") === "custom" && (
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={customReadyMinutes[order.order_number] ?? ""}
                        onChange={(event) => setCustomReadyMinutes((current) => ({ ...current, [order.order_number]: event.target.value }))}
                        className="focus-ring h-11 rounded-md border border-stone-300 px-3"
                        placeholder="Minutes"
                      />
                    )}
                    <button
                      onClick={() => updateStatus(order.order_number, "accepted", selectedReadyMinutes(order.order_number))}
                      disabled={updatingOrders.has(order.order_number)}
                      className="focus-ring min-h-11 rounded-md bg-china-red px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                    >
                      Accept / Confirm order
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {quickStatuses.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => updateStatus(order.order_number, nextStatus)}
                      disabled={updatingOrders.has(order.order_number)}
                      className={`focus-ring min-h-10 rounded-md border px-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${statusStyles[nextStatus]}`}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => updateStatus(order.order_number, "ready")}
                  disabled={updatingOrders.has(order.order_number)}
                  className="focus-ring min-h-11 rounded-md border border-green-700 bg-green-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Ready & Email Customer
                </button>
                <div className="rounded-md bg-china-paper p-3 text-right text-sm">
                  <p>Subtotal: {formatPrice(order.subtotal)}</p>
                  <p>Tax: {formatPrice(order.tax)}</p>
                  <p>Processing fee: {formatPrice(order.processing_fee ?? 0)}</p>
                  <p>Tip: {formatPrice(order.tip_amount ?? 0)}</p>
                  <p className="text-xl font-black">Total: {formatPrice(order.total)}</p>
                </div>
                <Link href={`/admin/orders/${order.order_number}/print`} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 px-4 font-bold text-stone-800">
                  <Printer className="h-5 w-5" />
                  Ticket
                </Link>
              </div>
            </div>
            <div className="mt-4 grid gap-2 border-t border-stone-200 pt-4">
              {order.order_items.map((item, index) => (
                <div key={`${order.order_number}-${item.item_number}-${index}`} className="flex flex-col justify-between gap-2 rounded-md bg-china-paper p-3 sm:flex-row">
                  <span>
                    <strong>
                      {item.quantity} x #{item.item_number} {item.item_name}
                    </strong>
                    {customizationText(item.customization) && <span className="block text-sm text-stone-600">{customizationText(item.customization)}</span>}
                    {item.customization?.notes ? <span className="block text-sm font-bold text-stone-700">Notes: {String(item.customization.notes)}</span> : null}
                  </span>
                  <span className="font-bold">{formatPrice(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
        {visible.length === 0 && <div className="rounded-lg border border-stone-200 bg-white p-8 text-center font-bold">No orders found.</div>}
      </div>
    </section>
  );
}
