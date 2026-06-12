"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";
import { computeOffer, offerSummary } from "@/lib/offer-logic";
import type { PublicSpecialOffer } from "@/lib/offer-logic";

// Customer-facing special offers. Reads the global cart so the live state (progress bar / "unlocked")
// updates everywhere the component is shown (homepage, menu/order, cart) as items change. It uses the
// same computeOffer the checkout uses, so what shows here matches what applies at checkout.
export function SpecialOffersShowcase({ heading = "Special offers", className = "" }: { heading?: string; className?: string }) {
  const { items } = useCart();
  const subtotal = calculateCart(items).subtotal;
  const [offers, setOffers] = useState<PublicSpecialOffer[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { specialOffers?: PublicSpecialOffer[] }) => {
        if (active) setOffers(data.specialOffers ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!offers.length) return null;

  return (
    <section className={`rounded-lg border border-china-gold/60 bg-[#fffaf0] p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-china-red">
        <Gift className="h-5 w-5" />
        <h2 className="text-xl font-black">{heading}</h2>
      </div>
      <div className="mt-4 grid gap-4">
        {offers.map((offer) => {
          const result = computeOffer(offer, items, subtotal);
          const threshold = Math.max(0, offer.minimumSubtotal);
          const hasThreshold = threshold > 0;
          const remaining = Math.max(0, threshold - subtotal);
          const pct = hasThreshold ? Math.min(100, Math.round((subtotal / threshold) * 100)) : result.applied ? 100 : 0;
          return (
            <div key={offer.id} className="rounded-md border border-china-gold/50 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-stone-900">{offer.title}</p>
                <span className={`rounded-md px-2 py-0.5 text-xs font-black uppercase ${result.applied ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                  {result.applied ? "Unlocked" : hasThreshold ? `Spend ${formatPrice(threshold)}` : "Add items"}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-green-700">{offerSummary(offer)}</p>
              {offer.description && <p className="mt-1 text-sm text-stone-600">{offer.description}</p>}
              {hasThreshold && (
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full transition-all ${result.applied ? "bg-china-green" : "bg-china-gold"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className={`mt-2 text-sm font-black ${result.applied ? "text-china-green" : "text-stone-700"}`}>
                {result.applied
                  ? "Unlocked! Choose this offer at checkout."
                  : hasThreshold
                    ? `You are ${formatPrice(remaining)} away from unlocking this offer.`
                    : result.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
