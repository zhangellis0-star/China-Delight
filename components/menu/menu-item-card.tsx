"use client";

import { Minus, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { cartCustomizationKey, useCart } from "@/components/cart/cart-provider";
import { comboIncludedItems, isComboItem, isLunchAvailable, isLunchItem, lunchAvailabilityMessage } from "@/lib/order-rules";
import { defaultSize, formatMenuPrice, formatPrice, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import type { CartCustomization, LunchRiceChoice, LunchSideChoice, MenuItem, MenuPriceKey } from "@/types";

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
  const [size, setSize] = useState<MenuPriceKey>(defaultSize(item));
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

  const price = useMemo(() => getItemPrice(item, size), [item, size]);
  const selectedCombo = comboItem || size === "combo";

  function selectedCustomization(): CartCustomization {
    return {
      size,
      ...(customizable && !isAppetizer ? { spiceLevel } : {}),
      ...(lunchItem ? { lunchRice, lunchSide } : {}),
      ...(selectedCombo ? { includedItems: comboIncludedItems } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {})
    };
  }

  const customizationKey = cartCustomizationKey(selectedCustomization());
  const matchingCartItems = items.filter((cartItem) => cartItem.menuItemId === item.id && cartCustomizationKey(cartItem.customization) === customizationKey);
  const matchingQuantity = matchingCartItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  const firstMatchingCartItem = matchingCartItems[0];

  function handleAdd() {
    if (hasReviewPrice(item, size) || !lunchAvailable || soldOut) return;
    const customization = selectedCustomization();
    addItem(item, customization);
  }

  function handleMinus() {
    if (!firstMatchingCartItem) return;
    if (firstMatchingCartItem.quantity <= 1) removeItem(firstMatchingCartItem.cartId);
    else updateQuantity(firstMatchingCartItem.cartId, firstMatchingCartItem.quantity - 1);
  }

  return (
    <article className="rounded-lg border border-red-900/10 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-china-red">#{item.number}</p>
          <h3 className="mt-0.5 text-lg font-black leading-tight text-china-ink">{item.name}</h3>
          {item.chineseName && <p className="mt-0.5 text-sm font-semibold text-stone-600">{item.chineseName}</p>}
          {item.description && <p className="mt-1.5 text-sm leading-6 text-stone-600">{item.description}</p>}
          {item.spicy && <p className="mt-1.5 inline-flex rounded-md bg-red-50 px-2 py-0.5 text-xs font-black uppercase text-china-red">Hot & Spicy</p>}
          {soldOut && <p className="mt-1.5 inline-flex rounded-md bg-stone-200 px-2 py-0.5 text-xs font-black uppercase text-stone-800">Sold out today</p>}
          {lunchItem && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">{lunchAvailabilityMessage}</p>}
          {(comboItem || item.prices.combo !== undefined) && <p className="mt-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-china-red">Combo includes Pork Fried Rice and Egg Roll.</p>}
          {item.reviewNote && <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{item.reviewNote}</p>}
        </div>
        <p className="shrink-0 text-lg font-black text-china-deep">{hasReviewPrice(item, size) ? "NEEDS REVIEW" : formatPrice(price)}</p>
      </div>

      <div className="mt-3 grid gap-2">
        {sizes.length > 1 && (
          <label className="grid gap-1 text-sm font-bold text-stone-700">
            Size
            <select value={size} onChange={(event) => setSize(event.target.value as MenuPriceKey)} className="focus-ring h-11 rounded-md border border-stone-300 px-3">
              {sizes.map((key) => (
                <option key={key} value={key}>
                  {sizeLabels[key]} - {formatMenuPrice(item.prices[key])}
                </option>
              ))}
            </select>
          </label>
        )}

        {customizable && (
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setShowOptions((open) => !open)}
              aria-expanded={showOptions}
              className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-700"
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showOptions ? "Hide options" : "Customize"}
            </button>

            {showOptions && (
              <div className="grid gap-3 rounded-md border border-stone-200 bg-china-paper p-3">
                {!isAppetizer && (
                  <label className="grid gap-1 text-sm font-bold text-stone-700">
                    Spice level
                    <select value={spiceLevel} onChange={(event) => setSpiceLevel(event.target.value as (typeof spiceLevels)[number])} className="focus-ring h-11 rounded-md border border-stone-300 bg-white px-3">
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
                      <select value={lunchRice} onChange={(event) => setLunchRice(event.target.value as LunchRiceChoice)} className="focus-ring h-11 rounded-md border border-stone-300 bg-white px-3">
                        {lunchRiceChoices.map((choice) => (
                          <option key={choice}>{choice}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-bold text-stone-700">
                      Lunch side
                      <select value={lunchSide} onChange={(event) => setLunchSide(event.target.value as LunchSideChoice)} className="focus-ring h-11 rounded-md border border-stone-300 bg-white px-3">
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
      {matchingQuantity > 0 ? (
        <div className="mt-3 grid grid-cols-[44px_1fr_44px] items-center rounded-md border border-china-red bg-red-50">
          <button type="button" onClick={handleMinus} className="focus-ring flex min-h-11 items-center justify-center text-china-red" aria-label={`Remove one ${item.name}`}>
            <Minus className="h-5 w-5" />
          </button>
          <span className="text-center text-lg font-black text-china-red">{matchingQuantity}</span>
          <button
            type="button"
            onClick={handleAdd}
            disabled={hasReviewPrice(item, size) || !lunchAvailable || soldOut}
            className="focus-ring flex min-h-11 items-center justify-center text-china-red disabled:cursor-not-allowed disabled:text-stone-400"
            aria-label={`Add one ${item.name}`}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button disabled={hasReviewPrice(item, size) || !lunchAvailable || soldOut} onClick={handleAdd} className="focus-ring mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-china-red px-4 py-2.5 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
          <Plus className="h-5 w-5" />
          {hasReviewPrice(item, size) ? "Price Needs Review" : soldOut ? "Sold Out Today" : !lunchAvailable ? "Lunch Unavailable" : "Quick Add"}
        </button>
      )}
    </article>
  );
}
