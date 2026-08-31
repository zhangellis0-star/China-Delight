"use client";

import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { cartCustomizationKey, useCart } from "@/components/cart/cart-provider";
import { comboIncludedItems, isComboItem, isLunchAvailable, isLunchItem, lunchAvailabilityMessage } from "@/lib/order-rules";
import { defaultSize, formatMenuPrice, formatPrice, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import type { CartCustomization, CartItem, LunchRiceChoice, LunchSideChoice, MenuItem, MenuPriceKey } from "@/types";

const spiceLevels = ["None", "Mild", "Medium", "Hot", "Extra Hot"] as const;
const sizeLabels: Record<MenuPriceKey, string> = {
  pint: "Pint",
  quart: "Quart",
  combo: "Combo",
  order: "Order",
  large: "Large",
  small: "Small"
};
const lunchRiceChoices: LunchRiceChoice[] = ["Pork Fried Rice", "White Rice"];
const lunchSideChoices: LunchSideChoice[] = ["Egg Roll", "Wonton Soup", "Egg Drop Soup", "Canned Soda"];

export function MenuItemCard({ item, soldOut = false }: { item: MenuItem; soldOut?: boolean }) {
  const { items, addItem, removeItem, updateQuantity } = useCart();
  const sizes = (Object.keys(item.prices) as MenuPriceKey[]).filter((key) => item.prices[key] !== undefined);
  const multiSize = sizes.length > 1;
  const [spiceLevel, setSpiceLevel] = useState<(typeof spiceLevels)[number]>(item.spicy ? "Hot" : "None");
  const [lunchRice, setLunchRice] = useState<LunchRiceChoice>("Pork Fried Rice");
  const [lunchSide, setLunchSide] = useState<LunchSideChoice>("Egg Roll");
  const [notes, setNotes] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  // Appetizers have no customization. Every other item allows only spice level and special instructions.
  const isAppetizer = item.category === "Appetizers";
  const lunchItem = isLunchItem(item);
  const comboItem = isComboItem(item);
  const lunchAvailable = !lunchItem || isLunchAvailable();
  const customizable = !isAppetizer;

  // Same spice/lunch/notes customization applies no matter which size is being added — only the
  // size itself (and whatever it implies, like combo includes) varies per row.
  function customizationFor(size: MenuPriceKey): CartCustomization {
    const combo = comboItem || size === "combo";
    return {
      size,
      ...(customizable && !isAppetizer ? { spiceLevel } : {}),
      ...(lunchItem ? { lunchRice, lunchSide } : {}),
      ...(combo ? { includedItems: comboIncludedItems } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {})
    };
  }

  function matchingItemsFor(size: MenuPriceKey): CartItem[] {
    const key = cartCustomizationKey(customizationFor(size));
    return items.filter((cartItem) => cartItem.menuItemId === item.id && cartCustomizationKey(cartItem.customization) === key);
  }

  function handleAdd(size: MenuPriceKey) {
    if (hasReviewPrice(item, size) || !lunchAvailable || soldOut) return;
    addItem(item, customizationFor(size));
  }

  function handleMinus(size: MenuPriceKey) {
    const first = matchingItemsFor(size)[0];
    if (!first) return;
    if (first.quantity <= 1) removeItem(first.cartId);
    else updateQuantity(first.cartId, first.quantity - 1);
  }

  // "full" is the original single-size layout: full-width button with a contextual empty-state
  // label (Sold Out / Lunch Unavailable / Price Needs Review). "compact" is the per-size row
  // layout used when multiple sizes are offered — small "+ Add" since it sits inline next to
  // several other sizes.
  function QuantityControl({ size, variant = "compact" }: { size: MenuPriceKey; variant?: "full" | "compact" }) {
    const quantity = matchingItemsFor(size).reduce((sum, cartItem) => sum + cartItem.quantity, 0);
    const disabled = hasReviewPrice(item, size) || !lunchAvailable || soldOut;
    if (quantity === 0) {
      if (variant === "full") {
        return (
          <button
            disabled={disabled}
            onClick={() => handleAdd(size)}
            className="focus-ring mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-china-red px-4 py-2.5 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            <Plus className="h-5 w-5" />
            {hasReviewPrice(item, size) ? "Price Needs Review" : soldOut ? "Sold Out Today" : !lunchAvailable ? "Lunch Unavailable" : "Quick Add"}
          </button>
        );
      }
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleAdd(size)}
          className="focus-ring inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-china-red px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      );
    }
    const sizeClass = variant === "full" ? "mt-3 grid grid-cols-[48px_1fr_48px]" : "grid grid-cols-[36px_32px_36px]";
    const iconClass = variant === "full" ? "h-5 w-5" : "h-4 w-4";
    return (
      <div className={`${sizeClass} items-center rounded-md border border-china-red bg-red-50`}>
        <button type="button" onClick={() => handleMinus(size)} className="focus-ring flex min-h-10 items-center justify-center text-china-red" aria-label={`Remove one ${sizeLabels[size]} ${item.name}`}>
          <Minus className={iconClass} />
        </button>
        <span className={`text-center font-black text-china-red ${variant === "full" ? "text-lg" : ""}`}>{quantity}</span>
        <button
          type="button"
          onClick={() => handleAdd(size)}
          disabled={disabled}
          className="focus-ring flex min-h-10 items-center justify-center text-china-red disabled:cursor-not-allowed disabled:text-stone-400"
          aria-label={`Add one ${sizeLabels[size]} ${item.name}`}
        >
          <Plus className={iconClass} />
        </button>
      </div>
    );
  }

  const singleSize = sizes[0] ?? defaultSize(item);
  const priceRangeLabel = (() => {
    if (multiSize) {
      const prices = sizes.map((key) => getItemPrice(item, key)).filter((value) => value > 0);
      if (!prices.length) return null;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`;
    }
    return hasReviewPrice(item, singleSize) ? "NEEDS REVIEW" : formatPrice(getItemPrice(item, singleSize));
  })();

  return (
    <article className="rounded-lg border border-red-900/10 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-china-red">#{item.number}</p>
          <h3 className="mt-0.5 break-words text-base font-black leading-tight text-china-ink sm:text-lg">{item.name}</h3>
          {item.description && <p className="mt-1.5 text-sm leading-6 text-stone-600">{item.description}</p>}
          {item.spicy && <p className="mt-1.5 inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-black uppercase text-china-red">Hot & Spicy</p>}
          {soldOut && <p className="mt-1.5 inline-flex rounded-md bg-stone-200 px-2 py-0.5 text-xs font-black uppercase text-stone-800">Sold out today</p>}
          {lunchItem && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">{lunchAvailabilityMessage}</p>}
          {(comboItem || item.prices.combo !== undefined) && <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-china-red">Combo includes Pork Fried Rice and Egg Roll.</p>}
          {item.reviewNote && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{item.reviewNote}</p>}
        </div>
        {!multiSize && <p className="shrink-0 text-base font-black text-china-deep sm:text-lg">{priceRangeLabel}</p>}
      </div>

      <div className="mt-3 grid gap-2">
        {multiSize && (
          <div className="grid gap-2">
            {sizes.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-stone-300 bg-china-paper px-3 py-2">
                <div className="min-w-0">
                  <p className="font-bold text-stone-800">{sizeLabels[key]}</p>
                  <p className="text-sm text-stone-600">{hasReviewPrice(item, key) ? "NEEDS REVIEW" : formatMenuPrice(item.prices[key])}</p>
                </div>
                <QuantityControl size={key} />
              </div>
            ))}
          </div>
        )}

        {customizable && (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setShowOptions((open) => !open)}
              aria-expanded={showOptions}
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showOptions ? "Hide options" : "Customize"}
            </button>

            {showOptions && (
              <div className="grid gap-3 rounded-md border border-stone-200 bg-china-paper p-3">
                {!isAppetizer && (
                  <label className="grid gap-1 text-sm font-bold text-stone-700">
                    Spice level
                      <select value={spiceLevel} onChange={(event) => setSpiceLevel(event.target.value as (typeof spiceLevels)[number])} className="focus-ring h-12 rounded-md border border-stone-300 bg-white px-3">
                      {spiceLevels.map((level) => (
                        <option key={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                )}

                {lunchItem && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-bold text-stone-700">
                      Lunch rice
                      <select value={lunchRice} onChange={(event) => setLunchRice(event.target.value as LunchRiceChoice)} className="focus-ring h-12 rounded-md border border-stone-300 bg-white px-3">
                        {lunchRiceChoices.map((choice) => (
                          <option key={choice}>{choice}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold text-stone-700">
                      Lunch side
                      <select value={lunchSide} onChange={(event) => setLunchSide(event.target.value as LunchSideChoice)} className="focus-ring h-12 rounded-md border border-stone-300 bg-white px-3">
                        {lunchSideChoices.map((choice) => (
                          <option key={choice}>{choice}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <label className="grid gap-1 text-sm font-bold text-stone-700">
                  Special instructions
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="focus-ring min-h-20 rounded-md border border-stone-300 bg-white p-3" placeholder="Allergy notes, preparation requests..." />
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {!lunchAvailable && <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{lunchAvailabilityMessage}</p>}
      {!multiSize && <QuantityControl size={singleSize} variant="full" />}
    </article>
  );
}
