"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CreditCard, ShieldCheck } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { DeliveryPlatforms } from "@/components/delivery-platforms";
import { customizationText } from "@/lib/order-display";
import { closedOrderingMessage, estimatedPickupWindow, isRestaurantOpen, nextOpeningLabel } from "@/lib/order-rules";
import { calculateCart, formatPrice } from "@/lib/pricing";
import type { CheckoutCustomer, PaymentMethod } from "@/types";

type CheckoutFormCustomer = Omit<CheckoutCustomer, "paymentMethod"> & { paymentMethod: PaymentMethod | "" };
type VerifyMessage = { type: "info" | "error" | "success"; text: string };

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const totals = calculateCart(items);
  const orderingOpen = isRestaurantOpen();
  const estimate = estimatedPickupWindow(items);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<VerifyMessage | null>(null);
  const [customer, setCustomer] = useState<CheckoutFormCustomer>({
    name: "",
    phone: "",
    email: "",
    fulfillment: "pickup",
    notes: "",
    paymentMethod: "",
    pickupTimeType: "asap",
    scheduledPickupTime: ""
  });

  async function handleSendCode() {
    if (!customer.phone.trim()) {
      setVerifyMessage({ type: "error", text: "Enter your phone number first." });
      return;
    }
    setVerifyBusy(true);
    try {
      const response = await fetch("/api/phone-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", phone: customer.phone })
      });
      const data = await response.json();
      if (!response.ok) {
        setVerifyMessage({ type: "error", text: data.error ?? "Could not send the code. Please try again." });
        return;
      }
      setCodeSent(true);
      const devNote = data.devMode && data.devCode ? ` Dev code: ${data.devCode}` : "";
      setVerifyMessage({ type: "info", text: `${data.message ?? "Code sent."}${devNote}` });
    } catch {
      setVerifyMessage({ type: "error", text: "Could not send the code. Please try again." });
    } finally {
      setVerifyBusy(false);
    }
  }

  async function handleVerifyCode() {
    setVerifyBusy(true);
    try {
      const response = await fetch("/api/phone-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", phone: customer.phone, code })
      });
      const data = await response.json();
      if (data.verified) {
        setPhoneVerified(true);
        setVerifyMessage({ type: "success", text: data.message ?? "Phone verified." });
      } else {
        setPhoneVerified(false);
        setVerifyMessage({ type: "error", text: data.message ?? data.error ?? "Invalid code." });
      }
    } catch {
      setVerifyMessage({ type: "error", text: "Could not verify the code. Please try again." });
    } finally {
      setVerifyBusy(false);
    }
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) return;
    if (!orderingOpen) {
      setPaymentError(`${closedOrderingMessage} ${nextOpeningLabel()}`);
      return;
    }
    if (!phoneVerified) {
      setVerifyMessage({ type: "error", text: "Please verify your phone number before placing the order." });
      return;
    }
    if (!customer.paymentMethod) {
      setPaymentError("Please choose a payment method to continue.");
      return;
    }
    setPaymentError(null);
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
      <h1 className="text-3xl font-black sm:text-4xl">Checkout</h1>
      <form onSubmit={submitOrder} className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-5 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 font-bold">
              Name
              <input required value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
            <label className="grid gap-1 font-bold">
              Phone
              <input required value={customer.phone} onChange={(event) => { setCustomer({ ...customer, phone: event.target.value }); setPhoneVerified(false); setCodeSent(false); setVerifyMessage(null); }} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
            <label className="grid gap-1 font-bold sm:col-span-2">
              Email optional
              <input type="email" value={customer.email ?? ""} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} className="focus-ring h-12 rounded-md border border-stone-300 px-3" />
            </label>
          </div>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <ShieldCheck className="h-5 w-5 text-china-red" />
              Verify phone number
            </div>
            {phoneVerified ? (
              <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm font-bold text-green-700">Phone verified ✓</p>
            ) : (
              <div className="mt-3 grid gap-3">
                <p className="text-sm leading-6 text-stone-700">We verify your phone so we can reach you about your order. Enter your number above, then request a code.</p>
                <button type="button" onClick={handleSendCode} disabled={verifyBusy} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-china-red px-4 py-2 font-bold text-china-red disabled:opacity-60">
                  {codeSent ? "Resend verification code" : "Send verification code"}
                </button>
                {codeSent && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="6-digit code" className="focus-ring h-12 rounded-md border border-stone-300 bg-white px-3 tracking-[0.3em]" />
                    <button type="button" onClick={handleVerifyCode} disabled={verifyBusy || code.length < 6} className="focus-ring min-h-12 rounded-md bg-china-red px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
                      Verify
                    </button>
                  </div>
                )}
              </div>
            )}
            {verifyMessage && (
              <p
                role={verifyMessage.type === "error" ? "alert" : undefined}
                className={`mt-2 rounded-md px-3 py-2 text-sm font-bold ${
                  verifyMessage.type === "error" ? "bg-red-50 text-china-red" : verifyMessage.type === "success" ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-700"
                }`}
              >
                {verifyMessage.text}
              </p>
            )}
          </div>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <p className="font-black">Pickup only</p>
            <p className="mt-2 leading-7 text-stone-700">Online orders through this website are pickup only. For delivery, please order through DoorDash, Uber Eats, or Grubhub.</p>
            <div className="mt-4">
              <DeliveryPlatforms compact />
            </div>
          </div>

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
            <p className="mt-3 text-sm font-bold text-stone-700">Estimated ASAP pickup: {estimate}</p>
          </div>

          <label className="grid gap-1 font-bold">
            Order notes
            <textarea value={customer.notes} onChange={(event) => setCustomer({ ...customer, notes: event.target.value })} className="focus-ring min-h-24 rounded-md border border-stone-300 p-3" placeholder="Pickup notes, allergy notes, special instructions..." />
          </label>

          <div className="rounded-md border border-stone-200 bg-china-paper p-4">
            <div className="flex items-center gap-2 font-black">
              <CreditCard className="h-5 w-5 text-china-red" />
              Payment
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className={`rounded-md border p-3 font-black ${customer.paymentMethod === "pay_at_pickup" ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                <input className="mr-2" type="radio" name="paymentMethod" checked={customer.paymentMethod === "pay_at_pickup"} onChange={() => { setCustomer({ ...customer, paymentMethod: "pay_at_pickup" }); setPaymentError(null); }} />
                Pay at pickup / cash
              </label>
              <label className={`rounded-md border p-3 font-black ${customer.paymentMethod === "stripe" ? "border-china-red bg-red-50 text-china-red" : "border-stone-300 bg-white"}`}>
                <input className="mr-2" type="radio" name="paymentMethod" checked={customer.paymentMethod === "stripe"} onChange={() => { setCustomer({ ...customer, paymentMethod: "stripe" }); setPaymentError(null); }} />
                Pay online with Stripe
              </label>
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-700">Choose a payment method to continue. Stripe Checkout opens only when online payment is selected and Stripe keys are configured.</p>
            {paymentError && <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-china-red">{paymentError}</p>}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-warm">
          <h2 className="text-2xl font-black">Review</h2>
          {!orderingOpen && (
            <p role="alert" className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
              {closedOrderingMessage} {nextOpeningLabel()}
            </p>
          )}
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
            <div className="flex justify-between">
              <span>Processing fee</span>
              <span>{formatPrice(totals.processingFee)}</span>
            </div>
            <div className="flex justify-between text-2xl font-black">
              <span>Total</span>
              <span>{formatPrice(totals.total)}</span>
            </div>
          </div>
          <button disabled={loading || items.length === 0 || !orderingOpen} className="focus-ring mt-6 min-h-12 w-full rounded-md bg-china-red px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
            {loading ? "Placing order..." : "Place order"}
          </button>
        </aside>
      </form>
    </section>
  );
}
