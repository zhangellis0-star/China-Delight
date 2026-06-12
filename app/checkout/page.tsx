"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, WalletCards } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { customizationText } from "@/lib/order-display";
import {
  ASAP_PICKUP_NOTE,
  buildScheduledPickupISO,
  closedOrderingMessage,
  formatPickupDateTime,
  getPickupDateOptions,
  getPickupTimeSlots,
  isLunchItem,
  isRestaurantOpen,
  nextOpeningLabel,
  validateScheduledPickup
} from "@/lib/order-rules";
import { calculateCart, formatPrice } from "@/lib/pricing";
import { computePromoDiscount, normalizePromoCode } from "@/lib/promo";
import { computeOffer, offerSummary } from "@/lib/offer-logic";
import type { PublicSpecialOffer } from "@/lib/offer-logic";
import type { AppliedPromo, CheckoutCustomer } from "@/types";

type CheckoutFormCustomer = CheckoutCustomer;
type TipChoice = "none" | "18" | "20" | "22" | "custom";
type CheckoutFieldErrors = Partial<Record<"name" | "phone" | "email", string>>;
type PublicSettings = {
  orderingAllowed: boolean;
  busyMode: "normal" | "busy" | "very_busy";
  soldOutItemIds: string[];
  specialOffers?: PublicSpecialOffer[];
  orderingOverride?: { mode: "normal" | "open" | "paused"; expiresAt: string | null };
  nextBoundary?: { label: string; iso: string };
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateCustomerFields(customer: CheckoutFormCustomer) {
  const errors: CheckoutFieldErrors = {};
  if (!customer.name.trim()) errors.name = "Required";
  if (!customer.phone.trim()) errors.phone = "Required";
  if (!customer.email.trim()) errors.email = "Required";
  else if (!isValidEmail(customer.email)) errors.email = "Enter a valid email";
  return errors;
}

// Resolve the display name for a free reward line that an applied offer grants.
function offerItemName(offer: PublicSpecialOffer, itemId: string) {
  if (offer.rewardItemId === itemId) return offer.rewardItemName ?? "Free item";
  if (offer.secondItemId === itemId) return offer.secondItemName ?? "Item";
  if (offer.requiredItemId === itemId) return offer.requiredItemName ?? "Item";
  return "Item";
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const paymentRef = useRef<HTMLDivElement>(null);
  const closedMessageRef = useRef<HTMLParagraphElement>(null);
  const reviewRef = useRef<HTMLLabelElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const [tipChoice, setTipChoice] = useState<TipChoice>("none");
  const [customTip, setCustomTip] = useState("");
  const baseSubtotal = calculateCart(items).subtotal;
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  // Special offers: customers may select at most one (one promo + one offer max, matching the server).
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  // Recompute the discount against the live subtotal so it always matches what the server will charge.
  const promoDiscount = appliedPromo ? computePromoDiscount(baseSubtotal, appliedPromo.discountType, appliedPromo.discountValue) : 0;
  const specialOffers = settings?.specialOffers ?? [];
  const selectedOffer = specialOffers.find((offer) => offer.id === selectedOfferId) ?? null;
  // Same pure computation the server runs, so the previewed total matches the charged total.
  const offerResult = selectedOffer ? computeOffer(selectedOffer, items, baseSubtotal) : null;
  const selectedOfferApplied = offerResult?.applied ?? false;
  const offerDiscount = selectedOfferApplied ? offerResult?.discount ?? 0 : 0;
  const discountAmount = promoDiscount + offerDiscount;
  const parsedCustomTip = Number(customTip || 0);
  const tipAmount =
    tipChoice === "custom"
      ? Math.max(0, Number.isFinite(parsedCustomTip) ? parsedCustomTip : 0)
      : tipChoice === "none"
        ? 0
        : baseSubtotal * (Number(tipChoice) / 100);
  const totals = calculateCart(items, tipAmount, discountAmount);
  const orderingOpen = settings?.orderingAllowed ?? isRestaurantOpen();
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const [fieldErrorMessage, setFieldErrorMessage] = useState<string | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CheckoutFormCustomer>({
    name: "",
    phone: "",
    email: "",
    fulfillment: "pickup",
    notes: "",
    paymentMethod: "pay_at_pickup",
    pickupTimeType: "asap",
    scheduledPickupTime: ""
  });

  const paymentLabel = "Pay in store / Pay at pickup";
  const hasLunchItem = items.some((item) => isLunchItem(item));
  const allowAfterOnlineCutoff = settings?.orderingOverride?.mode === "open";
  const dateOptions = useMemo(() => getPickupDateOptions(new Date(), { hasLunchItem }), [hasLunchItem]);
  const timeSlots = useMemo(() => (pickupDate ? getPickupTimeSlots(pickupDate, { hasLunchItem, now: new Date(), allowAfterOnlineCutoff }) : []), [pickupDate, allowAfterOnlineCutoff, hasLunchItem]);
  const pickupTimeLabel =
    customer.pickupTimeType === "scheduled"
      ? customer.scheduledPickupTime
        ? formatPickupDateTime(customer.scheduledPickupTime)
        : "Not selected"
      : ASAP_PICKUP_NOTE;

  useEffect(() => {
    function loadSettings() {
      fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: PublicSettings) => setSettings(data))
      .catch(() => undefined);
    }

    loadSettings();
    window.addEventListener("focus", loadSettings);
    document.addEventListener("visibilitychange", loadSettings);
    return () => {
      window.removeEventListener("focus", loadSettings);
      document.removeEventListener("visibilitychange", loadSettings);
    };
  }, []);

  // Drop a chosen offer only if the admin removed/disabled it. Whether it currently applies is
  // decided live by computeOffer, so a customer can keep it selected while they add the items.
  useEffect(() => {
    if (!selectedOfferId) return;
    if (!specialOffers.some((candidate) => candidate.id === selectedOfferId)) setSelectedOfferId(null);
  }, [selectedOfferId, specialOffers]);

  function applySchedule(dateStr: string, timeStr: string) {
    setPickupDate(dateStr);
    setPickupTime(timeStr);
    setScheduleError(null);
    const iso = dateStr && timeStr ? buildScheduledPickupISO(dateStr, timeStr) : "";
    setCustomer((previous) => ({ ...previous, scheduledPickupTime: iso }));
  }

  async function applyPromo() {
    const code = normalizePromoCode(promoInput);
    if (!code) {
      setPromoError("Enter a promo code.");
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const response = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: baseSubtotal })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "That promo code could not be applied.");
      setAppliedPromo(data.promo as AppliedPromo);
      setPromoInput("");
    } catch (error) {
      setAppliedPromo(null);
      setPromoError(error instanceof Error ? error.message : "That promo code could not be applied.");
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setAppliedPromo(null);
    setPromoError(null);
    setPromoInput("");
  }

  function scrollToError(target: HTMLElement | null, focusTarget?: HTMLElement | null) {
    if (!target) return;
    const offset = 96;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    if (focusTarget) {
      window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 250);
    }
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    const nextFieldErrors = validateCustomerFields(customer);
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setFieldErrorMessage("Please complete the required customer information before placing your order.");
      setPaymentError(null);
      const firstInvalidField = nextFieldErrors.name ? nameRef.current : nextFieldErrors.phone ? phoneRef.current : emailRef.current;
      scrollToError(firstInvalidField, firstInvalidField);
      return;
    }
    if (!orderingOpen) {
      setPaymentError(settings?.orderingOverride?.mode === "paused" ? `Online ordering is paused until ${settings.nextBoundary?.label ?? "the next store-hours boundary"}.` : `${closedOrderingMessage} ${nextOpeningLabel()}`);
      scrollToError(closedMessageRef.current);
      return;
    }
    if (customer.pickupTimeType === "scheduled") {
      const scheduleValidationError = validateScheduledPickup(pickupDate, pickupTime, { hasLunchItem, now: new Date(), allowAfterOnlineCutoff });
      if (scheduleValidationError) {
        setScheduleError(scheduleValidationError);
        scrollToError(scheduleRef.current);
        return;
      }
    }
    setScheduleError(null);
    if (!reviewConfirmed) {
      setReviewError("Please review your order and check the confirmation box before placing your order.");
      scrollToError(reviewRef.current, reviewRef.current);
      return;
    }
    setFieldErrors({});
    setFieldErrorMessage(null);
    setPaymentError(null);
    setReviewError(null);
    setLoading(true);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items, totals, promoCode: appliedPromo?.code ?? null, specialOfferId: selectedOfferApplied ? selectedOfferId : null })
    });
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      if (data.promoInvalid) {
        clearPromo();
        setPromoError(data.error ?? "That promo code is no longer valid. Please review your total.");
        scrollToError(paymentRef.current);
        return;
      }
      alert(data.error ?? "Could not place the order. Please call the restaurant.");
      return;
    }
    const storedTotals = { ...totals, promoCode: appliedPromo?.code ?? null };
    window.localStorage.setItem(
      "china-delight-last-order",
      JSON.stringify({ orderNumber: data.orderNumber, customer: { ...customer, paymentMethod: "pay_at_pickup" }, items, totals: storedTotals, status: "new", placedAt: new Date().toISOString() })
    );
    clearCart();
    router.push(`/confirmation?order=${data.orderNumber}`);
  }

  return (
    <section className={`mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 ${items.length > 0 ? "pb-32 lg:pb-10" : ""}`}>
      <h1 className="text-3xl font-black sm:text-4xl">Checkout</h1>
      <form id="checkout-form" noValidate onSubmit={submitOrder} className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          {fieldErrorMessage && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red">{fieldErrorMessage}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              <span className="flex items-center gap-2">
                Name {fieldErrors.name && <span className="text-sm font-black text-china-red">{fieldErrors.name}</span>}
              </span>
              <input
                ref={nameRef}
                required
                aria-invalid={Boolean(fieldErrors.name)}
                value={customer.name}
                onChange={(event) => {
                  const nextCustomer = { ...customer, name: event.target.value };
                  setCustomer(nextCustomer);
                  if (Object.keys(fieldErrors).length > 0) {
                    const nextErrors = validateCustomerFields(nextCustomer);
                    setFieldErrors(nextErrors);
                    if (Object.keys(nextErrors).length === 0) setFieldErrorMessage(null);
                  }
                }}
                className={`focus-ring h-12 rounded-md border px-3 ${fieldErrors.name ? "border-china-red bg-red-50" : "border-stone-300"}`}
              />
            </label>
            <label className="grid gap-1 font-bold">
              <span className="flex items-center gap-2">
                Phone {fieldErrors.phone && <span className="text-sm font-black text-china-red">{fieldErrors.phone}</span>}
              </span>
              <input
                ref={phoneRef}
                required
                aria-invalid={Boolean(fieldErrors.phone)}
                value={customer.phone}
                onChange={(event) => {
                  const nextCustomer = { ...customer, phone: event.target.value };
                  setCustomer(nextCustomer);
                  if (Object.keys(fieldErrors).length > 0) {
                    const nextErrors = validateCustomerFields(nextCustomer);
                    setFieldErrors(nextErrors);
                    if (Object.keys(nextErrors).length === 0) setFieldErrorMessage(null);
                  }
                }}
                className={`focus-ring h-12 rounded-md border px-3 ${fieldErrors.phone ? "border-china-red bg-red-50" : "border-stone-300"}`}
              />
            </label>
            <label className="grid gap-1 font-bold sm:col-span-2">
              <span className="flex items-center gap-2">
                Email {fieldErrors.email && <span className="text-sm font-black text-china-red">{fieldErrors.email}</span>}
              </span>
              <input
                ref={emailRef}
                required
                type="email"
                aria-invalid={Boolean(fieldErrors.email)}
                value={customer.email}
                onChange={(event) => {
                  const nextCustomer = { ...customer, email: event.target.value };
                  setCustomer(nextCustomer);
                  if (Object.keys(fieldErrors).length > 0) {
                    const nextErrors = validateCustomerFields(nextCustomer);
                    setFieldErrors(nextErrors);
                    if (Object.keys(nextErrors).length === 0) setFieldErrorMessage(null);
                  }
                }}
                className={`focus-ring h-12 rounded-md border px-3 ${fieldErrors.email ? "border-china-red bg-red-50" : "border-stone-300"}`}
              />
              <span className="text-sm font-semibold text-stone-600">Required for order confirmation and ready-for-pickup updates.</span>
            </label>
          </div>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <p className="font-black">Pickup only</p>
            <p className="mt-2 leading-7 text-stone-700">Online orders through this website are pickup only.</p>
            {settings?.busyMode && settings.busyMode !== "normal" && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">We are currently busy. Pickup times may take longer.</p>
            )}
          </div>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <Clock className="h-5 w-5 text-china-red" />
              Pickup time
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(["asap", "scheduled"] as const).map((value) => (
                <label key={value} className={`rounded-md border p-3 font-black ${customer.pickupTimeType === value ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                  <input
                    className="mr-2"
                    type="radio"
                    checked={customer.pickupTimeType === value}
                    onChange={() => {
                      if (value === "asap") {
                        setCustomer({ ...customer, pickupTimeType: "asap", scheduledPickupTime: "" });
                        setScheduleError(null);
                      } else {
                        setCustomer({ ...customer, pickupTimeType: "scheduled" });
                      }
                    }}
                  />
                  {value === "asap" ? "ASAP" : "Scheduled pickup time"}
                </label>
              ))}
            </div>
            {customer.pickupTimeType === "scheduled" && (
              <div ref={scheduleRef} className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold text-stone-700">
                  <span>Pickup date {scheduleError && !pickupDate && <span className="font-black text-china-red">Required</span>}</span>
                  <select
                    value={pickupDate}
                    onChange={(event) => {
                      const nextDate = event.target.value;
                      const nextSlots = nextDate ? getPickupTimeSlots(nextDate, { hasLunchItem, now: new Date(), allowAfterOnlineCutoff }) : [];
                      const keepTime = nextSlots.some((slot) => slot.value === pickupTime) ? pickupTime : "";
                      applySchedule(nextDate, keepTime);
                    }}
                    className={`focus-ring h-12 rounded-md border bg-white px-3 ${scheduleError && !pickupDate ? "border-china-red bg-red-50" : "border-stone-300"}`}
                  >
                    <option value="">Select a date</option>
                    {dateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-stone-700">
                  <span>Pickup time {scheduleError && pickupDate && !pickupTime && <span className="font-black text-china-red">Required</span>}</span>
                  <select
                    value={pickupTime}
                    disabled={!pickupDate}
                    onChange={(event) => applySchedule(pickupDate, event.target.value)}
                    className={`focus-ring h-12 rounded-md border bg-white px-3 disabled:cursor-not-allowed disabled:bg-stone-100 ${scheduleError && pickupDate && !pickupTime ? "border-china-red bg-red-50" : "border-stone-300"}`}
                  >
                    <option value="">{!pickupDate ? "Select a date first" : timeSlots.length === 0 ? "No pickup times available for this date." : "Select a time"}</option>
                    {timeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
                {pickupDate && timeSlots.length === 0 && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 sm:col-span-2">No pickup times available for this date.</p>
                )}
                {hasLunchItem && (
                  <p className="text-xs font-semibold text-stone-600 sm:col-span-2">Lunch specials are available Monday–Saturday, 11:00 AM–3:00 PM.</p>
                )}
                {scheduleError && (
                  <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red sm:col-span-2">
                    {scheduleError}
                  </p>
                )}
              </div>
            )}
            <p className="mt-3 text-sm font-bold text-stone-700">{ASAP_PICKUP_NOTE}</p>
          </div>

          <div ref={paymentRef} className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <WalletCards className="h-5 w-5 text-china-red" />
              Payment
            </div>
            <div className="mt-3 rounded-md border border-china-red bg-red-50 p-3 font-black text-china-red">
              Pay in store / Pay at pickup
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-700">Payment is collected in store at pickup.</p>
            {paymentError && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red">{paymentError}</p>}
          </div>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <p className="font-black">Promo code</p>
            <p className="mt-1 text-sm leading-6 text-stone-700">Have a promo or store-credit code? Apply it before placing your order.</p>
            {appliedPromo ? (
              <div className="mt-3 flex flex-col gap-2 rounded-md border border-green-300 bg-green-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-green-800">{appliedPromo.code} applied</p>
                  {appliedPromo.description && <p className="text-sm font-bold text-green-800">{appliedPromo.description}</p>}
                  <p className="text-sm font-bold text-green-800">You save {formatPrice(discountAmount)}</p>
                </div>
                <button type="button" onClick={clearPromo} className="focus-ring min-h-11 rounded-md border border-green-700 bg-white px-4 font-black text-green-800">
                  Remove code
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={promoInput}
                  onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyPromo();
                    }
                  }}
                  placeholder="Enter code"
                  aria-label="Promo code"
                  className="focus-ring h-12 flex-1 rounded-md border border-stone-300 px-3 font-bold uppercase"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="focus-ring min-h-12 rounded-md bg-china-red px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
                >
                  {promoLoading ? "Applying..." : "Apply"}
                </button>
              </div>
            )}
            {promoError && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red">{promoError}</p>}
          </div>

          {specialOffers.length > 0 && (
            <div className="rounded-md border border-stone-200 bg-china-paper p-4">
              <p className="font-black">Special offers</p>
              <p className="mt-1 text-sm leading-6 text-stone-700">Pick one special offer for your order. Only one offer can be used per order.</p>
              <div className="mt-3 grid gap-2">
                {specialOffers.map((offer) => {
                  const selected = selectedOfferId === offer.id;
                  const result = computeOffer(offer, items, baseSubtotal);
                  const rewardNames = result.freeItems.map((free) => `${free.quantity > 1 ? `${free.quantity} x ` : ""}${offerItemName(offer, free.itemId)}`);
                  return (
                    <button
                      key={offer.id}
                      type="button"
                      onClick={() => setSelectedOfferId(selected ? null : offer.id)}
                      className={`focus-ring rounded-md border p-3 text-left ${selected ? "border-china-red bg-red-50" : "border-stone-300 bg-white"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black">{offer.title}</span>
                        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-black ${selected ? "bg-china-red text-white" : "text-china-red"}`}>
                          {selected ? "Selected" : "Tap to choose"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-stone-600">{offerSummary(offer)}</p>
                      {result.applied ? (
                        <p className="mt-1 text-sm font-black text-green-700">
                          {result.discount > 0 ? `Discount: -${formatPrice(result.discount)}` : `Free: ${rewardNames.join(", ")}`}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm font-bold text-stone-500">{result.reason}</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedOffer && !selectedOfferApplied && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">{offerResult?.reason}</p>
              )}
            </div>
          )}

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <p className="font-black">Optional tip</p>
            <p className="mt-1 text-sm leading-6 text-stone-700">No tip is selected by default. Thank you for supporting the staff.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {([
                ["none", "No tip"],
                ["18", "18%"],
                ["20", "20%"],
                ["22", "22%"],
                ["custom", "Custom"]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTipChoice(value)}
                  className={`focus-ring min-h-11 rounded-md border px-3 py-2 font-black ${
                    tipChoice === value ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white text-stone-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tipChoice === "custom" && (
              <label className="mt-3 grid gap-1 text-sm font-bold text-stone-700">
                Custom tip amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={customTip}
                  onChange={(event) => setCustomTip(event.target.value)}
                  className="focus-ring h-12 rounded-md border border-stone-300 bg-white px-3"
                  placeholder="0.00"
                />
              </label>
            )}
          </div>

          <label className="grid gap-1 font-bold">
            Order notes
            <textarea value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} className="focus-ring min-h-24 rounded-md border border-stone-300 p-3" placeholder="Pickup notes, allergy notes, special instructions..." />
          </label>
        </div>

        <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-warm">
          <h2 className="text-2xl font-black">Review your order</h2>
          {!orderingOpen && (
            <p ref={closedMessageRef} role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
              {settings?.orderingOverride?.mode === "paused" ? `Online ordering is paused until ${settings.nextBoundary?.label ?? "the next store-hours boundary"}.` : `${closedOrderingMessage} ${nextOpeningLabel()}`}
            </p>
          )}

          <dl className="mt-4 grid gap-1.5 border-b border-stone-200 pb-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Name</dt>
              <dd className="text-right font-bold">{customer.name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Phone</dt>
              <dd className="text-right font-bold">{customer.phone || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Email</dt>
              <dd className="break-all text-right font-bold">{customer.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Fulfillment</dt>
              <dd className="text-right font-bold">Pickup only</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Pickup time</dt>
              <dd className="text-right font-bold">{pickupTimeLabel}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stone-600">Payment</dt>
              <dd className="text-right font-bold">{paymentLabel}</dd>
            </div>
            {customer.notes?.trim() && (
              <div className="flex justify-between gap-3">
                <dt className="text-stone-600">Special instructions</dt>
                <dd className="text-right font-bold">{customer.notes}</dd>
              </div>
            )}
          </dl>

          <div className="mt-4 grid gap-3">
            {items.map((item) => (
              <div key={item.cartId} className="flex justify-between gap-3 text-sm">
                <span>
                  {item.quantity} x {item.name}
                  {customizationText(item.customization) && <span className="block text-xs text-stone-600">{customizationText(item.customization)}</span>}
                </span>
                <span className="font-bold">{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
            {selectedOffer && selectedOfferApplied && offerResult?.freeItems.map((free) => (
              <div key={free.itemId} className="flex justify-between gap-3 text-sm">
                <span>
                  {free.quantity > 1 ? `${free.quantity} x ` : ""}{offerItemName(selectedOffer, free.itemId)}
                  <span className="block text-xs font-bold text-green-700">Special offer</span>
                </span>
                <span className="font-bold text-green-700">FREE</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-2 border-t border-stone-200 pt-4">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-china-red">
                <span>
                  {appliedPromo && offerDiscount > 0
                    ? `Promo (${appliedPromo.code}) + special offer discount`
                    : appliedPromo
                      ? `Promo discount (${appliedPromo.code})`
                      : "Special offer discount"}
                </span>
                <span>-{formatPrice(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{formatPrice(totals.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Processing fee</span>
              <span>{formatPrice(totals.processingFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tip</span>
              <span>{formatPrice(totals.tip)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black">
              <span>Total</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
          </div>

          <label
            ref={reviewRef}
            className={`mt-5 flex items-start gap-3 rounded-md border p-3 text-sm font-bold ${reviewError ? "border-china-red bg-red-50" : "border-stone-300 bg-china-paper"}`}
          >
            <input
              type="checkbox"
              checked={reviewConfirmed}
              aria-invalid={Boolean(reviewError)}
              onChange={(event) => {
                setReviewConfirmed(event.target.checked);
                if (event.target.checked) setReviewError(null);
              }}
              className="focus-ring mt-0.5 h-5 w-5 shrink-0"
            />
            <span className="text-stone-800">I have reviewed my order and contact information.</span>
          </label>
          {reviewError && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red">{reviewError}</p>}

          <button disabled={loading || items.length === 0 || !orderingOpen} className="focus-ring mt-6 min-h-12 w-full rounded-md bg-china-red px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
            {loading ? "Placing order..." : "Place order"}
          </button>
        </aside>
      </form>
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-china-gold/50 bg-[#fff7e8]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-12px_34px_rgba(44,24,16,0.24)] backdrop-blur lg:hidden">
          <button
            type="submit"
            form="checkout-form"
            disabled={loading || !orderingOpen}
            className="focus-ring mx-auto flex min-h-16 w-full max-w-lg items-center justify-center rounded-lg bg-china-red px-4 py-3 text-center text-lg font-black text-white shadow-warm disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {loading ? "Placing order..." : `Place Order - ${formatPrice(totals.total)}`}
          </button>
        </div>
      )}
    </section>
  );
}
