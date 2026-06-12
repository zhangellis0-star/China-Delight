"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { SpecialOffersShowcase } from "@/components/orders/special-offers-showcase";
import { customizationText } from "@/lib/order-display";
import { closedOrderingMessage, isRestaurantOpen, nextOpeningLabel } from "@/lib/order-rules";
import { calculateCart, formatPrice } from "@/lib/pricing";

type PublicSettings = {
  orderingAllowed: boolean;
  orderingOverride?: { mode: "normal" | "open" | "paused"; expiresAt: string | null };
  nextBoundary?: { label: string; iso: string };
};

export default function CartPage() {
  const { items, updateQuantity, updateNotes, removeItem } = useCart();
  const totals = calculateCart(items);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const orderingOpen = settings?.orderingAllowed ?? isRestaurantOpen();

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

  return (
    <section className={`mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 ${items.length > 0 ? "pb-28 lg:pb-10" : ""}`}>
      <h1 className="text-3xl font-black sm:text-4xl">Your cart</h1>
      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-lg font-bold">Your cart is empty.</p>
          <Link href="/order" className="focus-ring mt-5 inline-flex min-h-12 items-center justify-center rounded-md bg-china-red px-5 py-3 font-black text-white">
            Start an order
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:mt-8 lg:grid-cols-[1fr_340px] lg:gap-6">
          <div className="grid gap-4">
            {items.map((item) => (
              <article key={item.cartId} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div className="min-w-0">
                    <p className="font-black text-china-red">#{item.number}</p>
                    <h2 className="break-words text-lg font-black sm:text-xl">{item.name}</h2>
                    <p className="mt-1 break-words text-sm text-stone-600">
                      {customizationText(item.customization)}
                    </p>
                  </div>
                  <p className="text-lg font-black sm:text-xl">{formatPrice(item.unitPrice * item.quantity)}</p>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="inline-flex w-fit items-center rounded-md border border-stone-300">
                    <button onClick={() => (item.quantity <= 1 ? removeItem(item.cartId) : updateQuantity(item.cartId, item.quantity - 1))} className="focus-ring p-3" aria-label="Decrease quantity">
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="min-w-12 text-center text-lg font-black">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartId, item.quantity + 1)} className="focus-ring p-3" aria-label="Increase quantity">
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.cartId)} className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 font-bold text-china-red">
                    <Trash2 className="h-5 w-5" />
                    Remove
                  </button>
                </div>
                <label className="mt-4 grid gap-1 text-sm font-bold text-stone-700">
                  Item notes
                  <textarea value={item.customization.notes ?? ""} onChange={(event) => updateNotes(item.cartId, event.target.value)} className="focus-ring min-h-20 rounded-md border border-stone-300 p-3" />
                </label>
              </article>
            ))}
          </div>

          <aside className="grid h-fit gap-4">
            <SpecialOffersShowcase heading="Unlock a free item" />
            <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-warm sm:p-5">
            <h2 className="text-xl font-black sm:text-2xl">Order total</h2>
            <div className="mt-4 grid gap-3 text-base sm:mt-5 sm:text-lg">
              <div className="flex justify-between gap-3">
                <span>Subtotal</span>
                <span>{formatPrice(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Tax</span>
                <span>{formatPrice(totals.tax)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Processing fee</span>
                <span>{formatPrice(totals.processingFee)}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-stone-200 pt-3 text-xl font-black sm:text-2xl">
                <span>Total</span>
                <span>{formatPrice(totals.total)}</span>
              </div>
            </div>
            {!orderingOpen && (
              <p className="mt-5 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
                {settings?.orderingOverride?.mode === "paused" ? `Online ordering is paused until ${settings.nextBoundary?.label ?? "the next store-hours boundary"}.` : `${closedOrderingMessage} ${nextOpeningLabel()}`}
              </p>
            )}
            {orderingOpen ? (
              <Link href="/checkout" className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-china-red px-5 py-3 font-black text-white">
                Checkout
              </Link>
            ) : (
              <span className="mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-md bg-stone-400 px-5 py-3 font-black text-white">
                Checkout unavailable
              </span>
            )}
            </div>
          </aside>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-china-gold/50 bg-[#fff7e8]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 shadow-[0_-12px_34px_rgba(44,24,16,0.24)] backdrop-blur lg:hidden">
            {orderingOpen ? (
              <Link href="/checkout" className="focus-ring mx-auto flex min-h-14 max-w-lg items-center justify-center rounded-lg bg-china-red px-4 py-2.5 text-center text-base font-black text-white shadow-warm">
                Checkout - {formatPrice(totals.total)}
              </Link>
            ) : (
              <div className="mx-auto flex min-h-14 max-w-lg items-center justify-center rounded-lg bg-stone-400 px-4 py-2.5 text-center text-sm font-black text-white">
                Checkout unavailable
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
