"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { calculateCart, formatPrice } from "@/lib/pricing";

export default function CartPage() {
  const { items, updateQuantity, updateNotes, removeItem } = useCart();
  const totals = calculateCart(items);

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-black">Your cart</h1>
      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-stone-200 bg-white p-8 text-center">
          <p className="text-lg font-bold">Your cart is empty.</p>
          <Link href="/order" className="focus-ring mt-5 inline-flex min-h-12 items-center justify-center rounded-md bg-china-red px-5 py-3 font-black text-white">
            Start an order
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid gap-4">
            {items.map((item) => (
              <article key={item.cartId} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col justify-between gap-4 sm:flex-row">
                  <div>
                    <p className="font-black text-china-red">#{item.number}</p>
                    <h2 className="text-xl font-black">{item.name}</h2>
                    <p className="mt-1 text-sm text-stone-600">
                      Size: {item.customization.size} {item.customization.rice ? `| Rice: ${item.customization.rice}` : ""} | Spice: {item.customization.spiceLevel ?? "None"}
                    </p>
                    {item.customization.addOns && item.customization.addOns.length > 0 && <p className="mt-1 text-sm text-stone-600">Add-ons: {item.customization.addOns.join(", ")}</p>}
                    {(item.customization.sauceOnSide || item.customization.noOnion || item.customization.noBroccoli) && (
                      <p className="mt-1 text-sm text-stone-600">
                        {[item.customization.sauceOnSide ? "Sauce on side" : "", item.customization.noOnion ? "No onion" : "", item.customization.noBroccoli ? "No broccoli" : ""].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-black">{formatPrice(item.unitPrice * item.quantity)}</p>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="inline-flex w-fit items-center rounded-md border border-stone-300">
                    <button onClick={() => updateQuantity(item.cartId, item.quantity - 1)} className="focus-ring p-3" aria-label="Decrease quantity">
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

          <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 shadow-warm">
            <h2 className="text-2xl font-black">Order total</h2>
            <div className="mt-5 grid gap-3 text-lg">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatPrice(totals.tax)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-3 text-2xl font-black">
                <span>Total</span>
                <span>{formatPrice(totals.total)}</span>
              </div>
            </div>
            <Link href="/checkout" className="focus-ring mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-china-red px-5 py-3 font-black text-white">
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
