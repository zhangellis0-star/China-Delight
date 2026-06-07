"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { addonPrices } from "@/lib/restaurant";
import { defaultSize, formatMenuPrice, formatPrice, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import type { CartCustomization, MenuItem, MenuPriceKey } from "@/types";

const spiceLevels = ["None", "Mild", "Medium", "Hot", "Extra Hot"] as const;
const riceOptions = ["White Rice", "Fried Rice", "Pork Fried Rice", "No Rice"] as const;
const sizeLabels: Record<MenuPriceKey, string> = {
  pint: "Pint",
  quart: "Quart",
  combo: "Combo",
  order: "Order",
  large: "Large",
  small: "Small"
};

export function MenuItemCard({ item, orderMode }: { item: MenuItem; orderMode?: boolean }) {
  const { addItem } = useCart();
  const sizes = (Object.keys(item.prices) as MenuPriceKey[]).filter((key) => item.prices[key] !== undefined);
  const [size, setSize] = useState<MenuPriceKey>(defaultSize(item));
  const [spiceLevel, setSpiceLevel] = useState<(typeof spiceLevels)[number]>("None");
  const [rice, setRice] = useState<(typeof riceOptions)[number]>("White Rice");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [sauceOnSide, setSauceOnSide] = useState(false);
  const [noOnion, setNoOnion] = useState(false);
  const [noBroccoli, setNoBroccoli] = useState(false);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);

  const price = useMemo(() => {
    const addonTotal = addOns.reduce((sum, name) => sum + (addonPrices[name as keyof typeof addonPrices] ?? 0), 0);
    return getItemPrice(item, size) + addonTotal;
  }, [addOns, item, size]);

  function toggleAddon(addon: string) {
    setAddOns((current) => (current.includes(addon) ? current.filter((name) => name !== addon) : [...current, addon]));
  }

  function handleAdd() {
    if (hasReviewPrice(item, size)) return;
    const customization: CartCustomization = { size, spiceLevel, rice: item.options?.rice ? rice : undefined, addOns, sauceOnSide, noOnion, noBroccoli, notes };
    addItem(item, customization);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <article className="rounded-lg border border-red-900/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-china-red">#{item.number}</p>
          <h3 className="mt-1 text-xl font-black text-china-ink">{item.name}</h3>
          {item.chineseName && <p className="mt-1 text-sm font-semibold text-stone-600">{item.chineseName}</p>}
          {item.description && <p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p>}
          {item.spicy && <p className="mt-2 inline-flex rounded-md bg-red-50 px-2 py-1 text-xs font-black uppercase text-china-red">Hot & Spicy</p>}
          {item.reviewNote && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">{item.reviewNote}</p>}
        </div>
        <p className="shrink-0 text-xl font-black text-china-deep">{hasReviewPrice(item, size) ? "NEEDS REVIEW" : formatPrice(price)}</p>
      </div>

      <div className="mt-4 grid gap-3">
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

        {orderMode && (
          <>
            <label className="grid gap-1 text-sm font-bold text-stone-700">
              Spice level
              <select value={spiceLevel} onChange={(event) => setSpiceLevel(event.target.value as (typeof spiceLevels)[number])} className="focus-ring h-11 rounded-md border border-stone-300 px-3">
                {spiceLevels.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>
            </label>

            {item.options?.rice && (
              <label className="grid gap-1 text-sm font-bold text-stone-700">
                Rice option
                <select value={rice} onChange={(event) => setRice(event.target.value as (typeof riceOptions)[number])} className="focus-ring h-11 rounded-md border border-stone-300 px-3">
                  {riceOptions.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid gap-2">
              <p className="text-sm font-bold text-stone-700">Add-ons</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(addonPrices).map(([name, cost]) => (
                  <label key={name} className="flex items-center gap-2 rounded-md border border-stone-200 p-2 text-sm">
                    <input type="checkbox" checked={addOns.includes(name)} onChange={() => toggleAddon(name)} />
                    <span>{name} +{formatPrice(cost)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-bold text-stone-700">Kitchen options</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 rounded-md border border-stone-200 p-2 text-sm">
                  <input type="checkbox" checked={sauceOnSide} onChange={(event) => setSauceOnSide(event.target.checked)} />
                  <span>Sauce on side</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-stone-200 p-2 text-sm">
                  <input type="checkbox" checked={noOnion} onChange={(event) => setNoOnion(event.target.checked)} />
                  <span>No onion</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-stone-200 p-2 text-sm">
                  <input type="checkbox" checked={noBroccoli} onChange={(event) => setNoBroccoli(event.target.checked)} />
                  <span>No broccoli</span>
                </label>
              </div>
            </div>

            <label className="grid gap-1 text-sm font-bold text-stone-700">
              Special instructions
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="focus-ring min-h-20 rounded-md border border-stone-300 p-3" placeholder="No onions, sauce on side, allergy notes..." />
            </label>
          </>
        )}
      </div>

      <button disabled={hasReviewPrice(item, size)} onClick={handleAdd} className="focus-ring mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-china-red px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
        <Plus className="h-5 w-5" />
        {hasReviewPrice(item, size) ? "Price Needs Review" : added ? "Added" : orderMode ? "Add to Cart" : "Quick Add"}
      </button>
    </article>
  );
}
