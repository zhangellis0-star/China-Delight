"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";

type PublicOffer = {
  id: string;
  title: string;
  description?: string | null;
  minimumSubtotal: number;
  rewardItemId: string;
  rewardItemName: string;
  rewardQuantity: number;
};

// Customer-facing special offers with a live progress bar toward each offer's threshold.
// It reads the global cart, so the "$X away" message and the bar update everywhere the
// component is shown (homepage, menu/order, cart) as items are added or removed.
export function SpecialOffersShowcase({ heading = "Special offers", className = "" }: { heading?: string; className?: string }) {
  const { items } = useCart();
  const subtotal = calculateCart(items).subtotal;
  const [offers, setOffers] = useState<PublicOffer[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { specialOffers?: PublicOffer[] }) => {
        if (active) setOffers(data.specialOffers ?? []);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!offers.length) return null;

  return (
    <section className={`overflow-hidden rounded-lg border border-china-gold/60 bg-[#fffaf0] p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="flex items-center gap-2 text-china-red">
        <Gift className="h-5 w-5 shrink-0" />
        <h2 className="text-lg font-black leading-tight sm:text-xl">{heading}</h2>
      </div>
      <div className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {offers.map((offer) => {
          const threshold = Math.max(0, offer.minimumSubtotal);
          const unlocked = subtotal >= threshold;
          const remaining = Math.max(0, threshold - subtotal);
          const pct = threshold > 0 ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 100;
          const rewardLabel = `${offer.rewardQuantity > 1 ? `${offer.rewardQuantity} x ` : ""}${offer.rewardItemName}`;
          return (
            <div key={offer.id} className="w-[min(82vw,20rem)] shrink-0 snap-start rounded-md border border-china-gold/50 bg-white p-3 sm:w-auto sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words font-black leading-tight text-stone-900">{offer.title}</p>
                <span className={`rounded-md px-2 py-0.5 text-xs font-black uppercase ${unlocked ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900"}`}>
                  {unlocked ? "Unlocked" : `Spend ${formatPrice(threshold)}`}
                </span>
              </div>
              <p className="mt-1 break-words text-sm font-bold text-green-700">Free: {rewardLabel}</p>
              {offer.description && <p className="mt-1 text-sm text-stone-600">{offer.description}</p>}
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full transition-all ${unlocked ? "bg-china-green" : "bg-china-gold"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-2 text-sm font-black ${unlocked ? "text-china-green" : "text-stone-700"}`}>
                {unlocked
                  ? `Unlocked! Add your free ${offer.rewardItemName} at checkout.`
                  : `You are ${formatPrice(remaining)} away from unlocking ${offer.title}.`}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
