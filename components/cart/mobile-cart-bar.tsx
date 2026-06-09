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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-china-red/20 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-10px_30px_rgba(44,24,16,0.18)] backdrop-blur lg:hidden">
      <Link
        href="/cart"
        className="focus-ring mx-auto flex min-h-14 max-w-lg items-center justify-center gap-2 rounded-md bg-china-red px-4 py-3 text-center font-black text-white shadow-warm"
      >
        <ShoppingCart className="h-5 w-5 shrink-0" />
        <span className="truncate">View Cart</span>
        <span aria-hidden="true">•</span>
        <span className="shrink-0">
          {count} {count === 1 ? "item" : "items"}
        </span>
        <span aria-hidden="true">•</span>
        <span className="shrink-0">{formatPrice(totals.total)}</span>
      </Link>
    </div>
  );
}
