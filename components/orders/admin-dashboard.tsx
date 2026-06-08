"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Edit3, Menu, Phone, Printer, RefreshCw, Search, Volume2, VolumeX, X } from "lucide-react";
import { customizationText } from "@/lib/order-display";
import { confirmedReadyTime, formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import { menuItems } from "@/data/menu";
import { restaurant } from "@/lib/restaurant";
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
  accepted_email_sent_at?: string | null;
  accepted_email_error?: string | null;
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
    id?: string;
    menu_item_id?: string;
    item_number: string;
    item_name: string;
    category?: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown>;
  }>;
};

type AdminFilter = "active" | "new" | "accepted" | "preparing" | "ready" | "past" | "picked_up" | "completed" | "cancelled" | "all";
type BusyMode = "normal" | "busy" | "very_busy";
type OrderingOverrideMode = "normal" | "open" | "paused";
type AdminOperations = {
  settings: {
    orderingOverride: { mode: OrderingOverrideMode; expiresAt: string | null };
    busyMode: BusyMode;
    soldOutDate: string | null;
    soldOutItemIds: string[];
  };
  orderingAllowed: boolean;
  busyExtraMinutes: number;
  nextBoundary: { label: string; iso: string };
};
type AdminSection = "orders" | "past-orders" | "summary" | "sold-out" | "ordering" | "busy" | "reports" | "settings";
type EditOrderState = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string;
  pickupTimeType: PickupTimeType;
  scheduledPickupTime: string;
  tipAmount: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  items: Array<{
    id: string;
    itemNumber: string;
    itemName: string;
    quantity: string;
    unitPrice: string;
    customization?: Record<string, unknown>;
  }>;
};

const statuses: OrderStatus[] = ["new", "accepted", "preparing", "ready", "picked_up", "completed", "cancelled"];
const filterTabs: Array<{ value: AdminFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "new", label: "New" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "past", label: "Past Orders" },
  { value: "picked_up", label: "Picked Up" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" }
];
const adminSections: Array<{ value: AdminSection; label: string }> = [
  { value: "orders", label: "Current Orders" },
  { value: "summary", label: "Daily Summary" },
  { value: "sold-out", label: "Sold Out Items" },
  { value: "ordering", label: "Online Ordering Status" },
  { value: "busy", label: "Busy Mode" },
  { value: "reports", label: "Reports / Export" },
  { value: "settings", label: "Settings Info" },
  { value: "past-orders", label: "Past Orders" }
];
const activeStatuses: OrderStatus[] = ["new", "accepted", "preparing", "ready"];
const pastStatuses: OrderStatus[] = ["picked_up", "completed", "cancelled"];
const quickStatuses: OrderStatus[] = ["preparing", "ready", "picked_up", "cancelled"];
const readyMinuteOptions = [10, 15, 20, 25, 30, 35, 45];
const alertWords = ["allergy", "allergic", "peanut", "shellfish", "gluten", " no ", "extra", "sauce"];
const statusStyles: Record<OrderStatus, string> = {
  new: "bg-red-100 text-china-red border-red-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-amber-100 text-amber-900 border-amber-200",
  ready: "bg-green-100 text-green-800 border-green-200",
  picked_up: "bg-emerald-100 text-emerald-900 border-emerald-200",
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
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
}

function readyLabel(order: AdminOrder) {
  const time = confirmedReadyTime(order.estimated_ready_at);
  if (!time) return "Not set — accept the order to set a ready time";
  return order.estimated_ready_minutes ? `${time} (${order.estimated_ready_minutes} min)` : time;
}

function statusLabel(status: OrderStatus | AdminFilter) {
  if (status === "picked_up") return "Picked Up";
  if (status === "past") return "Past Orders";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function matchesFilter(order: AdminOrder, filter: AdminFilter) {
  if (filter === "all") return true;
  if (filter === "active") return activeStatuses.includes(order.status);
  if (filter === "past") return pastStatuses.includes(order.status);
  return order.status === filter;
}

function easternDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function hasInstructionAlert(value?: string) {
  if (!value) return false;
  const text = ` ${value.toLowerCase()} `;
  return alertWords.some((word) => text.includes(word));
}

function itemSummary(order: AdminOrder) {
  return order.order_items.map((item) => `${item.quantity}x #${item.item_number} ${item.item_name}`).join("; ");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
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
      accepted_email_sent_at: null,
      accepted_email_error: null,
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
  const [filter, setFilter] = useState<AdminFilter>("active");
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
  const [readyMinutes, setReadyMinutes] = useState<Record<string, string>>({});
  const [customReadyMinutes, setCustomReadyMinutes] = useState<Record<string, string>>({});
  const [acceptingOrder, setAcceptingOrder] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [operations, setOperations] = useState<AdminOperations | null>(null);
  const [operationsError, setOperationsError] = useState<string | null>(null);
  const [soldOutSelection, setSoldOutSelection] = useState(menuItems[0]?.id ?? "");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AdminSection>("orders");
  const [editingOrder, setEditingOrder] = useState<EditOrderState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const previousNewOrders = useRef<Set<string>>(new Set());
  const updatingOrdersRef = useRef<Set<string>>(new Set());
  const editingOrderRef = useRef(false);

  useEffect(() => {
    editingOrderRef.current = Boolean(editingOrder);
  }, [editingOrder]);

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

  const loadOperations = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load settings.");
      setOperations(data);
      setOperationsError(null);
    } catch {
      setOperationsError("Admin settings could not load.");
    }
  }, []);

  async function updateOperations(body: Record<string, unknown>) {
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save settings.");
      setOperations(data);
      setOperationsError(null);
    } catch {
      setOperationsError("Admin settings could not save.");
    }
  }

  const loadOrders = useCallback(
    async (options: { manual?: boolean } = {}) => {
      if (updatingOrdersRef.current.size > 0) {
        if (options.manual) setRefreshError("Finish saving the status change before refreshing.");
        return;
      }
      if (editingOrderRef.current) {
        if (options.manual) setRefreshError("Finish editing the order before refreshing.");
        return;
      }
      setRefreshing(true);
      try {
        const response = await fetch("/api/orders");
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
    [muted, audioUnlocked]
  );

  useEffect(() => {
    loadOrders();
    loadOperations();
    const timer = window.setInterval(loadOrders, 15000);
    return () => window.clearInterval(timer);
  }, [loadOrders, loadOperations]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      const text = `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase();
      return matchesFilter(order, filter) && (!normalized || text.includes(normalized));
    });
  }, [orders, query, filter]);

  const todayOrders = useMemo(() => {
    const todayKey = easternDateKey(new Date().toISOString());
    return orders.filter((order) => easternDateKey(order.created_at) === todayKey);
  }, [orders]);

  const dailySummary = useMemo(() => {
    const paidStripe = todayOrders.filter((order) => order.payment_method === "stripe" && order.payment_status === "paid");
    const cash = todayOrders.filter((order) => order.payment_method !== "stripe");
    const totalSalesOrders = todayOrders.filter((order) => order.status !== "cancelled");
    const totalSales = totalSalesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const tips = totalSalesOrders.reduce((sum, order) => sum + Number(order.tip_amount || 0), 0);
    return {
      totalOrders: todayOrders.length,
      newOrders: todayOrders.filter((order) => order.status === "new").length,
      activeOrders: todayOrders.filter((order) => activeStatuses.includes(order.status)).length,
      pickedUpCompleted: todayOrders.filter((order) => order.status === "picked_up" || order.status === "completed").length,
      cancelled: todayOrders.filter((order) => order.status === "cancelled").length,
      totalSales,
      cashSales: cash.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total || 0), 0),
      stripeSales: paidStripe.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + Number(order.total || 0), 0),
      tips,
      averageOrder: totalSalesOrders.length ? totalSales / totalSalesOrders.length : 0
    };
  }, [todayOrders]);

  const topItems = useMemo(() => {
    const rows = new Map<string, { name: string; quantity: number; sales: number }>();
    todayOrders
      .filter((order) => order.status !== "cancelled")
      .forEach((order) => {
        order.order_items.forEach((item) => {
          const key = `${item.item_number}-${item.item_name}`;
          const current = rows.get(key) ?? { name: `#${item.item_number} ${item.item_name}`, quantity: 0, sales: 0 };
          current.quantity += item.quantity;
          current.sales += item.quantity * item.unit_price;
          rows.set(key, current);
        });
      });
    return Array.from(rows.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6);
  }, [todayOrders]);

  const suggestedReadyMinuteOptions = useMemo(() => {
    const extra = operations?.busyExtraMinutes ?? 0;
    return Array.from(new Set(readyMinuteOptions.map((minutes) => minutes + extra))).filter((minutes) => minutes > 0);
  }, [operations?.busyExtraMinutes]);

  function exportTodayCsv() {
    const rows = [
      ["Order number", "Created time", "Customer name", "Phone", "Email", "Status", "Payment method", "Payment status", "Subtotal", "Tax", "Processing fee", "Tip", "Total", "Items summary"],
      ...todayOrders.map((order) => [
        order.order_number,
        order.created_at ? formatPickupDateTime(order.created_at) : "",
        order.customer_name,
        order.customer_phone,
        order.customer_email ?? "",
        statusLabel(order.status),
        order.payment_method ?? "",
        order.payment_status ?? "",
        order.subtotal,
        order.tax,
        order.processing_fee ?? 0,
        order.tip_amount ?? 0,
        order.total,
        itemSummary(order)
      ])
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `china-delight-orders-${easternDateKey(new Date().toISOString())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function selectedReadyMinutes(orderNumber: string) {
    const choice = readyMinutes[orderNumber] ?? String(20 + (operations?.busyExtraMinutes ?? 0));
    const value = choice === "custom" ? Number(customReadyMinutes[orderNumber]) : Number(choice);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 20 + (operations?.busyExtraMinutes ?? 0);
  }

  async function confirmAccept() {
    if (!acceptingOrder) return;
    const orderNumber = acceptingOrder;
    const minutes = selectedReadyMinutes(orderNumber);
    setAcceptingOrder(null);
    await updateStatus(orderNumber, "accepted", minutes);
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

  function toggleExpanded(orderNumber: string) {
    setExpandedOrders((current) => {
      const next = new Set(current);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }

  async function copyPhone(phone: string) {
    await navigator.clipboard?.writeText(phone).catch(() => undefined);
  }

  function openAdminSection(section: AdminSection, label?: string) {
    setActiveSection(section);
    setAdminMenuOpen(false);
    if (label === "Past Orders") setFilter("past");
    if (label === "Current Orders") setFilter("active");
    const targetId =
      section === "summary" ? "admin-summary" :
      section === "sold-out" ? "admin-sold-out" :
      section === "ordering" ? "admin-ordering-status" :
      section === "busy" ? "admin-busy-mode" :
      section === "reports" ? "admin-reports" :
      section === "settings" ? "admin-settings" :
      "admin-orders";
    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openEditOrder(order: AdminOrder) {
    if (!order.id) {
      setRefreshError("Local fallback orders cannot be edited from admin.");
      return;
    }
    setEditError(null);
    setEditingOrder({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email ?? "",
      customerNotes: order.customer_notes ?? "",
      pickupTimeType: order.pickup_time_type ?? "asap",
      scheduledPickupTime: toDateTimeLocal(order.scheduled_pickup_time),
      tipAmount: String(order.tip_amount ?? 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      items: order.order_items
        .filter((item) => item.id)
        .map((item) => ({
          id: String(item.id),
          itemNumber: item.item_number,
          itemName: item.item_name,
          quantity: String(item.quantity),
          unitPrice: String(item.unit_price),
          customization: item.customization
        }))
    });
  }

  function updateEditField(field: keyof Omit<EditOrderState, "items">, value: string) {
    setEditingOrder((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateEditItem(id: string, field: "quantity" | "unitPrice", value: string) {
    setEditingOrder((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
          }
        : current
    );
  }

  function removeEditItem(id: string) {
    setEditingOrder((current) => (current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current));
  }

  function editedTotals(order: EditOrderState | null) {
    const subtotal = (order?.items ?? []).reduce((sum, item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      return sum + quantity * price;
    }, 0);
    const tax = subtotal * restaurant.taxRate;
    const processingFee = subtotal * restaurant.processingFeeRate;
    const tip = Math.max(0, Number(order?.tipAmount ?? 0) || 0);
    return { subtotal, tax, processingFee, tip, total: subtotal + tax + processingFee + tip };
  }

  async function saveEditOrder() {
    if (!editingOrder) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const items = editingOrder.items.map((item) => ({
        id: item.id,
        quantity: Math.round(Number(item.quantity)),
        unitPrice: Number(item.unitPrice)
      }));
      if (!editingOrder.customerName.trim() || !editingOrder.customerPhone.trim() || !editingOrder.customerEmail.trim()) throw new Error("Name, phone, and email are required.");
      if (!items.length) throw new Error("An order must have at least one item.");
      if (items.some((item) => item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error("Quantities must be 1 or more and prices cannot be negative.");
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          orderNumber: editingOrder.orderNumber,
          customerName: editingOrder.customerName,
          customerPhone: editingOrder.customerPhone,
          customerEmail: editingOrder.customerEmail,
          customerNotes: editingOrder.customerNotes,
          pickupTimeType: editingOrder.pickupTimeType,
          scheduledPickupTime: editingOrder.scheduledPickupTime ? new Date(editingOrder.scheduledPickupTime).toISOString() : null,
          tipAmount: Number(editingOrder.tipAmount) || 0,
          items
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Order edit could not be saved.");
      setEditingOrder(null);
      await loadOrders({ manual: true });
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Order edit could not be saved.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const currentEditTotals = editedTotals(editingOrder);

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
        {operationsError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{operationsError}</span>}
      </div>

      <div className="mt-5 lg:hidden">
        <button
          onClick={() => setAdminMenuOpen((current) => !current)}
          className="focus-ring flex min-h-12 w-full items-center justify-between rounded-md border border-stone-300 bg-white px-4 font-black text-stone-800 shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Menu className="h-5 w-5" />
            Admin menu
          </span>
          {adminMenuOpen ? <X className="h-5 w-5" /> : null}
        </button>
        {adminMenuOpen && (
          <div className="mt-2 grid gap-2 rounded-lg border border-stone-200 bg-white p-2 shadow-sm">
            {adminSections.map((section) => (
              <button
                key={`${section.label}-${section.value}`}
                onClick={() => openAdminSection(section.value, section.label)}
                className="focus-ring min-h-11 rounded-md px-3 text-left font-black text-stone-700 hover:bg-china-paper"
              >
                {section.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-lg border border-stone-200 bg-white p-2 shadow-sm">
            <p className="px-2 py-2 text-xs font-black uppercase tracking-[0.14em] text-china-red">Admin menu</p>
            <div className="grid gap-1">
              {adminSections.map((section) => (
                <button
                  key={`${section.label}-${section.value}`}
                  onClick={() => openAdminSection(section.value, section.label)}
                  className={`focus-ring rounded-md px-3 py-2 text-left text-sm font-black ${
                    activeSection === section.value ? "bg-china-red text-white" : "text-stone-700 hover:bg-china-paper"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
      <div className="grid gap-4 lg:grid-cols-3">
        <div id="admin-ordering-status" className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="font-black text-china-red">Online Ordering Status</p>
          <p className="mt-1 text-sm font-bold text-stone-700">
            {operations?.orderingAllowed ? "Taking online orders" : "Not taking online orders"}
            {operations?.settings.orderingOverride.mode !== "normal" && operations?.nextBoundary ? ` until ${operations.nextBoundary.label}` : ""}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <button onClick={() => updateOperations({ orderingOverrideMode: "open" })} className="focus-ring min-h-10 rounded-md border border-green-700 bg-green-700 px-3 text-sm font-black text-white">
              Taking orders
            </button>
            <button onClick={() => updateOperations({ orderingOverrideMode: "paused" })} className="focus-ring min-h-10 rounded-md border border-china-red bg-china-red px-3 text-sm font-black text-white">
              Pause orders
            </button>
            <button onClick={() => updateOperations({ orderingOverrideMode: "normal" })} className="focus-ring min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
              Follow hours
            </button>
          </div>
        </div>

        <div id="admin-busy-mode" className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="font-black text-china-red">Busy Mode</p>
          <p className="mt-1 text-sm font-bold text-stone-700">Ready-time suggestions add {operations?.busyExtraMinutes ?? 0} minutes.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["normal", "busy", "very_busy"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateOperations({ busyMode: mode })}
                className={`focus-ring min-h-10 rounded-md border px-2 text-sm font-black ${
                  operations?.settings.busyMode === mode ? "border-china-red bg-china-red text-white" : "border-stone-300 bg-white text-stone-700"
                }`}
              >
                {mode === "very_busy" ? "Very busy" : mode === "busy" ? "Busy" : "Normal"}
              </button>
            ))}
          </div>
        </div>

        <div id="admin-sold-out" className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <p className="font-black text-china-red">Sold Out Today</p>
          <div className="mt-3 grid gap-2">
            <select value={soldOutSelection} onChange={(event) => setSoldOutSelection(event.target.value)} className="focus-ring h-10 rounded-md border border-stone-300 px-3 text-sm font-bold">
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.number} {item.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateOperations({ soldOutAction: "add", soldOutItemId: soldOutSelection })} className="focus-ring min-h-10 rounded-md bg-china-red px-3 text-sm font-black text-white">
                Mark sold out
              </button>
              <button onClick={() => updateOperations({ soldOutAction: "clear" })} className="focus-ring min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
                Clear sold out
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(operations?.settings.soldOutItemIds ?? []).slice(0, 6).map((id) => {
                const item = menuItems.find((menuItem) => menuItem.id === id);
                return (
                  <button key={id} onClick={() => updateOperations({ soldOutAction: "remove", soldOutItemId: id })} className="rounded-md bg-stone-200 px-2 py-1 text-xs font-bold text-stone-800">
                    {item ? `#${item.number} ${item.name}` : id} x
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <div id="admin-reports" className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black text-china-red">Today Reports</p>
            <button onClick={exportTodayCsv} className="focus-ring rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-black text-stone-700">
              Export today CSV
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {topItems.length ? (
              topItems.map((item) => (
                <div key={item.name} className="flex justify-between gap-3 rounded-md bg-china-paper px-3 py-2">
                  <span className="font-bold">{item.name}</span>
                  <span className="shrink-0 font-black">{item.quantity} / {formatPrice(item.sales)}</span>
                </div>
              ))
            ) : (
              <p className="font-bold text-stone-600">No item sales yet today.</p>
            )}
          </div>
        </div>

        <div id="admin-settings" className="scroll-mt-24 rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="font-black text-china-red">Admin Settings Helper</p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-stone-700 sm:grid-cols-2">
            <p>Hours: Mon-Thu 11:00 AM-10:00 PM; Fri-Sat 11:00 AM-10:30 PM; Sun 12:00 PM-10:00 PM</p>
            <p>Lunch: Monday-Saturday, 11:00 AM-3:00 PM</p>
            <p>Tax rate: {(restaurant.taxRate * 100).toFixed(2)}%</p>
            <p>Processing fee: {(restaurant.processingFeeRate * 100).toFixed(2)}%</p>
            <p className="sm:col-span-2">
              Delivery links: {restaurant.deliveryPlatforms.map((platform) => `${platform.name} ${platform.url ? "configured" : "missing"}`).join("; ")}
            </p>
          </div>
        </div>
      </div>

      <div id="admin-summary" className="mt-6 grid scroll-mt-24 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Orders today", dailySummary.totalOrders],
          ["New", dailySummary.newOrders],
          ["Active", dailySummary.activeOrders],
          ["Picked up / completed", dailySummary.pickedUpCompleted],
          ["Cancelled", dailySummary.cancelled],
          ["Sales", formatPrice(dailySummary.totalSales)],
          ["Cash", formatPrice(dailySummary.cashSales)],
          ["Stripe paid", formatPrice(dailySummary.stripeSales)],
          ["Tips", formatPrice(dailySummary.tips)],
          ["Avg order", formatPrice(dailySummary.averageOrder)]
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">{label}</p>
            <p className="mt-1 text-xl font-black text-stone-900">{value}</p>
          </div>
        ))}
      </div>

      <div id="admin-orders" className="mt-6 grid scroll-mt-24 gap-4 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, order number, or item" className="focus-ring h-14 w-full rounded-md border border-stone-300 pl-12 pr-4 text-lg" />
        </label>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-4 py-2 font-black ${
              filter === tab.value ? "border-china-red bg-china-red text-white" : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {visible.map((order) => {
          const expanded = expandedOrders.has(order.order_number);
          const itemsToShow = expanded ? order.order_items : order.order_items.slice(0, 3);
          const remainingItems = Math.max(0, order.order_items.length - itemsToShow.length);
          return (
          <article key={order.order_number} className={`rounded-lg border p-2 shadow-sm ${order.status === "new" ? "border-2 border-china-red bg-red-50" : "border-stone-200 bg-white"}`}>
            <div className="flex flex-col justify-between gap-2 lg:flex-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-china-red">{order.order_number}</p>
                  <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${statusStyles[order.status]}`}>{statusLabel(order.status)}</span>
                  {order.status === "new" && <span className="rounded-md bg-china-red px-2 py-1 text-xs font-black uppercase text-white">New Order</span>}
                </div>
                <h2 className="mt-1 truncate text-lg font-black">{order.customer_name}</h2>
                <p className="text-sm text-stone-600">
                  <a href={`tel:${order.customer_phone.replace(/\D/g, "")}`} className="font-bold text-stone-800 underline-offset-2 hover:underline">{order.customer_phone}</a>
                  {order.customer_email ? ` | ${order.customer_email}` : ""}
                </p>
                <p className="mt-1 text-sm text-stone-600">
                  {paymentLabel(order.payment_method, order.payment_status)} | Pickup: {pickupLabel(order)}
                </p>
                <p className="mt-1 text-sm font-bold text-stone-700">Ready: {readyLabel(order)} | Total: {formatPrice(order.total)}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px] font-black uppercase">
                  {order.confirmation_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Confirmation email sent</span>}
                  {order.confirmation_email_error && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Confirmation email failed</span>}
                  {order.accepted_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Accepted email sent</span>}
                  {order.accepted_email_error && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Accepted email failed</span>}
                  {order.ready_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Ready email sent</span>}
                  {order.ready_email_error && <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-900">Ready email failed</span>}
                </div>
                {order.delivery_address && <p className="mt-1 text-stone-600">{order.delivery_address}</p>}
                {order.customer_notes && (
                  <p className={`mt-1 rounded-md px-2 py-1 text-sm font-bold ${hasInstructionAlert(order.customer_notes) ? "bg-yellow-100 text-yellow-950" : "text-stone-600"}`}>
                    Notes: {order.customer_notes}
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:min-w-52">
                <select
                  value={order.status}
                  onChange={(event) => {
                    const nextStatus = event.target.value as OrderStatus;
                    if (nextStatus === "accepted") {
                      setAcceptingOrder(order.order_number);
                      return;
                    }
                    updateStatus(order.order_number, nextStatus);
                  }}
                  disabled={updatingOrders.has(order.order_number)}
                  className="focus-ring h-10 rounded-md border border-stone-300 px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
                {order.status === "new" && (
                  <button
                    onClick={() => setAcceptingOrder(order.order_number)}
                    disabled={updatingOrders.has(order.order_number)}
                    className="focus-ring min-h-10 rounded-md bg-china-red px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    Accept / Confirm order
                  </button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {quickStatuses.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => updateStatus(order.order_number, nextStatus)}
                      disabled={updatingOrders.has(order.order_number)}
                      className={`focus-ring min-h-9 rounded-md border px-2 text-xs font-black disabled:cursor-not-allowed disabled:opacity-60 ${statusStyles[nextStatus]}`}
                    >
                      {statusLabel(nextStatus)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => updateStatus(order.order_number, "ready")}
                  disabled={updatingOrders.has(order.order_number)}
                  className="focus-ring min-h-10 rounded-md border border-green-700 bg-green-700 px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Ready & Email Customer
                </button>
                <div className="grid grid-cols-4 gap-2">
                  {activeStatuses.includes(order.status) ? (
                    <button onClick={() => openEditOrder(order)} className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800" aria-label="Edit order">
                      <Edit3 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="min-h-9" />
                  )}
                  <a href={`tel:${order.customer_phone.replace(/\D/g, "")}`} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800" aria-label="Call customer">
                    <Phone className="h-4 w-4" />
                  </a>
                  <button onClick={() => copyPhone(order.customer_phone)} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800" aria-label="Copy phone">
                    <Copy className="h-4 w-4" />
                  </button>
                  <Link href={`/admin/orders/${order.order_number}/print`} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800" aria-label="Print ticket">
                    <Printer className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 border-t border-stone-200 pt-3">
              {itemsToShow.map((item, index) => (
                <div
                  key={`${order.order_number}-${item.item_number}-${index}`}
                  className={`flex flex-col justify-between gap-1 rounded-md p-2 text-sm sm:flex-row ${
                    hasInstructionAlert(`${customizationText(item.customization)} ${String(item.customization?.notes ?? "")}`) ? "bg-yellow-100 text-yellow-950" : "bg-china-paper"
                  }`}
                >
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
              {(remainingItems > 0 || expanded) && (
                <button onClick={() => toggleExpanded(order.order_number)} className="focus-ring min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
                  {expanded ? "Hide details" : `Show ${remainingItems} more item${remainingItems === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </article>
          );
        })}
        {visible.length === 0 && <div className="rounded-lg border border-stone-200 bg-white p-8 text-center font-bold">No orders found.</div>}
      </div>
        </div>
      </div>

      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-4 shadow-warm sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black uppercase tracking-[0.14em] text-china-red">Edit order</p>
                <h2 className="mt-1 text-2xl font-black">{editingOrder.orderNumber}</h2>
              </div>
              <button onClick={() => setEditingOrder(null)} className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-700" aria-label="Close edit order">
                <X className="h-5 w-5" />
              </button>
            </div>

            {editingOrder.paymentMethod === "stripe" && editingOrder.paymentStatus === "paid" && (
              <p className="mt-3 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-950">
                This order was already paid online. Changing prices here does not automatically charge or refund the customer.
              </p>
            )}
            {editError && <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-china-red">{editError}</p>}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Name
                <input value={editingOrder.customerName} onChange={(event) => updateEditField("customerName", event.target.value)} className="focus-ring h-11 rounded-md border border-stone-300 px-3 font-bold" />
              </label>
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Phone
                <input value={editingOrder.customerPhone} onChange={(event) => updateEditField("customerPhone", event.target.value)} className="focus-ring h-11 rounded-md border border-stone-300 px-3 font-bold" />
              </label>
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Email
                <input type="email" value={editingOrder.customerEmail} onChange={(event) => updateEditField("customerEmail", event.target.value)} className="focus-ring h-11 rounded-md border border-stone-300 px-3 font-bold" />
              </label>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[12rem_1fr]">
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Pickup
                <select value={editingOrder.pickupTimeType} onChange={(event) => updateEditField("pickupTimeType", event.target.value)} className="focus-ring h-11 rounded-md border border-stone-300 px-3 font-bold">
                  <option value="asap">ASAP</option>
                  <option value="scheduled">Scheduled</option>
                </select>
              </label>
              {editingOrder.pickupTimeType === "scheduled" && (
                <label className="grid gap-1 text-sm font-black text-stone-700">
                  Scheduled pickup time
                  <input
                    type="datetime-local"
                    value={editingOrder.scheduledPickupTime}
                    onChange={(event) => updateEditField("scheduledPickupTime", event.target.value)}
                    className="focus-ring h-11 rounded-md border border-stone-300 px-3 font-bold"
                  />
                </label>
              )}
            </div>

            <label className="mt-3 grid gap-1 text-sm font-black text-stone-700">
              Customer notes
              <textarea value={editingOrder.customerNotes} onChange={(event) => updateEditField("customerNotes", event.target.value)} rows={2} className="focus-ring rounded-md border border-stone-300 px-3 py-2 font-bold" />
            </label>

            <div className="mt-4 grid gap-2">
              <p className="font-black text-china-red">Items and prices</p>
              {editingOrder.items.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-md bg-china-paper p-2 sm:grid-cols-[1fr_5rem_7rem_5rem] sm:items-end">
                  <div className="min-w-0">
                    <p className="truncate font-black">
                      #{item.itemNumber} {item.itemName}
                    </p>
                    {customizationText(item.customization) && <p className="text-xs font-bold text-stone-600">{customizationText(item.customization)}</p>}
                  </div>
                  <label className="grid gap-1 text-xs font-black text-stone-700">
                    Qty
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(event) => updateEditItem(item.id, "quantity", event.target.value)}
                      className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-black text-stone-700">
                    Unit price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={item.unitPrice}
                      onChange={(event) => updateEditItem(item.id, "unitPrice", event.target.value)}
                      className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                    />
                  </label>
                  <button onClick={() => removeEditItem(item.id)} className="focus-ring min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 rounded-md border border-stone-200 p-3 text-sm font-bold sm:grid-cols-5">
              <p>Subtotal: {formatPrice(currentEditTotals.subtotal)}</p>
              <p>Tax: {formatPrice(currentEditTotals.tax)}</p>
              <p>Fee: {formatPrice(currentEditTotals.processingFee)}</p>
              <label className="grid gap-1">
                Tip
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={editingOrder.tipAmount}
                  onChange={(event) => updateEditField("tipAmount", event.target.value)}
                  className="focus-ring h-9 rounded-md border border-stone-300 px-2"
                />
              </label>
              <p className="text-lg font-black">Total: {formatPrice(currentEditTotals.total)}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setEditingOrder(null)} className="focus-ring min-h-12 rounded-md border border-stone-300 px-4 font-black text-stone-700">
                Cancel
              </button>
              <button onClick={saveEditOrder} disabled={savingEdit} className="focus-ring min-h-12 rounded-md bg-china-red px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {acceptingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-warm">
            <h2 className="text-xl font-black">Set ready time</h2>
            <p className="mt-1 text-sm text-stone-600">
              Choose how long order <span className="font-black text-china-red">{acceptingOrder}</span> will take. This confirms the order and notifies the customer of the ready time.
            </p>
            <label className="mt-4 grid gap-1 text-sm font-black text-stone-700">
              Ready in
              <select
                value={readyMinutes[acceptingOrder] ?? "20"}
                onChange={(event) => setReadyMinutes((current) => ({ ...current, [acceptingOrder]: event.target.value }))}
                className="focus-ring h-12 rounded-md border border-stone-300 px-3"
              >
                {suggestedReadyMinuteOptions.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
                <option value="custom">Custom minutes</option>
              </select>
            </label>
            {(readyMinutes[acceptingOrder] ?? "20") === "custom" && (
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={customReadyMinutes[acceptingOrder] ?? ""}
                onChange={(event) => setCustomReadyMinutes((current) => ({ ...current, [acceptingOrder]: event.target.value }))}
                className="focus-ring mt-3 h-12 w-full rounded-md border border-stone-300 px-3"
                placeholder="Minutes"
              />
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setAcceptingOrder(null)} className="focus-ring min-h-12 rounded-md border border-stone-300 px-4 font-black text-stone-700">
                Cancel
              </button>
              <button onClick={confirmAccept} className="focus-ring min-h-12 rounded-md bg-china-red px-4 font-black text-white">
                Confirm &amp; accept
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
