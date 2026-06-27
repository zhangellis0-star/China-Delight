"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Edit3, Menu, Phone, Plus, Printer, RefreshCw, Search, Volume2, VolumeX, X } from "lucide-react";
import { customizationText } from "@/lib/order-display";
import { activeOrderStatuses, editableOrderStatuses, finalOrderStatuses, normalizeOrderStatus, orderStatusLabel } from "@/lib/order-status";
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

declare global {
  interface Window {
    AndroidPrintBridge?: {
      printOrderWithRequest?: (orderNumber: string, requestId: string) => void;
      printOrder?: (orderNumber: string) => void;
    };
  }
}

type AdminFilter = "active" | "new" | "accepted" | "past" | "picked_up" | "all";
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
type AdminSection = "orders" | "past-orders" | "sold-out" | "ordering" | "reports" | "promotions" | "settings";
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
type DailyReportSummaryView = {
  totalOrders: number;
  foodSales: number;
  discounts: number;
  tax: number;
  processingFees: number;
  tips: number;
  cashTotal: number;
  stripeTotal: number;
  grandTotal: number;
};
type DailyReportDetail = {
  date: string;
  dateLabel: string;
  testOrdersExcluded: number;
  summary: DailyReportSummaryView;
  orders: Array<{
    orderNumber: string;
    createdAt: string | null;
    timeLabel: string;
    customerName: string;
    customerPhone: string;
    status: OrderStatus;
    paymentMethod: PaymentMethod | string;
    paymentStatus?: PaymentStatus | null;
    subtotal: number;
    tax: number;
    processingFee: number;
    tip: number;
    discount: number;
    total: number;
    itemsSummary: string;
  }>;
};
type DailyReportRecent = Pick<DailyReportDetail, "date" | "dateLabel" | "testOrdersExcluded" | "summary">;

const statuses: OrderStatus[] = editableOrderStatuses;
const adminSections: Array<{ value: AdminSection; label: string }> = [
  { value: "orders", label: "Orders" },
  { value: "past-orders", label: "Past Orders" },
  { value: "sold-out", label: "Sold Out Items" },
  { value: "ordering", label: "Online Ordering Status" },
  { value: "settings", label: "Settings Info" }
];
const promotionsSections: Array<{ value: AdminSection; label: string }> = [
  { value: "promotions", label: "Promotions" }
];
const adminSectionGroups: Array<{ heading: string; sections: Array<{ value: AdminSection; label: string }> }> = [
  { heading: "Orders", sections: adminSections.slice(0, 2) },
  { heading: "Promotions", sections: promotionsSections },
  { heading: "Reports & Exports", sections: [{ value: "reports", label: "Reports & Exports" }] },
  { heading: "Operations", sections: adminSections.slice(2) }
];
const activeStatuses: OrderStatus[] = activeOrderStatuses;
const pastStatuses: OrderStatus[] = finalOrderStatuses;
const acceptReadyMinuteOptions = [5, 15, 25];
const kitchenPrintStorageKey = "china-delight-kitchen-print-statuses";
const adminSectionStorageKey = "china-delight-admin-section";
const adminSectionValues: AdminSection[] = ["orders", "past-orders", "sold-out", "ordering", "reports", "promotions", "settings"];
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

function isAdminSection(value: string | null): value is AdminSection {
  return Boolean(value && adminSectionValues.includes(value as AdminSection));
}

function sectionFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const querySection = params.get("section");
  if (isAdminSection(querySection)) return querySection;
  const hashSection = window.location.hash.replace(/^#/, "");
  if (isAdminSection(hashSection)) return hashSection;
  return null;
}

function saveAdminSectionToUrl(section: AdminSection) {
  const url = new URL(window.location.href);
  url.searchParams.set("section", section);
  url.hash = "";
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

function itemSizesFor(item: MenuItem) {
  return (Object.keys(item.prices) as MenuPriceKey[]).filter((key) => item.prices[key] !== undefined);
}
const alertWords = ["allergy", "allergic", "peanut", "shellfish", "gluten", " no ", "extra", "sauce"];
const statusStyles: Record<OrderStatus, string> = {
  new: "bg-red-100 text-china-red border-red-300",
  accepted: "bg-china-aqua text-teal-900 border-teal-200",
  picked_up: "bg-emerald-100 text-emerald-950 border-emerald-300"
};

function paymentLabel(method?: PaymentMethod, status?: PaymentStatus) {
  if (method !== "stripe") return "Pay at pickup / cash";
  if (status === "paid") return "Stripe - Paid";
  if (status === "failed") return "Stripe - Payment failed";
  if (status === "refunded") return "Stripe - Refunded";
  return "Stripe - Awaiting payment";
}

function readyLabel(order: AdminOrder) {
  const time = confirmedReadyTime(order.estimated_ready_at);
  if (!time) return "Not set — accept the order to set a ready time";
  return order.estimated_ready_minutes ? `${time} (${order.estimated_ready_minutes} min)` : time;
}

function statusLabel(status: OrderStatus | AdminFilter) {
  if (status === "past") return "Past Orders";
  if (status === "active") return "Active";
  if (status === "all") return "All";
  return orderStatusLabel(status);
}

function isScheduledPickup(order: Pick<AdminOrder, "pickup_time_type" | "scheduled_pickup_time">) {
  return Boolean(order.scheduled_pickup_time) && (!order.pickup_time_type || order.pickup_time_type === "scheduled");
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
  const status = normalizeOrderStatus(order.status);
  if (filter === "all") return true;
  if (filter === "active") return activeStatuses.includes(status);
  if (filter === "past") return pastStatuses.includes(status);
  return status === filter;
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

function normalizeAdminOrder(order: AdminOrder): AdminOrder {
  return { ...order, status: normalizeOrderStatus(order.status) };
}

function bridgePrintOrder(orderNumber: string) {
  return new Promise<string>((resolve, reject) => {
    const bridge = window.AndroidPrintBridge;
    if (!bridge?.printOrderWithRequest) {
      reject(new Error("Open this admin page inside the China Delight Admin Printer tablet app, then try printing again."));
      return;
    }

    const requestId = `print-${orderNumber}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const timeout = window.setTimeout(() => {
      window.removeEventListener("cd-bridge-print-result", onResult as EventListener);
      reject(new Error("Tablet print bridge did not report a result. Check the tablet app and printer connection."));
    }, 20000);

    function onResult(event: Event) {
      const detail = (event as CustomEvent<{ requestId?: string; ok?: boolean; message?: string }>).detail;
      if (detail?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener("cd-bridge-print-result", onResult as EventListener);
      if (detail.ok) {
        resolve(detail.message || "Printed through tablet bridge.");
      } else {
        reject(new Error(detail.message || "Tablet bridge print failed."));
      }
    }

    window.addEventListener("cd-bridge-print-result", onResult as EventListener);
    try {
      bridge.printOrderWithRequest(orderNumber, requestId);
    } catch (error) {
      window.clearTimeout(timeout);
      window.removeEventListener("cd-bridge-print-result", onResult as EventListener);
      reject(error instanceof Error ? error : new Error("Tablet bridge print failed."));
    }
  });
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
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
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
  const [reportsPanelOpen, setReportsPanelOpen] = useState(false);
  const [reportDate, setReportDate] = useState("");
  const [dailyReportDetail, setDailyReportDetail] = useState<DailyReportDetail | null>(null);
  const [recentReports, setRecentReports] = useState<DailyReportRecent[]>([]);
  const [dailyReportHistoryLoading, setDailyReportHistoryLoading] = useState(false);
  const [dailyReportHistoryError, setDailyReportHistoryError] = useState<string | null>(null);
  const [dailyReportReprintDate, setDailyReportReprintDate] = useState<string | null>(null);
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const dailyReportBusyRef = useRef(false);
  const dailyReportReprintRef = useRef<string | null>(null);
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
    const savedSection = window.localStorage.getItem(adminSectionStorageKey);
    const restoredSection = sectionFromLocation() ?? (isAdminSection(savedSection) ? savedSection : null);
    if (!restoredSection) return;
    setActiveSection(restoredSection);
    window.localStorage.setItem(adminSectionStorageKey, restoredSection);
    saveAdminSectionToUrl(restoredSection);
    if (restoredSection === "past-orders") setFilter("past");
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
        const serverOrders = ((data.orders ?? []) as AdminOrder[]).map(normalizeAdminOrder);
        const serverOrderNumbers = new Set(serverOrders.map((order) => order.order_number));
        const localOrders = normalizeLocalOrder(window.localStorage.getItem("china-delight-last-order")).map(normalizeAdminOrder).filter((order) => !serverOrderNumbers.has(order.order_number));
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

  // Repeat the alert while any order is still "new"; stop as soon as none remain or sound is muted/blocked.
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
    const totalSalesOrders = todayOrders;
    const totalSales = totalSalesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const tips = totalSalesOrders.reduce((sum, order) => sum + Number(order.tip_amount || 0), 0);
    return {
      totalOrders: todayOrders.length,
      newOrders: todayOrders.filter((order) => order.status === "new").length,
      activeOrders: todayOrders.filter((order) => activeStatuses.includes(order.status)).length,
      pickedUp: todayOrders.filter((order) => order.status === "picked_up").length,
      totalSales,
      cashSales: cash.reduce((sum, order) => sum + Number(order.total || 0), 0),
      stripeSales: paidStripe.reduce((sum, order) => sum + Number(order.total || 0), 0),
      tips,
      averageOrder: totalSalesOrders.length ? totalSales / totalSalesOrders.length : 0
    };
  }, [todayOrders]);

  const topItems = useMemo(() => {
    const rows = new Map<string, { name: string; quantity: number; sales: number }>();
    todayOrders.forEach((order) => {
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

  const loadDailyReportHistory = useCallback(async (date = reportDate || easternDateKey()) => {
    setDailyReportHistoryLoading(true);
    setDailyReportHistoryError(null);
    try {
      const response = await fetch(`/api/admin/daily-report?date=${encodeURIComponent(date)}&days=30`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load daily report history.");
      setDailyReportDetail(data.report ?? null);
      setRecentReports(data.recentReports ?? []);
      setReportDate(data.report?.date ?? date);
    } catch (error) {
      setDailyReportHistoryError(error instanceof Error ? error.message : "Could not load daily report history.");
    } finally {
      setDailyReportHistoryLoading(false);
    }
  }, [reportDate]);

  useEffect(() => {
    if (!reportDate) setReportDate(easternDateKey());
  }, [reportDate]);

  useEffect(() => {
    if (reportsPanelOpen && !dailyReportDetail && !dailyReportHistoryLoading) {
      void loadDailyReportHistory(reportDate || easternDateKey());
    }
  }, [dailyReportDetail, dailyReportHistoryLoading, loadDailyReportHistory, reportDate, reportsPanelOpen]);

  async function reprintDailyReport(date: string) {
    if (dailyReportReprintRef.current === date) return;
    dailyReportReprintRef.current = date;
    setDailyReportReprintDate(date);
    setToolMessage(null);
    try {
      const response = await fetch("/api/admin/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Daily report print failed.");
      setToolMessage(`Daily report printed to Epson for ${data.date}${data.summary ? ` (${data.summary.totalOrders} orders, total ${formatPrice(data.summary.grandTotal)})` : ""}.`);
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Daily report print failed.");
    } finally {
      dailyReportReprintRef.current = null;
      setDailyReportReprintDate(null);
    }
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
        const confirmedOrders = ordersRef.current.map((order) => (order.order_number === orderNumber ? normalizeAdminOrder({ ...order, ...data.order }) : order));
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

  async function copyPhone(phone: string) {
    await navigator.clipboard?.writeText(phone).catch(() => undefined);
  }

  const printKitchenTicket = useCallback(async (order: AdminOrder) => {
    const orderNumber = order.order_number;
    setNetworkPrintingOrders((current) => new Set(current).add(orderNumber));
    try {
      const message = await bridgePrintOrder(orderNumber);
      saveKitchenPrintState(orderNumber, {
        status: "printed",
        message,
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

  function openAdminSection(section: AdminSection) {
    setActiveSection(section);
    setAdminMenuOpen(false);
    setSelectedOrderNumber(null);
    window.localStorage.setItem(adminSectionStorageKey, section);
    saveAdminSectionToUrl(section);
    if (section === "past-orders") setFilter("past");
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

  const printDailyReport = useCallback(async () => {
    if (dailyReportBusyRef.current) return false;
    dailyReportBusyRef.current = true;
    setDailyReportBusy(true);
    setToolMessage(null);
    try {
      const date = reportDate || easternDateKey();
      const response = await fetch("/api/admin/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Daily report print failed.");
      setToolMessage(`Daily report printed to Epson${data.summary ? ` (${data.summary.totalOrders} orders, total ${formatPrice(data.summary.grandTotal)})` : ""}.`);
      return true;
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "Daily report print failed.");
      return false;
    } finally {
      dailyReportBusyRef.current = false;
      setDailyReportBusy(false);
    }
  }, [reportDate]);

  const currentEditTotals = editedTotals(editingOrder);
  const draftMenuItem = newItemDraft ? menuItems.find((candidate) => candidate.id === newItemDraft.menuItemId) ?? null : null;
  const addSearchResults = (() => {
    const query = addItemSearch.trim().toLowerCase();
    if (!query) return [] as MenuItem[];
    return menuItems
      .filter((item) => `#${item.number} ${item.name} ${item.chineseName ?? ""}`.toLowerCase().includes(query))
      .slice(0, 8);
  })();

  const selectedOrder = selectedOrderNumber ? orders.find((order) => order.order_number === selectedOrderNumber) ?? null : null;
  const normalizedQuery = query.trim().toLowerCase();
  const matchesQuery = (order: AdminOrder) => {
    if (!normalizedQuery) return true;
    const text = `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.order_items.map((item) => item.item_name).join(" ")}`.toLowerCase();
    return text.includes(normalizedQuery);
  };
  const activeBoard = orders.filter((order) => activeStatuses.includes(order.status) && matchesQuery(order));
  const newColumn = activeBoard.filter((order) => order.status === "new");
  // Right column groups accepted orders; picked-up orders clear off the active board.
  const prepColumn = activeBoard.filter((order) => order.status !== "new");
  const pastBoard = orders.filter((order) => pastStatuses.includes(order.status) && matchesFilter(order, filter) && matchesQuery(order));
  const sectionTitles: Record<AdminSection, string> = {
    orders: "Orders",
    "past-orders": "Past Orders",
    reports: "Reports & Exports",
    promotions: "Promotions",
    "sold-out": "Sold Out Items",
    ordering: "Online Ordering Status",
    settings: "Settings Info"
  };

  // The single primary action for a card/detail view, chosen by status: New -> Accept, Accepted -> Picked Up.
  function primaryActionFor(order: AdminOrder): { label: string; short: string; className: string; run: () => void } | null {
    if (order.status === "new") {
      if (isScheduledPickup(order)) {
        return { label: "Accept Scheduled Order", short: "Accept", className: "bg-china-red text-white", run: () => updateStatus(order.order_number, "accepted") };
      }
      return { label: "Accept Order", short: "Accept", className: "bg-china-red text-white", run: () => setAcceptingOrder(order.order_number) };
    }
    if (order.status === "accepted") return { label: "Mark Picked Up", short: "Picked Up", className: "bg-emerald-600 text-white", run: () => { updateStatus(order.order_number, "picked_up"); setSelectedOrderNumber(null); } };
    return null;
  }

  // Compact order card: customer name + tiny meta on the left, action buttons on the right.
  // Tapping the card opens the full detail drawer; the action buttons stop propagation so they
  // never open the drawer. Phone, items, payment, notes, totals live in the drawer (not the card).
  function renderOrderCard(order: AdminOrder) {
    const isTestOrder = order.order_number.toUpperCase().startsWith("TEST");
    const printState = kitchenPrintStatus[order.order_number];
    const scheduled = isScheduledPickup(order);
    const busy = updatingOrders.has(order.order_number);
    const printing = networkPrintingOrders.has(order.order_number);
    const primary = primaryActionFor(order);
    const cardTone = isTestOrder
      ? "border-2 border-dashed border-purple-400 bg-purple-50"
      : order.status === "new"
        ? "border-2 border-china-red bg-red-50"
        : "border-china-gold/50 bg-white";
    return (
      <article
        key={order.order_number}
        onClick={() => setSelectedOrderNumber(order.order_number)}
        className={`focus-ring cursor-pointer rounded-lg border px-3 py-2 shadow-sm transition hover:shadow-md ${cardTone}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black text-stone-900">{order.customer_name}</h3>
            <p className="truncate text-[11px] font-bold text-stone-500">
              <span className="text-china-red">#{order.order_number}</span>
              {" · "}
              {scheduled
                ? <span className="font-black text-china-ink">Scheduled</span>
                : <span>ASAP</span>}
              {" · "}{statusLabel(order.status)}{isTestOrder ? " · TEST" : ""}
            </p>
            {scheduled && (
              <p className="mt-1 break-words rounded-md bg-china-gold/80 px-2 py-1 text-xs font-black text-china-ink">
                Scheduled pickup: {formatPickupDateTime(order.scheduled_pickup_time as string)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {primary && (
              <button
                onClick={(event) => { event.stopPropagation(); primary.run(); }}
                disabled={busy}
                className={`focus-ring min-h-9 rounded-md px-2.5 text-xs font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${primary.className}`}
              >
                {busy ? "..." : primary.short}
              </button>
            )}
            <button
              onClick={(event) => { event.stopPropagation(); printKitchenTicket(order); }}
              disabled={printing}
              title="Print kitchen ticket to the Epson printer"
              className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-md border border-china-red bg-white px-2.5 text-xs font-black text-china-red disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Printer className="h-3.5 w-3.5" />
              {printing ? "..." : "Kitchen"}
            </button>
          </div>
        </div>
        {(printState?.status === "failed" || printState?.status === "printed") && (
          <p className={`mt-1 truncate text-[10px] font-black uppercase ${printState.status === "failed" ? "text-amber-700" : "text-green-700"}`}>
            {printState.status === "failed" ? "Kitchen print failed — open to retry" : "Kitchen ticket printed"}
          </p>
        )}
      </article>
    );
  }

  return (
    <section className="admin-shell mobile-safe mx-auto max-w-7xl bg-[linear-gradient(180deg,#fff7e8,#f4fbfb)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setAdminMenuOpen(true)}
            aria-label="Open admin menu"
            className="focus-ring inline-flex h-12 w-12 items-center justify-center rounded-md border border-china-gold/70 bg-[#fff7e8] text-stone-900 shadow-sm"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-china-red">Admin</p>
            <h1 className="break-words text-2xl font-black sm:text-3xl">{sectionTitles[activeSection]}</h1>
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => loadOrders({ manual: true })}
            disabled={refreshing || updatingOrders.size > 0}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-3 font-bold text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={toggleMute} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-3 font-bold text-stone-800">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            <span className="hidden sm:inline">{muted ? "Unmute" : audioBlocked ? "Enable sound" : "Mute"}</span>
          </button>
          <button onClick={logout} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-3 py-3 font-bold text-stone-800">
            Sign out
          </button>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-2 text-sm font-bold text-stone-600 sm:flex-row sm:flex-wrap sm:items-center">
        <span>Auto-refreshing every 15 seconds.</span>
        <span>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading latest orders..."}</span>
        {refreshError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{refreshError}</span>}
        {operationsError && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">{operationsError}</span>}
        {audioBlocked && !muted && <span className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">Browser blocked sound. Click Enable sound once to allow alerts.</span>}
      </div>

      {adminMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button aria-label="Close admin menu" onClick={() => setAdminMenuOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col gap-2 overflow-y-auto border-r border-china-gold/60 bg-[#fff7e8] p-3 shadow-warm">
            <div className="flex items-center justify-between">
              <p className="px-1 text-xs font-black uppercase tracking-[0.14em] text-china-red">Admin menu</p>
              <button onClick={() => setAdminMenuOpen(false)} aria-label="Close admin menu" className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-china-gold/70 bg-white text-stone-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3">
              {adminSectionGroups.map((group) => (
                <div key={group.heading} className="grid gap-1">
                  <p className="px-2 pt-2 text-[11px] font-black uppercase tracking-[0.14em] text-china-red">{group.heading}</p>
                  {group.sections.map((section) => (
                    <button
                      key={`${section.label}-${section.value}`}
                      onClick={() => openAdminSection(section.value)}
                      className={`focus-ring min-h-11 rounded-md px-3 text-left text-sm font-black ${
                        activeSection === section.value ? "bg-china-red text-white shadow-sm" : "text-stone-800 hover:bg-white"
                      }`}
                    >
                      {section.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      <div className="mt-6 min-w-0 max-w-full space-y-6 [overflow-x:clip]">
      {activeSection === "ordering" && (
        <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
          <p className="font-black text-china-red">Online Ordering Status</p>
          <p className="mt-1 text-sm font-bold text-stone-700">
            {operations?.orderingAllowed ? "Taking online orders" : "Not taking online orders"}
            {operations?.settings.orderingOverride.mode !== "normal" && operations?.nextBoundary ? ` until ${operations.nextBoundary.label}` : ""}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              onClick={() => updateOperations({ orderingOverrideMode: "open" })}
              className={`focus-ring min-h-11 rounded-md border px-3 text-sm font-black ${
                operations?.settings.orderingOverride.mode === "open" ? "border-china-green bg-china-green text-white" : "border-china-green/60 bg-white text-china-green"
              }`}
            >
              Taking orders
            </button>
            <button
              onClick={() => updateOperations({ orderingOverrideMode: "paused" })}
              className={`focus-ring min-h-11 rounded-md border px-3 text-sm font-black ${
                operations?.settings.orderingOverride.mode === "paused" ? "border-china-red bg-china-red text-white" : "border-china-red/60 bg-white text-china-red"
              }`}
            >
              Pause orders
            </button>
            <button
              onClick={() => updateOperations({ orderingOverrideMode: "normal" })}
              className={`focus-ring min-h-11 rounded-md border px-3 text-sm font-black ${
                !operations || operations.settings.orderingOverride.mode === "normal" ? "border-china-gold bg-china-gold text-stone-950" : "border-china-gold/70 bg-white text-stone-800"
              }`}
            >
              Follow hours
            </button>
          </div>
        </div>
      )}

      {activeSection === "orders" && (
        <div className="grid gap-4">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, order number, or item" className="focus-ring h-12 w-full rounded-md border border-china-gold/70 bg-white pl-12 pr-4 text-base" />
          </label>
          <p className="text-xs font-bold text-stone-600">Tap a card to open the full order. Kitchen tickets print through the Android tablet bridge; new orders auto-print once while this page is open in the tablet app.</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-china-red/40 bg-red-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-black text-china-red">New orders</p>
                <span className="rounded-md bg-china-red px-2 py-0.5 text-xs font-black text-white">{newColumn.length}</span>
              </div>
              <div className="grid gap-3">
                {newColumn.map((order) => renderOrderCard(order))}
                {newColumn.length === 0 && <p className="rounded-md border border-dashed border-china-gold/60 bg-white/60 p-4 text-center text-sm font-bold text-stone-500">No new orders.</p>}
              </div>
            </div>
            <div className="rounded-lg border border-china-gold/50 bg-white/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-black text-amber-900">Accepted</p>
                <span className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-black text-white">{prepColumn.length}</span>
              </div>
              <div className="grid gap-3">
                {prepColumn.map((order) => renderOrderCard(order))}
                {prepColumn.length === 0 && <p className="rounded-md border border-dashed border-china-gold/60 bg-white/60 p-4 text-center text-sm font-bold text-stone-500">No orders in progress.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "sold-out" && (
      <div className="grid gap-4">
        <div id="admin-sold-out" className="scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
          <p className="font-black text-china-red">Sold Out Today</p>
          <div className="mt-3 grid gap-2">
            <select value={soldOutSelection} onChange={(event) => setSoldOutSelection(event.target.value)} className="focus-ring h-11 w-full min-w-0 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-bold">
              {menuItems.map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.number} {item.name}
                </option>
              ))}
            </select>
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => updateOperations({ soldOutAction: "add", soldOutItemId: soldOutSelection })} className="focus-ring min-h-11 rounded-md bg-china-red px-3 text-sm font-black text-white">
                Mark sold out
              </button>
              <button onClick={() => updateOperations({ soldOutAction: "clear" })} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
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
      )}

      {activeSection === "reports" && (
        <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-black text-china-red">Reports & Exports</p>
              <p className="text-sm font-bold text-stone-600">Daily summary, report history, printing, and CSV export tools in one place.</p>
            </div>
          </div>
          <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button onClick={createTestOrder} disabled={creatingTestOrder} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
              {creatingTestOrder ? "Creating test order..." : "Create test order"}
            </button>
            <button onClick={() => printDailyReport()} disabled={dailyReportBusy} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
              {dailyReportBusy ? "Printing..." : "Print Daily Report to Epson"}
            </button>
            <button onClick={exportTodayCsv} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
              Export today CSV
            </button>
            <Link href="/admin/reports" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
              View reports history
            </Link>
          </div>
          <p className="mt-3 text-xs font-bold text-stone-600">Daily reports print directly to the Epson kitchen printer. Test orders are clearly marked TEST and excluded from report totals.</p>
          {toolMessage && <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">{toolMessage}</p>}
          <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Orders today", dailySummary.totalOrders],
              ["New", dailySummary.newOrders],
              ["Active", dailySummary.activeOrders],
              ["Picked up", dailySummary.pickedUp],
              ["Sales", formatPrice(dailySummary.totalSales)],
              ["Cash", formatPrice(dailySummary.cashSales)],
              ["Stripe paid", formatPrice(dailySummary.stripeSales)],
              ["Tips", formatPrice(dailySummary.tips)],
              ["Avg order", formatPrice(dailySummary.averageOrder)]
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border border-china-gold/40 bg-white p-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-china-red">{label}</p>
                <p className="mt-1 text-xl font-black text-stone-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 grid min-w-0 gap-4 border-t border-china-gold/40 pt-4">
          <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
            <p className="font-black text-china-red">Today&apos;s top items</p>
            <div className="mt-3 grid gap-2 text-sm">
              {topItems.length ? (
                topItems.map((item) => (
                  <div key={item.name} className="flex justify-between gap-3 rounded-md border border-china-gold/40 bg-white px-3 py-2">
                    <span className="min-w-0 break-words font-bold">{item.name}</span>
                    <span className="shrink-0 font-black">{item.quantity} / {formatPrice(item.sales)}</span>
                  </div>
                ))
              ) : (
                <p className="font-bold text-stone-600">No item sales yet today.</p>
              )}
            </div>
          </div>
          {reportsPanelOpen && (
            <div className="grid gap-3 rounded-md border border-china-gold/50 bg-white p-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-black text-china-red">Daily Reports History</p>
                  <p className="text-xs font-bold text-stone-600">Generated from existing orders. Test orders are excluded from real totals.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
                  <label className="grid gap-1 text-xs font-black text-stone-700">
                    Report date
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(event) => setReportDate(event.target.value)}
                      className="focus-ring h-10 rounded-md border border-china-gold/70 px-2 font-bold"
                    />
                  </label>
                  <button
                    onClick={() => loadDailyReportHistory(reportDate || easternDateKey())}
                    disabled={dailyReportHistoryLoading}
                    className="focus-ring min-h-10 self-end rounded-md bg-china-red px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                  >
                    {dailyReportHistoryLoading ? "Loading..." : "View report"}
                  </button>
                </div>
              </div>
              {dailyReportHistoryError && <p className="rounded-md bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">{dailyReportHistoryError}</p>}
              {dailyReportDetail && (
                <div className="grid gap-3">
                  <div className="rounded-md border border-china-gold/40 bg-[#fff7e8] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-black">{dailyReportDetail.dateLabel}</p>
                        <p className="text-xs font-bold text-stone-600">
                          {dailyReportDetail.testOrdersExcluded} test order{dailyReportDetail.testOrdersExcluded === 1 ? "" : "s"} excluded. Legacy finished/cancelled statuses display as picked up in admin.
                        </p>
                      </div>
                      <button
                        onClick={() => reprintDailyReport(dailyReportDetail.date)}
                        disabled={dailyReportReprintDate === dailyReportDetail.date}
                        className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {dailyReportReprintDate === dailyReportDetail.date ? "Printing..." : "Print Daily Report to Epson"}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold sm:grid-cols-4">
                      {[
                        ["Real orders", dailyReportDetail.summary.totalOrders],
                        ["Subtotal", formatPrice(dailyReportDetail.summary.foodSales)],
                        ["Discounts", formatPrice(dailyReportDetail.summary.discounts)],
                        ["Tax", formatPrice(dailyReportDetail.summary.tax)],
                        ["Tips", formatPrice(dailyReportDetail.summary.tips)],
                        ["Cash", formatPrice(dailyReportDetail.summary.cashTotal)],
                        ["Stripe", formatPrice(dailyReportDetail.summary.stripeTotal)],
                        ["Final total", formatPrice(dailyReportDetail.summary.grandTotal)]
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-md border border-china-gold/40 bg-white p-2">
                          <p className="uppercase tracking-wide text-china-red">{label}</p>
                          <p className="mt-0.5 text-sm font-black text-stone-900">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-china-red">Recent reports</p>
                    <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
                      {recentReports.map((report) => (
                        <button
                          key={report.date}
                          onClick={() => loadDailyReportHistory(report.date)}
                          className={`focus-ring min-w-40 shrink-0 rounded-md border px-3 py-2 text-left text-xs font-bold ${
                            dailyReportDetail.date === report.date ? "border-china-red bg-red-50 text-china-red" : "border-china-gold/60 bg-white text-stone-800"
                          }`}
                        >
                          <span className="block font-black">{report.date}</span>
                          <span className="block">{report.summary.totalOrders} orders / {formatPrice(report.summary.grandTotal)}</span>
                          <span className="block text-[11px] text-stone-600">{report.testOrdersExcluded} test excluded</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-china-red">Report details</p>
                    {dailyReportDetail.orders.length === 0 ? (
                      <p className="rounded-md border border-china-gold/40 bg-white p-3 text-sm font-bold text-stone-600">No real orders for this date.</p>
                    ) : (
                      dailyReportDetail.orders.map((order) => (
                        <div key={order.orderNumber} className="rounded-md border border-china-gold/40 bg-white p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-black text-china-red">#{order.orderNumber} <span className="text-stone-900">{order.timeLabel}</span></p>
                              <p className="break-words font-bold">{order.customerName} / {order.customerPhone}</p>
                              <p className="text-xs font-bold text-stone-600">{paymentLabel(order.paymentMethod as PaymentMethod, order.paymentStatus ?? undefined)} / {statusLabel(order.status)}</p>
                            </div>
                            <p className="shrink-0 text-base font-black">{formatPrice(order.total)}</p>
                          </div>
                          {order.discount > 0 && <p className="mt-1 text-xs font-bold text-china-red">Discount: -{formatPrice(order.discount)}</p>}
                          {order.itemsSummary && <p className="mt-1 break-words text-xs font-bold text-stone-600">{order.itemsSummary}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {activeSection === "settings" && (
        <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
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
      )}

      {activeSection === "promotions" && (
        <div className="rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:p-4">
          <div>
            <p className="font-black text-china-red">Promotions</p>
            <p className="text-sm font-bold text-stone-600">Manage promo codes and customer special offers together.</p>
          </div>
          <div className="mt-4 grid gap-4">
            <PromoManager embedded />
            <SpecialOffersManager embedded />
          </div>
        </div>
      )}

      {activeSection === "past-orders" && (
        <div className="grid gap-4">
          <label className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search past orders by name, phone, number, or item" className="focus-ring h-12 w-full rounded-md border border-china-gold/70 bg-white pl-12 pr-4 text-base" />
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              { value: "past", label: "All past" },
              { value: "picked_up", label: "Picked Up" }
            ] as Array<{ value: AdminFilter; label: string }>).map((tab) => (
              <button key={tab.value} onClick={() => setFilter(tab.value)} className={`focus-ring min-h-10 rounded-md border px-3 text-sm font-black ${filter === tab.value ? "border-china-red bg-china-red text-white" : "border-china-gold/70 bg-white text-stone-800"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pastBoard.map((order) => renderOrderCard(order))}
            {pastBoard.length === 0 && <p className="rounded-md border border-china-gold/60 bg-[#fff7e8] p-8 text-center font-bold sm:col-span-2 lg:col-span-3">No past orders found.</p>}
          </div>
        </div>
      )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50" role="dialog" aria-modal="true">
          <button aria-label="Close order details" onClick={() => setSelectedOrderNumber(null)} className="absolute inset-0" />
          <div className="relative z-10 flex h-full w-full max-w-lg max-w-[100vw] flex-col overflow-y-auto bg-white shadow-warm">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-china-red">Order</p>
                <h2 className="truncate text-xl font-black">{selectedOrder.order_number}</h2>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-black uppercase ${statusStyles[selectedOrder.status]}`}>{statusLabel(selectedOrder.status)}</span>
              <button onClick={() => setSelectedOrderNumber(null)} aria-label="Close order details" className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300 text-stone-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-4 p-4">
              <div className="grid gap-2">
                <h3 className="text-lg font-black">{selectedOrder.customer_name}</h3>
                <p className="break-all text-sm font-bold text-stone-700">
                  <a href={`tel:${selectedOrder.customer_phone.replace(/\D/g, "")}`} className="underline-offset-2 hover:underline">{selectedOrder.customer_phone}</a>
                  {selectedOrder.customer_email ? ` · ${selectedOrder.customer_email}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${selectedOrder.customer_phone.replace(/\D/g, "")}`} className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-black text-stone-800"><Phone className="h-4 w-4" /> Call</a>
                  <button onClick={() => copyPhone(selectedOrder.customer_phone)} className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-black text-stone-800"><Copy className="h-4 w-4" /> Copy phone</button>
                </div>
              </div>

              {isScheduledPickup(selectedOrder) ? (
                <p className="rounded-md bg-china-gold px-3 py-2 text-sm font-black uppercase text-china-ink">Scheduled pickup · {formatPickupDateTime(selectedOrder.scheduled_pickup_time)}</p>
              ) : (
                <p className="rounded-md border border-china-gold/60 bg-[#fff7e8] px-3 py-2 text-sm font-black text-stone-800">Pickup: ASAP</p>
              )}
              {!isScheduledPickup(selectedOrder) && selectedOrder.status === "accepted" && <p className="text-sm font-bold text-stone-700">Ready: {readyLabel(selectedOrder)}</p>}
              <p className="text-sm text-stone-600">{paymentLabel(selectedOrder.payment_method, selectedOrder.payment_status)}</p>
              {selectedOrder.customer_notes && (
                <p className={`rounded-md px-3 py-2 text-sm font-bold ${hasInstructionAlert(selectedOrder.customer_notes) ? "bg-yellow-100 text-yellow-950" : "bg-china-paper text-stone-700"}`}>Notes: {selectedOrder.customer_notes}</p>
              )}

              <div className="grid gap-2">
                <p className="font-black text-china-red">Items</p>
                {selectedOrder.order_items.map((item, index) => (
                  <div key={`${selectedOrder.order_number}-${item.item_number}-${index}`} className={`flex justify-between gap-2 rounded-md p-2 text-sm ${hasInstructionAlert(`${customizationText(item.customization)} ${String(item.customization?.notes ?? "")}`) ? "bg-yellow-100 text-yellow-950" : "bg-china-paper"}`}>
                    <span className="min-w-0">
                      <strong>{item.quantity} x #{item.item_number} {item.item_name}</strong>
                      {customizationText(item.customization) && <span className="block text-stone-600">{customizationText(item.customization)}</span>}
                      {item.customization?.notes ? <span className="block font-bold text-stone-700">Notes: {String(item.customization.notes)}</span> : null}
                    </span>
                    <span className="shrink-0 font-bold">{formatPrice(item.unit_price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="grid gap-1 rounded-md border border-stone-200 p-3 text-sm font-bold">
                <p className="flex justify-between"><span>Subtotal</span><span>{formatPrice(selectedOrder.subtotal)}</span></p>
                {Number(selectedOrder.discount_amount ?? 0) > 0 && (
                  <p className="flex justify-between text-china-red"><span>{selectedOrder.promo_code ? `Promo ${selectedOrder.promo_code}` : "Special offer"}</span><span>-{formatPrice(Number(selectedOrder.discount_amount))}</span></p>
                )}
                <p className="flex justify-between"><span>Tax</span><span>{formatPrice(selectedOrder.tax)}</span></p>
                <p className="flex justify-between"><span>Processing fee</span><span>{formatPrice(Number(selectedOrder.processing_fee ?? 0))}</span></p>
                <p className="flex justify-between"><span>Tip</span><span>{formatPrice(Number(selectedOrder.tip_amount ?? 0))}</span></p>
                <p className="mt-1 flex justify-between border-t border-stone-200 pt-1 text-base font-black"><span>Total</span><span>{formatPrice(selectedOrder.total)}</span></p>
              </div>

              <div className="grid gap-1 text-[11px] font-black">
                {selectedOrder.confirmation_email_sent_at && <span className="w-fit rounded-md bg-green-100 px-2 py-1 text-green-800">Confirmation email sent</span>}
                {selectedOrder.accepted_email_sent_at && <span className="w-fit rounded-md bg-green-100 px-2 py-1 text-green-800">Accepted email sent</span>}
              </div>

              <div className="grid gap-2">
                {primaryActionFor(selectedOrder) && (
                  <button onClick={() => primaryActionFor(selectedOrder)?.run()} disabled={updatingOrders.has(selectedOrder.order_number)} className={`focus-ring min-h-12 rounded-md px-4 font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${primaryActionFor(selectedOrder)?.className}`}>
                    {updatingOrders.has(selectedOrder.order_number) ? "Saving..." : primaryActionFor(selectedOrder)?.label}
                  </button>
                )}
                <div className="grid gap-2">
                  <button onClick={() => printKitchenTicket(selectedOrder)} disabled={networkPrintingOrders.has(selectedOrder.order_number)} className="focus-ring min-h-11 rounded-md border border-china-red bg-china-red px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
                    {networkPrintingOrders.has(selectedOrder.order_number) ? "Printing..." : kitchenPrintStatus[selectedOrder.order_number]?.status === "printed" ? "Reprint kitchen ticket" : "Kitchen print"}
                  </button>
                </div>
                {kitchenPrintStatus[selectedOrder.order_number]?.status === "failed" && (
                  <p className="whitespace-pre-wrap break-words rounded-md bg-amber-100 px-3 py-2 text-xs font-black uppercase text-amber-950">Print failed: {kitchenPrintStatus[selectedOrder.order_number]?.message ?? "Printer offline."}</p>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {activeStatuses.includes(selectedOrder.status) && (
                    <button onClick={() => { const order = selectedOrder; setSelectedOrderNumber(null); openEditOrder(order); }} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
                      <Edit3 className="h-4 w-4" /> Edit order
                    </button>
                  )}
                  <label className="grid gap-1 text-xs font-black text-stone-700">
                    Change status
                    <select
                      value={selectedOrder.status}
                      onChange={(event) => {
                        const nextStatus = event.target.value as OrderStatus;
                        if (nextStatus === "accepted" && !isScheduledPickup(selectedOrder)) { setAcceptingOrder(selectedOrder.order_number); return; }
                        updateStatus(selectedOrder.order_number, nextStatus);
                        if (nextStatus === "picked_up") setSelectedOrderNumber(null);
                      }}
                      disabled={updatingOrders.has(selectedOrder.order_number)}
                      className="focus-ring h-11 rounded-md border border-china-gold/70 bg-white px-2 text-sm font-bold disabled:opacity-60"
                    >
                      {statuses.map((value) => (<option key={value} value={value}>{statusLabel(value)}</option>))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
          <div className="max-h-[92vh] w-full max-w-3xl max-w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto rounded-lg bg-white p-4 shadow-warm sm:p-5">
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
