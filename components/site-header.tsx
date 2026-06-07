"use client";

import Link from "next/link";
import { Menu, Phone, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { restaurant } from "@/lib/restaurant";
import { useCart } from "@/components/cart/cart-provider";

const links = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/order", label: "Order Online" },
  { href: "/order-status", label: "Order Status" },
  { href: "/contact", label: "Contact" },
  { href: "/admin", label: "Admin" }
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-red-900/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-china-red text-xl font-black text-china-gold shadow-warm">
            CD
          </span>
          <span>
            <span className="block text-xl font-black text-china-deep">{restaurant.name}</span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-stone-600">Take Out & Dine In</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold text-stone-700 hover:text-china-red">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <a href={restaurant.phoneHref} className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-red px-4 py-3 font-bold text-china-red">
            <Phone className="h-5 w-5" />
            {restaurant.phone}
          </a>
          <Link href="/cart" className="focus-ring relative inline-flex items-center gap-2 rounded-md bg-china-red px-4 py-3 font-bold text-white">
            <ShoppingCart className="h-5 w-5" />
            Cart
            {count > 0 && <span className="rounded-full bg-china-gold px-2 py-0.5 text-xs text-china-ink">{count}</span>}
          </Link>
        </div>

        <button onClick={() => setOpen((value) => !value)} className="focus-ring rounded-md border border-stone-300 p-3 lg:hidden" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {open && (
        <div className="border-t border-stone-200 bg-white px-4 py-4 lg:hidden">
          <nav className="grid gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 font-bold text-stone-800 hover:bg-red-50">
                {link.label}
              </Link>
            ))}
            <Link href="/cart" onClick={() => setOpen(false)} className="rounded-md bg-china-red px-3 py-3 font-bold text-white">
              Cart ({count})
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
