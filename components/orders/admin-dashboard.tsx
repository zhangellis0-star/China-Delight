"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Edit3, Menu, Phone, Plus, Printer, RefreshCw, Search, Volume2, VolumeX, X } from "lucide-react";
import { customizationText } from "@/lib/order-display";
import { comboIncludedItems, confirmedReadyTime, formatPickupDateTime, isComboItem, isLunchItem } from "@/lib/order-rules";
import { defaultSize, formatPrice, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import { menuItems } from "@/data/menu";
import { restaurant } from "@/lib/restaurant";
import { PromoManager } from "@/components/orders/promo-manager";
import { SpecialOffersManager } from "@/components/orders/special-offers-manager";
import type { CartCustomization, CartItem, LunchRiceChoice, LunchSideChoice, MenuItem, MenuPriceKey, OrderStatus, PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

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
  promo_code?: string | null;
  discount_amount?: number | null;
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
type AdminSection = "orders" | "past-orders" | "summary" | "sold-out" | "ordering" | "reports" | "promo" | "special-offers" | "settings";
type KitchenPrintState = {
  status: "printed" | "failed";
  message?: string;
  updatedAt: string;
};
type EditOrderState = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerNotes: string;
  pickupTimeType: PickupTimeType;
  scheduledPickupTime: string;
  tipAmount: string;
  promoCode?: string | null;
  discountAmount: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  items: Array<{
    localKey: string;
    id: string | null;
    menuItemId: string;
    itemNumber: string;
    itemName: string;
    category: string;
    quantity: string;
    unitPrice: string;
    customization?: Record<string, unknown>;
    extraChargeLabel: string;
    extraChargeAmount: string;
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
  { value: "ordering", label: "Online Ordering Status" },
  { value: "orders", label: "Current Orders" },
  { value: "sold-out", label: "Sold Out Items" },
  { value: "reports", label: "Reports / Export" },
  { value: "settings", label: "Settings Info" },
  { value: "promo", label: "Promo Codes" },
  { value: "special-offers", label: "Special Offers" },
  { value: "summary", label: "Daily Summary" },
  { value: "past-orders", label: "Past Orders" }
];
const activeStatuses: OrderStatus[] = ["new", "accepted", "preparing", "ready"];
const pastStatuses: OrderStatus[] = ["picked_up", "completed", "cancelled"];
const quickStatuses: OrderStatus[] = ["preparing", "ready", "picked_up", "cancelled"];
const acceptReadyMinuteOptions = [5, 15, 25];
const kitchenPrintStorageKey = "china-delight-kitchen-print-statuses";
const spiceLevels = ["None", "Mild", "Medium", "Hot", "Extra Hot"] as const;
const sizeLabels: Record<MenuPriceKey, string> = { pint: "Pint", quart: "Quart", combo: "Combo", order: "Order", large: "Large", small: "Small" };
const lunchRiceChoices: LunchRiceChoice[] = ["Pork Fried Rice", "White Rice"];
const lunchSideChoices: LunchSideChoice[] = ["Egg Roll", "Wonton Soup", "Egg Drop Soup", "Canned Soda"];

type NewItemDraft = {
  menuItemId: string;
  size: MenuPriceKey;
  spiceLevel: (typeof spiceLevels)[number];
  lunchRice: LunchRiceChoice;
  lunchSide: LunchSideChoice;
  quantity: string;
  notes: string;
  extraChargeLabel: string;
  extraChargeAmount: string;
};

function makeLocalKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `k-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

function itemSizesFor(item: MenuItem) {
  return (Object.keys(item.prices) as MenuPriceKey[]).filter((key) => item.prices[key] !== undefined);
}
const alertWords = ["allergy", "allergic", "peanut", "shellfish", "gluten", " no ", "extra", "sauce"];
const statusStyles: Record<OrderStatus, string> = {
  new: "bg-red-100 text-china-red border-red-300",
  accepted: "bg-china-aqua text-teal-900 border-teal-200",
  preparing: "bg-amber-100 text-amber-950 border-china-gold",
  ready: "bg-green-100 text-green-900 border-china-green",
  picked_up: "bg-emerald-100 text-emerald-950 border-emerald-300",
  completed: "bg-[#fff7e8] text-stone-800 border-china-gold/60",
  cancelled: "bg-stone-200 text-stone-900 border-stone-300"
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

function emailErrorLabel(label: string, error?: string | null) {
  if (!error) return null;
  return `${label} failed: ${error}`;
}

function loadKitchenPrintStatus() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(kitchenPrintStorageKey) ?? "{}") as Record<string, KitchenPrintState>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, state]) => state?.status === "printed" || state?.status === "failed")
    ) as Record<string, KitchenPrintState>;
  } catch {
    return {};
  }
}

function shouldAutoPrintOrder(order: AdminOrder) {
  if (!order.id || order.status !== "new") return false;
  return order.payment_method !== "stripe" || order.payment_status === "paid";
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
    totals: { subtotal: number; discount?: number; tax: number; processingFee?: number; tip?: number; total: number; promoCode?: string | null };
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
    }
  ];
}

export function AdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filter, setFilter] = useState<AdminFilter>("active");
  const [query, setQuery] = useState("");
  const [muted, setMuted] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [updatingOrders, setUpdatingOrders] = useState<Set<string>>(new Set());
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
  const [creatingTestOrder, setCreatingTestOrder] = useState(false);
  const [dailyReportBusy, setDailyReportBusy] = useState(false);
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const dailyReportAutoRef = useRef(false);
  const [networkPrintingOrders, setNetworkPrintingOrders] = useState<Set<string>>(new Set());
  const [kitchenPrintStatus, setKitchenPrintStatus] = useState<Record<string, KitchenPrintState>>({});
  const [printStatusLoaded, setPrintStatusLoaded] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState("");
  const [newItemDraft, setNewItemDraft] = useState<NewItemDraft | null>(null);
  const previousNewOrders = useRef<Set<string>>(new Set());
  const ordersRef = useRef<AdminOrder[]>([]);
  const updatingOrdersRef = useRef<Set<string>>(new Set());
  const editingOrderRef = useRef(false);
  const kitchenPrintStatusRef = useRef<Record<string, KitchenPrintState>>({});
  const autoPrintAttemptedRef = useRef<Set<string>>(new Set());
  const newOrderAlertIntervalRef = useRef<number | null>(null);
  const activeAudioContextsRef = useRef<Set<AudioContext>>(new Set());
  const soundTimeoutsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    editingOrderRef.current = Boolean(editingOrder);
  }, [editingOrder]);

  useEffect(() => {
    const saved = loadKitchenPrintStatus();
    kitchenPrintStatusRef.current = saved;
    setKitchenPrintStatus(saved);
    setPrintStatusLoaded(true);
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("china-delight-admin-sound");
    if (saved === "muted") {
      setMuted(true);
      setAudioUnlocked(false);
      return;
    }
    if (saved === "enabled") {
      setMuted(false);
      setAudioUnlocked(true);
    }
  }, []);

  const saveKitchenPrintState = useCallback((orderNumber: string, state: KitchenPrintState) => {
    const next = { ...kitchenPrintStatusRef.current, [orderNumber]: state };
    kitchenPrintStatusRef.current = next;
    setKitchenPrintStatus(next);
    window.localStorage.setItem(kitchenPrintStorageKey, JSON.stringify(next));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("china-delight-admin-sound", muted ? "muted" : "enabled");
  }, [muted]);

  const stopNewOrderAlert = useCallback(() => {
    if (newOrderAlertIntervalRef.current !== null) {
      window.clearInterval(newOrderAlertIntervalRef.current);
      newOrderAlertIntervalRef.current = null;
    }
    soundTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    soundTimeoutsRef.current.clear();
    activeAudioContextsRef.current.forEach((context) => {
      context.close().catch(() => undefined);
    });
    activeAudioContextsRef.current.clear();
  }, []);

  // Play one loud alert burst (three alternating beeps) so it carries in a busy kitchen.
  const playNewOrderSound = useCallback(() => {
    if (muted || audioBlocked) return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = new AudioContextClass();
      activeAudioContextsRef.current.add(context);
      const playBurst = () => {
        const tones = [880, 660, 880];
        const beepDuration = 0.22;
        const gap = 0.07;
        tones.forEach((frequency, index) => {
          const start = context.currentTime + index * (beepDuration + gap);
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.type = "square";
          oscillator.frequency.value = frequency;
          // Ramp in/out to avoid clicks; 0.6 peak is loud but stays below clipping for one oscillator.
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.6, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + beepDuration);
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start(start);
          oscillator.stop(start + beepDuration);
        });
        setAudioBlocked(false);
        setAudioUnlocked(true);
        const burstMs = tones.length * (beepDuration + gap) * 1000 + 150;
        const timeoutId = window.setTimeout(() => {
          soundTimeoutsRef.current.delete(timeoutId);
          activeAudioContextsRef.current.delete(context);
          if (context.state !== "closed") context.close().catch(() => undefined);
        }, burstMs);
        soundTimeoutsRef.current.add(timeoutId);
      };
      if (context.state === "suspended") {
        void context.resume().then(playBurst).catch(() => {
          if (!audioUnlocked) setAudioBlocked(true);
          activeAudioContextsRef.current.delete(context);
          if (context.state !== "closed") context.close().catch(() => undefined);
        });
      } else {
        playBurst();
      }
    } catch {
      if (!audioUnlocked) setAudioBlocked(true);
    }
  }, [audioBlocked, audioUnlocked, muted]);

  // Keep the alert repeating on a timer until it is explicitly stopped (order handled / muted).
  const startNewOrderAlert = useCallback(() => {
    if (newOrderAlertIntervalRef.current !== null) return;
    playNewOrderSound();
    // Repeat fairly often (every 2.5s) so staff notice quickly; the alert stops as soon as
    // every new order is handled (see the effect that calls stopNewOrderAlert).
    newOrderAlertIntervalRef.current = window.setInterval(playNewOrderSound, 2500);
  }, [playNewOrderSound]);

  function toggleMute() {
    if (audioBlocked || !audioUnlocked) {
      setAudioUnlocked(true);
      setAudioBlocked(false);
      setMuted(false);
      window.localStorage.setItem("china-delight-admin-sound", "enabled");
      return;
    }
    setMuted((current) => {
      const nextMuted = !current;
      if (nextMuted) stopNewOrderAlert();
      if (!nextMuted) setAudioBlocked(false);
      return nextMuted;
    });
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
    } catch (error) {
      setOperationsError(error instanceof Error ? error.message : "Admin settings could not save.");
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
        if (response.status === 401) {
          // Session expired; send the admin back to the login page.
          window.location.href = "/admin/login";
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to refresh orders.");
        const serverOrders = (data.orders ?? []) as AdminOrder[];
        const serverOrderNumbers = new Set(serverOrders.map((order) => order.order_number));
        const localOrders = normalizeLocalOrder(window.localStorage.getItem("china-delight-last-order")).filter((order) => !serverOrderNumbers.has(order.order_number));
        const nextOrders = [...serverOrders, ...localOrders].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
        const nextNew = new Set(nextOrders.filter((order) => order.status === "new").map((order) => order.order_number));
        previousNewOrders.current = nextNew;
        ordersRef.current = nextOrders;
        setOrders(nextOrders);
        setLastUpdated(new Date());
        setRefreshError(null);
      } catch {
        setRefreshError("Orders could not refresh. Please try again.");
      } finally {
        setRefreshing(false);
      }
    },
    []
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

  // Repeat the alert while any order is still "new"; stop as soon as none remain (every
  // new order accepted/rejected/cancelled) or sound is muted/blocked.
  useEffect(() => {
    const hasNewOrders = orders.some((order) => order.status === "new");
    if (!hasNewOrders || muted || audioBlocked) {
      stopNewOrderAlert();
      return;
    }
    startNewOrderAlert();
  }, [audioBlocked, muted, orders, startNewOrderAlert, stopNewOrderAlert]);

  // Stop the repeating alert when the dashboard unmounts.
  useEffect(() => stopNewOrderAlert, [stopNewOrderAlert]);

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

  function exportTodayCsv() {
    const rows = [
      ["Order number", "Created time", "Customer name", "Phone", "Email", "Status", "Payment method", "Payment status", "Subtotal", "Promo code", "Discount", "Tax", "Processing fee", "Tip", "Total", "Items summary"],
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
        order.promo_code ?? "",
        order.discount_amount ?? 0,
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

  async function acceptWithReadyTime(orderNumber: string, minutes: number) {
    setAcceptingOrder(null);
    setCustomReadyMinutes((current) => ({ ...current, [orderNumber]: "" }));
    await updateStatus(orderNumber, "accepted", minutes);
  }

  async function confirmCustomAccept() {
    if (!acceptingOrder) return;
    const orderNumber = acceptingOrder;
    const minutes = Math.round(Number(customReadyMinutes[orderNumber]));
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setRefreshError("Enter a custom ready time greater than 0 minutes.");
      return;
    }
    await acceptWithReadyTime(orderNumber, minutes);
  }

  async function updateStatus(orderNumber: string, nextStatus: OrderStatus, estimatedReadyMinutes?: number) {
    updatingOrdersRef.current = new Set(updatingOrdersRef.current).add(orderNumber);
    setUpdatingOrders(new Set(updatingOrdersRef.current));
    const optimisticOrders = ordersRef.current.map((order) => (order.order_number === orderNumber ? { ...order, status: nextStatus } : order));
    ordersRef.current = optimisticOrders;
    setOrders(optimisticOrders);
    if (nextStatus !== "new") {
      const remainingNewOrders = new Set(optimisticOrders.filter((order) => order.status === "new").map((order) => order.order_number));
      previousNewOrders.current = remainingNewOrders;
      if (remainingNewOrders.size === 0) stopNewOrderAlert();
    }
    try {
      const response = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, status: nextStatus, estimatedReadyMinutes })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Status update failed.");
      if (data.order) {
        const confirmedOrders = ordersRef.current.map((order) => (order.order_number === orderNumber ? { ...order, ...data.order } : order));
        ordersRef.current = confirmedOrders;
        setOrders(confirmedOrders);
        if (data.order.status && data.order.status !== "new") {
          const nextNewOrders = new Set(confirmedOrders.filter((order) => order.status === "new").map((order) => order.order_number));
          previousNewOrders.current = nextNewOrders;
          if (nextNewOrders.size === 0) stopNewOrderAlert();
        }
      }
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

  const printKitchenTicket = useCallback(async (order: AdminOrder) => {
    const orderNumber = order.order_number;
    setNetworkPrintingOrders((current) => new Set(current).add(orderNumber));
    try {
      const response = await fetch("/api/admin/print-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Kitchen print failed.");
      saveKitchenPrintState(orderNumber, {
        status: "printed",
        message: typeof data.printerLabel === "string" ? `Printed (${data.printerLabel})` : "Printed",
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      saveKitchenPrintState(orderNumber, {
        status: "failed",
        message: error instanceof Error ? error.message : "Unknown print error.",
        updatedAt: new Date().toISOString()
      });
    } finally {
      setNetworkPrintingOrders((current) => {
        const next = new Set(current);
        next.delete(orderNumber);
        return next;
      });
    }
  }, [saveKitchenPrintState]);

  useEffect(() => {
    if (!printStatusLoaded) return;
    orders.filter(shouldAutoPrintOrder).forEach((order) => {
      const orderNumber = order.order_number;
      if (networkPrintingOrders.has(orderNumber)) return;
      if (autoPrintAttemptedRef.current.has(orderNumber)) return;
      if (kitchenPrintStatusRef.current[orderNumber]) return;
      autoPrintAttemptedRef.current.add(orderNumber);
      void printKitchenTicket(order);
    });
  }, [networkPrintingOrders, orders, printKitchenTicket, printStatusLoaded]);

  function openAdminSection(section: AdminSection, label?: string) {
    setActiveSection(section);
    setAdminMenuOpen(false);
    if (label === "Past Orders") setFilter("past");
    if (label === "Current Orders") setFilter("active");
    const targetId =
      section === "summary" ? "admin-summary" :
      section === "sold-out" ? "admin-sold-out" :
      section === "ordering" ? "admin-ordering-status" :
      section === "reports" ? "admin-reports" :
      section === "promo" ? "admin-promo" :
      section === "special-offers" ? "admin-special-offers" :
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
    setAddItemSearch("");
    setNewItemDraft(null);
    setEditingOrder({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      customerEmail: order.customer_email ?? "",
      customerNotes: order.customer_notes ?? "",
      pickupTimeType: order.pickup_time_type ?? "asap",
      scheduledPickupTime: toDateTimeLocal(order.scheduled_pickup_time),
      tipAmount: String(order.tip_amount ?? 0),
      promoCode: order.promo_code ?? null,
      discountAmount: String(order.discount_amount ?? 0),
      paymentMethod: order.payment_method,
      paymentStatus: order.payment_status,
      items: order.order_items
        .filter((item) => item.id)
        .map((item) => {
          // The stored unit_price already includes any extra charge; split it back out for editing.
          const customization = { ...(item.customization ?? {}) } as Record<string, unknown>;
          const extraChargeAmount = Math.max(0, Number(customization.extraChargeAmount ?? 0) || 0);
          const extraChargeLabel = typeof customization.extraChargeLabel === "string" ? customization.extraChargeLabel : "";
          delete customization.extraChargeAmount;
          delete customization.extraChargeLabel;
          const baseUnitPrice = Math.max(0, Number((Number(item.unit_price) - extraChargeAmount).toFixed(2)));
          return {
            localKey: String(item.id),
            id: String(item.id),
            menuItemId: item.menu_item_id ?? "",
            itemNumber: item.item_number,
            itemName: item.item_name,
            category: item.category ?? "",
            quantity: String(item.quantity),
            unitPrice: String(baseUnitPrice),
            customization,
            extraChargeLabel,
            extraChargeAmount: extraChargeAmount > 0 ? String(extraChargeAmount) : ""
          };
        })
    });
  }

  function closeEditOrder() {
    // Clear the ref synchronously (the useEffect runs after render) so a save-triggered
    // refresh isn't blocked by the "finish editing" guard.
    editingOrderRef.current = false;
    setEditingOrder(null);
    setAddItemSearch("");
    setNewItemDraft(null);
  }

  function updateEditField(field: keyof Omit<EditOrderState, "items">, value: string) {
    setEditingOrder((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateEditItem(localKey: string, field: "quantity" | "unitPrice" | "extraChargeLabel" | "extraChargeAmount", value: string) {
    setEditingOrder((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => (item.localKey === localKey ? { ...item, [field]: value } : item))
          }
        : current
    );
  }

  function removeEditItem(localKey: string) {
    setEditingOrder((current) => (current ? { ...current, items: current.items.filter((item) => item.localKey !== localKey) } : current));
  }

  // Build a fresh draft when the admin picks a menu item to add. Spicy items default to Hot.
  function selectMenuItemToAdd(item: MenuItem) {
    setNewItemDraft({
      menuItemId: item.id,
      size: defaultSize(item),
      spiceLevel: item.spicy ? "Hot" : "None",
      lunchRice: "Pork Fried Rice",
      lunchSide: "Egg Roll",
      quantity: "1",
      notes: "",
      extraChargeLabel: "",
      extraChargeAmount: ""
    });
  }

  function addDraftItemToOrder() {
    if (!newItemDraft || !editingOrder) return;
    const menuItem = menuItems.find((candidate) => candidate.id === newItemDraft.menuItemId);
    if (!menuItem) return;
    const isAppetizer = menuItem.category === "Appetizers";
    const lunch = isLunchItem(menuItem);
    const combo = isComboItem(menuItem) || newItemDraft.size === "combo";
    const customization: CartCustomization = {
      size: newItemDraft.size,
      ...(isAppetizer ? {} : { spiceLevel: newItemDraft.spiceLevel }),
      ...(lunch ? { lunchRice: newItemDraft.lunchRice, lunchSide: newItemDraft.lunchSide } : {}),
      ...(combo ? { includedItems: comboIncludedItems } : {}),
      ...(newItemDraft.notes.trim() ? { notes: newItemDraft.notes.trim() } : {})
    };
    const basePrice = getItemPrice(menuItem, newItemDraft.size);
    setEditingOrder((current) =>
      current
        ? {
            ...current,
            items: [
              ...current.items,
              {
                localKey: makeLocalKey(),
                id: null,
                menuItemId: menuItem.id,
                itemNumber: menuItem.number,
                itemName: menuItem.name,
                category: menuItem.category,
                quantity: String(Math.max(1, Math.round(Number(newItemDraft.quantity) || 1))),
                unitPrice: String(basePrice),
                customization: customization as Record<string, unknown>,
                extraChargeLabel: newItemDraft.extraChargeLabel.trim(),
                extraChargeAmount: newItemDraft.extraChargeAmount
              }
            ]
          }
        : current
    );
    setNewItemDraft(null);
    setAddItemSearch("");
  }

  function editedTotals(order: EditOrderState | null) {
    const subtotal = (order?.items ?? []).reduce((sum, item) => {
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const extra = Math.max(0, Number(item.extraChargeAmount) || 0);
      return sum + quantity * (price + extra);
    }, 0);
    // Keep the original promo discount, clamped so it can never exceed the new subtotal.
    const discount = Math.min(subtotal, Math.max(0, Number(order?.discountAmount ?? 0) || 0));
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = discountedSubtotal * restaurant.taxRate;
    const processingFee = discountedSubtotal * restaurant.processingFeeRate;
    const tip = Math.max(0, Number(order?.tipAmount ?? 0) || 0);
    return { subtotal, discount, tax, processingFee, tip, total: Math.max(0, discountedSubtotal + tax + processingFee + tip) };
  }

  async function saveEditOrder() {
    if (!editingOrder) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const items = editingOrder.items.map((item) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        itemNumber: item.itemNumber,
        itemName: item.itemName,
        category: item.category,
        quantity: Math.round(Number(item.quantity)),
        unitPrice: Number(item.unitPrice),
        customization: item.customization ?? {},
        extraChargeLabel: item.extraChargeLabel.trim(),
        extraChargeAmount: Number(item.extraChargeAmount) || 0
      }));
      if (!editingOrder.customerName.trim() || !editingOrder.customerPhone.trim() || !editingOrder.customerEmail.trim()) throw new Error("Name, phone, and email are required.");
      if (!items.length) throw new Error("An order must have at least one item.");
      if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity < 1)) throw new Error("Every item needs a quantity of 1 or more.");
      if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) throw new Error("Item prices cannot be negative.");
      if (items.some((item) => !Number.isFinite(item.extraChargeAmount) || item.extraChargeAmount < 0)) throw new Error("Extra charge amounts cannot be negative.");
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
      closeEditOrder();
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

  async function createTestOrder() {
    setCreatingTestOrder(true);
    setToolMessage(null);
    try {
      const response = await fetch("/api/admin/test-order", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create test order.");
      setToolMessage(`Test order ${data.orderNumber} created. It is marked TEST and can be kitchen-printed like a real order.`);
      await loadOrders({ manual: true });
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Could not create test order.");
    } finally {
      setCreatingTestOrder(false);
    }
  }

  const printDailyReport = useCallback(async (options: { auto?: boolean } = {}) => {
    setDailyReportBusy(true);
    if (!options.auto) setToolMessage(null);
    try {
      const response = await fetch("/api/admin/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options.auto ? { auto: true } : { force: true })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Daily report print failed.");
      if (data.skipped) {
        if (!options.auto) setToolMessage("Daily report was already printed today.");
      } else {
        setToolMessage(`Daily report printed${data.summary ? ` (${data.summary.totalOrders} orders, total ${formatPrice(data.summary.grandTotal)})` : ""}.`);
      }
      return true;
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Daily report print failed.");
      return false;
    } finally {
      setDailyReportBusy(false);
    }
  }, []);

  // Auto-print the daily report at/after 10:00 PM Eastern, once per calendar day. A localStorage
  // marker (per device) plus the server-side dedupe guard prevent duplicate prints.
  useEffect(() => {
    const storageKey = "china-delight-daily-report-date";
    function easternHour() {
      return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
    }
    function easternDay() {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    }
    function checkAutoPrint() {
      if (dailyReportAutoRef.current) return;
      if (easternHour() < 22) return;
      const todayKey = easternDay();
      if (window.localStorage.getItem(storageKey) === todayKey) return;
      dailyReportAutoRef.current = true;
      // Mark attempted up-front so a printer error doesn't cause repeated retries all night.
      window.localStorage.setItem(storageKey, todayKey);
      void printDailyReport({ auto: true }).finally(() => {
        dailyReportAutoRef.current = false;
      });
    }
    checkAutoPrint();
    const timer = window.setInterval(checkAutoPrint, 60000);
    return () => window.clearInterval(timer);
  }, [printDailyReport]);

  const currentEditTotals = editedTotals(editingOrder);
  const draftMenuItem = newItemDraft ? menuItems.find((candidate) => candidate.id === newItemDraft.menuItemId) ?? null : null;
  const addSearchResults = (() => {
    const query = addItemSearch.trim().toLowerCase();
    if (!query) return [] as MenuItem[];
    return menuItems
      .filter((item) => `#${item.number} ${item.name} ${item.chineseName ?? ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  })();

  return (
    <section className="mx-auto max-w-7xl bg-[linear-gradient(180deg,#fff7e8,#f4fbfb)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-black uppercase tracking-[0.16em] text-china-red">Admin</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Orders dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <p className="rounded-md border border-china-gold/60 bg-[#fff7e8] px-4 py-3 font-bold text-stone-800 shadow-sm">{visible.length} visible orders</p>
          <button
            onClick={() => loadOrders({ manual: true })}
            disabled={refreshing || updatingOrders.size > 0}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-gold/70 bg-white px-4 py-3 font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh now
          </button>
          <button onClick={toggleMute} className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-gold/70 bg-white px-4 py-3 font-bold text-stone-800">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            {muted ? "Unmute" : audioBlocked ? "Enable sound" : "Mute"}
          </button>
          <button onClick={logout} className="focus-ring rounded-md border border-china-gold/70 bg-white px-4 py-3 font-bold text-stone-800">
            Sign out
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-sm font-bold text-stone-600 sm:flex-row sm:flex-wrap sm:items-center">
        <span>Auto-refreshing every 15 seconds.</span>
        <span>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading latest orders..."}</span>
        {refreshError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{refreshError}</span>}
        {operationsError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{operationsError}</span>}
        {audioBlocked && !muted && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">Browser blocked sound. Click Enable sound once to allow alerts.</span>}
      </div>

      <div className="mt-5 lg:hidden">
        <button
          onClick={() => setAdminMenuOpen((current) => !current)}
          className="focus-ring flex min-h-12 w-full items-center justify-between rounded-md border border-china-gold/70 bg-[#fff7e8] px-4 font-black text-stone-900 shadow-sm"
        >
          <span className="inline-flex items-center gap-2">
            <Menu className="h-5 w-5" />
            Admin menu
          </span>
          {adminMenuOpen ? <X className="h-5 w-5" /> : null}
        </button>
        {adminMenuOpen && (
          <div className="mt-2 grid gap-2 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-2 shadow-sm">
            {adminSections.map((section) => (
              <button
                key={`${section.label}-${section.value}`}
                onClick={() => openAdminSection(section.value, section.label)}
                className="focus-ring min-h-11 rounded-md px-3 text-left font-black text-stone-800 hover:bg-white"
              >
                {section.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[13rem_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-2 shadow-sm">
            <p className="px-2 py-2 text-xs font-black uppercase tracking-[0.14em] text-china-red">Admin menu</p>
            <div className="grid gap-1">
              {adminSections.map((section) => (
                <button
                  key={`${section.label}-${section.value}`}
                  onClick={() => openAdminSection(section.value, section.label)}
                  className={`focus-ring rounded-md px-3 py-2 text-left text-sm font-black ${
                    activeSection === section.value ? "bg-china-red text-white shadow-sm" : "text-stone-800 hover:bg-white"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
      <div id="admin-ordering-status" className="scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-4 shadow-sm">
        <p className="font-black text-china-red">Online Ordering Status</p>
        <p className="mt-1 text-sm font-bold text-stone-700">
          {operations?.orderingAllowed ? "Taking online orders" : "Not taking online orders"}
          {operations?.settings.orderingOverride.mode !== "normal" && operations?.nextBoundary ? ` until ${operations.nextBoundary.label}` : ""}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => updateOperations({ orderingOverrideMode: "open" })}
            className={`focus-ring min-h-10 rounded-md border px-3 text-sm font-black ${
              operations?.settings.orderingOverride.mode === "open" ? "border-china-green bg-china-green text-white" : "border-china-green/60 bg-white text-china-green"
            }`}
          >
            Taking orders
          </button>
          <button
            onClick={() => updateOperations({ orderingOverrideMode: "paused" })}
            className={`focus-ring min-h-10 rounded-md border px-3 text-sm font-black ${
              operations?.settings.orderingOverride.mode === "paused" ? "border-china-red bg-china-red text-white" : "border-china-red/60 bg-white text-china-red"
            }`}
          >
            Pause orders
          </button>
          <button
            onClick={() => updateOperations({ orderingOverrideMode: "normal" })}
            className={`focus-ring min-h-10 rounded-md border px-3 text-sm font-black ${
              !operations || operations.settings.orderingOverride.mode === "normal" ? "border-china-gold bg-china-gold text-stone-950" : "border-china-gold/70 bg-white text-stone-800"
            }`}
          >
            Follow hours
          </button>
        </div>
      </div>

      <div id="admin-orders" className="mt-6 grid scroll-mt-24 gap-4 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm">
        <p className="font-black text-china-red">Current Orders</p>
        <label className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, order number, or item" className="focus-ring h-14 w-full rounded-md border border-china-gold/70 bg-white pl-12 pr-4 text-lg" />
        </label>
        <p className="text-xs font-bold text-stone-600">Kitchen tickets print to the local Epson printer. New orders auto-print once while this page is open.</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={createTestOrder}
            disabled={creatingTestOrder}
            className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creatingTestOrder ? "Creating test order..." : "Create test order"}
          </button>
          <button
            onClick={() => printDailyReport()}
            disabled={dailyReportBusy}
            className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dailyReportBusy ? "Printing report..." : "Print daily report"}
          </button>
        </div>
        <p className="text-xs font-bold text-stone-600">The daily report also prints automatically at 10:00 PM. Test orders are clearly marked TEST and excluded from report totals.</p>
        {toolMessage && <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">{toolMessage}</p>}
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-4 py-2 font-black ${
              filter === tab.value ? "border-china-red bg-china-red text-white" : "border-china-gold/70 bg-white text-stone-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {visible.map((order) => {
          const expanded = expandedOrders.has(order.order_number);
          const itemCount = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
          const printState = kitchenPrintStatus[order.order_number];
          const isTestOrder = order.order_number.toUpperCase().startsWith("TEST");
          return (
          <article key={order.order_number} className={`rounded-lg border p-2 shadow-sm ${isTestOrder ? "border-2 border-dashed border-purple-400 bg-purple-50" : order.status === "new" ? "border-2 border-china-red bg-red-50 ring-2 ring-china-gold/50" : "border-china-gold/50 bg-white"}`}>
            <div className="flex flex-col justify-between gap-2 lg:flex-row">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-china-red">{order.order_number}</p>
                  {isTestOrder && <span className="rounded-md bg-purple-600 px-2 py-1 text-xs font-black uppercase text-white">TEST</span>}
                  <span className={`rounded-md border px-2 py-1 text-xs font-black uppercase ${statusStyles[order.status]}`}>{statusLabel(order.status)}</span>
                  {order.status === "new" && <span className="rounded-md bg-china-gold px-2 py-1 text-xs font-black uppercase text-china-ink">New Order</span>}
                </div>
                <h2 className="mt-1 truncate text-lg font-black">{order.customer_name}</h2>
                <p className="text-sm text-stone-600">
                  <a href={`tel:${order.customer_phone.replace(/\D/g, "")}`} className="font-bold text-stone-800 underline-offset-2 hover:underline">{order.customer_phone}</a>
                  {order.customer_email ? ` | ${order.customer_email}` : ""}
                </p>
                <p className="mt-1 text-sm font-bold text-stone-700">
                  {order.created_at ? formatPickupDateTime(order.created_at) : "—"} · Total: {formatPrice(order.total)} · {itemCount} item{itemCount === 1 ? "" : "s"}
                </p>
                {Number(order.discount_amount ?? 0) > 0 && (
                  <p className="mt-1 text-sm font-bold text-china-red">Promo{order.promo_code ? ` ${order.promo_code}` : ""}: -{formatPrice(Number(order.discount_amount))}</p>
                )}
                {order.customer_notes && hasInstructionAlert(order.customer_notes) && (
                  <p className="mt-1 rounded-md bg-yellow-100 px-2 py-1 text-sm font-bold text-yellow-950">Notes: {order.customer_notes}</p>
                )}
              </div>
              <div className="grid gap-2 sm:min-w-56">
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
                    className="focus-ring h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="focus-ring min-h-11 rounded-md bg-china-red px-3 text-sm font-black text-white shadow-sm disabled:cursor-not-allowed disabled:bg-stone-400"
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
                      className={`focus-ring min-h-10 rounded-md border px-2 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${statusStyles[nextStatus]}`}
                    >
                      {statusLabel(nextStatus)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => updateStatus(order.order_number, "ready")}
                  disabled={updatingOrders.has(order.order_number)}
                  className="focus-ring min-h-11 rounded-md border border-china-green bg-china-green px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Mark Ready & Email Customer
                </button>
                <button
                  onClick={() => printKitchenTicket(order)}
                  disabled={networkPrintingOrders.has(order.order_number)}
                  className="focus-ring min-h-11 rounded-md border border-china-red bg-china-red px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {networkPrintingOrders.has(order.order_number)
                    ? "Sending to printer..."
                    : printState?.status === "failed"
                      ? "Retry Kitchen Print"
                      : printState?.status === "printed"
                        ? "Reprint Kitchen Ticket"
                        : "Kitchen Print"}
                </button>
                {printState?.status === "printed" && (
                  <p className="rounded-md bg-green-100 px-2 py-1 text-xs font-black uppercase text-green-800">Printed</p>
                )}
                {printState?.status === "failed" && (
                  <p className="whitespace-pre-wrap break-words rounded-md bg-amber-100 px-2 py-2 text-xs font-black uppercase text-amber-950">
                    Failed: {printState.message ?? "Printer offline or unreachable."}
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {activeStatuses.includes(order.status) ? (
                    <button onClick={() => openEditOrder(order)} className="focus-ring inline-flex min-h-9 items-center justify-center rounded-md border border-china-gold/70 bg-white text-stone-900" aria-label="Edit order">
                      <Edit3 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="min-h-9" />
                  )}
                  <a href={`tel:${order.customer_phone.replace(/\D/g, "")}`} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-china-gold/70 bg-white text-stone-900" aria-label="Call customer">
                    <Phone className="h-4 w-4" />
                  </a>
                  <button onClick={() => copyPhone(order.customer_phone)} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-china-gold/70 bg-white text-stone-900" aria-label="Copy phone">
                    <Copy className="h-4 w-4" />
                  </button>
                  <Link href={`/admin/orders/${order.order_number}/print`} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-md border border-china-gold/70 bg-white text-stone-900" aria-label="Print ticket">
                    <Printer className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-stone-200 pt-3">
              <button
                onClick={() => toggleExpanded(order.order_number)}
                aria-expanded={expanded}
                className="focus-ring min-h-10 w-full rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800"
              >
                {expanded ? "Hide order details" : "View order details"}
              </button>
              {expanded && (
                <div className="mt-3 grid gap-2">
                  <p className="text-sm text-stone-600">{paymentLabel(order.payment_method, order.payment_status)} | Pickup: {pickupLabel(order)}</p>
                  <p className="text-sm font-bold text-stone-700">Ready: {readyLabel(order)}</p>
                  {order.delivery_address && <p className="text-sm text-stone-600">{order.delivery_address}</p>}
                  {order.customer_notes && (
                    <p className={`rounded-md px-2 py-1 text-sm font-bold ${hasInstructionAlert(order.customer_notes) ? "bg-yellow-100 text-yellow-950" : "text-stone-600"}`}>
                      Notes: {order.customer_notes}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 text-[11px] font-black">
                    {order.confirmation_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Confirmation email sent</span>}
                    {order.confirmation_email_error && (
                      <span className="max-w-full rounded-md bg-amber-100 px-2 py-1 text-amber-900" title={order.confirmation_email_error}>
                        {emailErrorLabel("Confirmation email", order.confirmation_email_error)}
                      </span>
                    )}
                    {order.accepted_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Accepted email sent</span>}
                    {order.accepted_email_error && (
                      <span className="max-w-full rounded-md bg-amber-100 px-2 py-1 text-amber-900" title={order.accepted_email_error}>
                        {emailErrorLabel("Accepted email", order.accepted_email_error)}
                      </span>
                    )}
                    {order.ready_email_sent_at && <span className="rounded-md bg-green-100 px-2 py-1 text-green-800">Ready email sent</span>}
                    {order.ready_email_error && (
                      <span className="max-w-full rounded-md bg-amber-100 px-2 py-1 text-amber-900" title={order.ready_email_error}>
                        {emailErrorLabel("Ready email", order.ready_email_error)}
                      </span>
                    )}
                  </div>
                  {order.order_items.map((item, index) => (
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
                </div>
              )}
            </div>
          </article>
          );
        })}
        {visible.length === 0 && <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-8 text-center font-bold">No orders found.</div>}
      </div>

      <div className="mt-6 grid gap-4">
        <div id="admin-sold-out" className="scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-4 shadow-sm">
          <p className="font-black text-china-red">Sold Out Today</p>
          <div className="mt-3 grid gap-2">
            <select value={soldOutSelection} onChange={(event) => setSoldOutSelection(event.target.value)} className="focus-ring h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-bold">
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
              <button onClick={() => updateOperations({ soldOutAction: "clear" })} className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
                Clear sold out
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(operations?.settings.soldOutItemIds ?? []).slice(0, 6).map((id) => {
                const item = menuItems.find((menuItem) => menuItem.id === id);
                return (
                  <button key={id} onClick={() => updateOperations({ soldOutAction: "remove", soldOutItemId: id })} className="rounded-md bg-china-aqua px-2 py-1 text-xs font-bold text-teal-950">
                    {item ? `#${item.number} ${item.name}` : id} x
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <div id="admin-reports" className="scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-black text-china-red">Today Reports</p>
            <button onClick={exportTodayCsv} className="focus-ring rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-black text-stone-800">
              Export today CSV
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            {topItems.length ? (
              topItems.map((item) => (
                <div key={item.name} className="flex justify-between gap-3 rounded-md border border-china-gold/40 bg-white px-3 py-2">
                  <span className="font-bold">{item.name}</span>
                  <span className="shrink-0 font-black">{item.quantity} / {formatPrice(item.sales)}</span>
                </div>
              ))
            ) : (
              <p className="font-bold text-stone-600">No item sales yet today.</p>
            )}
          </div>
        </div>

        <div id="admin-settings" className="scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-4 shadow-sm lg:col-span-2">
          <p className="font-black text-china-red">Admin Settings Helper</p>
          <div className="mt-3 grid gap-2 text-sm font-bold text-stone-700 sm:grid-cols-2">
            <p>Hours: Mon-Thu 11:00 AM-10:00 PM; Fri-Sat 11:00 AM-10:30 PM; Sun 12:00 PM-10:00 PM</p>
            <p>Online ordering cutoff: Monday-Saturday 9:00 PM; Sunday 8:15 PM</p>
            <p>Lunch: Monday-Saturday, 11:00 AM-3:00 PM</p>
            <p>Tax rate: {(restaurant.taxRate * 100).toFixed(2)}%</p>
            <p>Processing fee: {(restaurant.processingFeeRate * 100).toFixed(2)}%</p>
            <p className="sm:col-span-2">
              Delivery links: {restaurant.deliveryPlatforms.map((platform) => `${platform.name} ${platform.url ? "configured" : "missing"}`).join("; ")}
            </p>
          </div>
        </div>
      </div>

      <PromoManager />

      <SpecialOffersManager />

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
          <div key={label} className="rounded-lg border border-china-gold/60 bg-white p-3 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-china-red">{label}</p>
            <p className="mt-1 text-xl font-black text-stone-900">{value}</p>
          </div>
        ))}
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
              <button onClick={closeEditOrder} className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-700" aria-label="Close edit order">
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
              {editingOrder.items.map((item) => {
                const lineTotal = (Math.max(0, Number(item.quantity) || 0)) * (Math.max(0, Number(item.unitPrice) || 0) + Math.max(0, Number(item.extraChargeAmount) || 0));
                return (
                <div key={item.localKey} className="grid gap-2 rounded-md bg-china-paper p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black">
                        #{item.itemNumber} {item.itemName}
                        {!item.id && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-green-800">New</span>}
                      </p>
                      {customizationText(item.customization) && <p className="text-xs font-bold text-stone-600">{customizationText(item.customization)}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-black">{formatPrice(lineTotal)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Qty
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={item.quantity}
                        onChange={(event) => updateEditItem(item.localKey, "quantity", event.target.value)}
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
                        onChange={(event) => updateEditItem(item.localKey, "unitPrice", event.target.value)}
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Extra charge label
                      <input
                        value={item.extraChargeLabel}
                        onChange={(event) => updateEditItem(item.localKey, "extraChargeLabel", event.target.value)}
                        placeholder="e.g. Extra chicken"
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Extra charge ($)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={item.extraChargeAmount}
                        onChange={(event) => updateEditItem(item.localKey, "extraChargeAmount", event.target.value)}
                        placeholder="0.00"
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                  </div>
                  <button onClick={() => removeEditItem(item.localKey)} className="focus-ring min-h-10 w-fit rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
                    Remove item
                  </button>
                </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-2 rounded-md border border-stone-200 p-3">
              <p className="font-black text-china-red">Add item to order</p>
              {!newItemDraft ? (
                <>
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
                    <input
                      value={addItemSearch}
                      onChange={(event) => setAddItemSearch(event.target.value)}
                      placeholder="Search menu by number or name"
                      className="focus-ring h-11 w-full rounded-md border border-stone-300 pl-9 pr-3 font-bold"
                    />
                  </label>
                  {addItemSearch.trim() && (
                    <div className="grid max-h-56 gap-1 overflow-y-auto">
                      {addSearchResults.length === 0 && <p className="px-2 py-1 text-sm font-bold text-stone-600">No matching menu items.</p>}
                      {addSearchResults.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => selectMenuItemToAdd(item)}
                          className="focus-ring flex items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm font-bold hover:bg-china-paper"
                        >
                          <span className="min-w-0 truncate">#{item.number} {item.name}</span>
                          <Plus className="h-4 w-4 shrink-0 text-china-red" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : draftMenuItem ? (
                <div className="grid gap-2 rounded-md bg-china-paper p-2">
                  <p className="font-black">#{draftMenuItem.number} {draftMenuItem.name}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {itemSizesFor(draftMenuItem).length > 1 && (
                      <label className="grid gap-1 text-xs font-black text-stone-700">
                        Size
                        <select
                          value={newItemDraft.size}
                          onChange={(event) => setNewItemDraft((current) => (current ? { ...current, size: event.target.value as MenuPriceKey } : current))}
                          className="focus-ring h-10 rounded-md border border-stone-300 bg-white px-2 font-bold"
                        >
                          {itemSizesFor(draftMenuItem).map((key) => (
                            <option key={key} value={key}>{sizeLabels[key]}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Qty
                      <input
                        type="number"
                        min="1"
                        inputMode="numeric"
                        value={newItemDraft.quantity}
                        onChange={(event) => setNewItemDraft((current) => (current ? { ...current, quantity: event.target.value } : current))}
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                    {draftMenuItem.category !== "Appetizers" && (
                      <label className="grid gap-1 text-xs font-black text-stone-700">
                        Spice level
                        <select
                          value={newItemDraft.spiceLevel}
                          onChange={(event) => setNewItemDraft((current) => (current ? { ...current, spiceLevel: event.target.value as (typeof spiceLevels)[number] } : current))}
                          className="focus-ring h-10 rounded-md border border-stone-300 bg-white px-2 font-bold"
                        >
                          {spiceLevels.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {isLunchItem(draftMenuItem) && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1 text-xs font-black text-stone-700">
                        Lunch rice
                        <select
                          value={newItemDraft.lunchRice}
                          onChange={(event) => setNewItemDraft((current) => (current ? { ...current, lunchRice: event.target.value as LunchRiceChoice } : current))}
                          className="focus-ring h-10 rounded-md border border-stone-300 bg-white px-2 font-bold"
                        >
                          {lunchRiceChoices.map((choice) => (
                            <option key={choice} value={choice}>{choice}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs font-black text-stone-700">
                        Lunch side
                        <select
                          value={newItemDraft.lunchSide}
                          onChange={(event) => setNewItemDraft((current) => (current ? { ...current, lunchSide: event.target.value as LunchSideChoice } : current))}
                          className="focus-ring h-10 rounded-md border border-stone-300 bg-white px-2 font-bold"
                        >
                          {lunchSideChoices.map((choice) => (
                            <option key={choice} value={choice}>{choice}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {(isComboItem(draftMenuItem) || newItemDraft.size === "combo") && (
                    <p className="rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-china-red">Combo includes {comboIncludedItems.join(" and ")}.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Extra charge label
                      <input
                        value={newItemDraft.extraChargeLabel}
                        onChange={(event) => setNewItemDraft((current) => (current ? { ...current, extraChargeLabel: event.target.value } : current))}
                        placeholder="e.g. Extra chicken"
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-black text-stone-700">
                      Extra charge ($)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={newItemDraft.extraChargeAmount}
                        onChange={(event) => setNewItemDraft((current) => (current ? { ...current, extraChargeAmount: event.target.value } : current))}
                        placeholder="0.00"
                        className="focus-ring h-10 rounded-md border border-stone-300 px-2 font-bold"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-black text-stone-700">
                    Special instructions
                    <textarea
                      value={newItemDraft.notes}
                      onChange={(event) => setNewItemDraft((current) => (current ? { ...current, notes: event.target.value } : current))}
                      rows={2}
                      className="focus-ring rounded-md border border-stone-300 px-2 py-2 font-bold"
                      placeholder="Allergy notes, preparation requests..."
                    />
                  </label>
                  {hasReviewPrice(draftMenuItem, newItemDraft.size) && (
                    <p className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">This item has no set price. Enter the unit price after adding it.</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setNewItemDraft(null); }} className="focus-ring min-h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-black text-stone-700">
                      Cancel
                    </button>
                    <button onClick={addDraftItemToOrder} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-china-red px-3 text-sm font-black text-white">
                      <Plus className="h-4 w-4" />
                      Add to order
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 rounded-md border border-stone-200 p-3 text-sm font-bold sm:grid-cols-5">
              <p>Subtotal: {formatPrice(currentEditTotals.subtotal)}</p>
              {currentEditTotals.discount > 0 && (
                <p className="text-china-red">
                  Promo{editingOrder.promoCode ? ` (${editingOrder.promoCode})` : ""}: -{formatPrice(currentEditTotals.discount)}
                </p>
              )}
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
              <button onClick={closeEditOrder} className="focus-ring min-h-12 rounded-md border border-stone-300 px-4 font-black text-stone-700">
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
            <div className="mt-4 grid grid-cols-3 gap-2">
              {acceptReadyMinuteOptions.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => acceptWithReadyTime(acceptingOrder, minutes)}
                  disabled={updatingOrders.has(acceptingOrder)}
                  className="focus-ring min-h-12 rounded-md bg-china-red px-3 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {minutes} min
                </button>
              ))}
            </div>
            <label className="mt-4 grid gap-1 text-sm font-black text-stone-700">
              Custom minutes
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={customReadyMinutes[acceptingOrder] ?? ""}
                onChange={(event) => setCustomReadyMinutes((current) => ({ ...current, [acceptingOrder]: event.target.value }))}
                className="focus-ring h-12 w-full rounded-md border border-stone-300 px-3"
                placeholder="Minutes"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setAcceptingOrder(null)} className="focus-ring min-h-12 rounded-md border border-stone-300 px-4 font-black text-stone-700">
                Cancel
              </button>
              <button onClick={confirmCustomAccept} className="focus-ring min-h-12 rounded-md bg-china-deep px-4 font-black text-white">
                Custom
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
