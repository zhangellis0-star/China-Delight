"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";

export function MobileCartBar() {
  const { items, count } = useCart();
  const totals = calculateCart(items);

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-china-gold/50 bg-[#fff7e8]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 shadow-[0_-12px_34px_rgba(44,24,16,0.24)] backdrop-blur lg:hidden">
      <Link
        href="/cart"
        className="focus-ring mx-auto flex min-h-14 max-w-lg items-center justify-between gap-3 rounded-lg bg-china-red px-3 py-2.5 text-left font-black text-white shadow-warm"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-china-gold text-china-ink">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base leading-tight">View Cart</span>
            <span className="block truncate text-xs font-bold text-red-50">
              {count} {count === 1 ? "item" : "items"} ready for checkout
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-md bg-white/15 px-2 py-1 text-sm sm:text-base">{formatPrice(totals.total)}</span>
      </Link>
    </div>
  );
}
