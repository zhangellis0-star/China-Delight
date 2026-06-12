"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";
import { computeOffer, offerSummary } from "@/lib/offer-logic";
import type { PublicSpecialOffer } from "@/lib/offer-logic";

// Customer-facing special offers shown as a compact, horizontally scrollable row of small promo
// cards (saves vertical space; only this row scrolls sideways, never the whole page). Reads the
// global cart so the "unlocked" state / progress bar update live, using the same computeOffer the
// checkout uses so what shows here matches what applies at checkout.
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
    <section className={`overflow-hidden rounded-lg border border-china-gold/60 bg-[#fffaf0] p-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 text-china-red">
        <Gift className="h-4 w-4" />
        <h2 className="text-sm font-black uppercase tracking-wide">{heading}</h2>
      </div>
      {/* Only this row scrolls horizontally; cards have a fixed width and snap into place. */}
      <div className="-mx-3 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-3 pb-1 [-webkit-overflow-scrolling:touch]">
        {offers.map((offer) => {
          const result = computeOffer(offer, items, subtotal);
          const threshold = Math.max(0, offer.minimumSubtotal);
          const hasThreshold = threshold > 0;
          const remaining = Math.max(0, threshold - subtotal);
          const pct = hasThreshold ? Math.min(100, Math.round((subtotal / threshold) * 100)) : result.applied ? 100 : 0;
          return (
            <div key={offer.id} className="flex w-56 shrink-0 snap-start flex-col rounded-md border border-china-gold/50 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-black leading-tight text-stone-900">{offer.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${result.applied ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                  {result.applied ? "Ready" : hasThreshold ? formatPrice(threshold) : "Add"}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-stone-600">{offerSummary(offer)}</p>
              {hasThreshold && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className={`h-full rounded-full transition-all ${result.applied ? "bg-china-green" : "bg-china-gold"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className={`mt-1.5 text-[11px] font-black leading-snug ${result.applied ? "text-china-green" : "text-stone-600"}`}>
                {result.applied ? "Unlocked — pick it at checkout" : hasThreshold ? `${formatPrice(remaining)} away` : result.reason}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
