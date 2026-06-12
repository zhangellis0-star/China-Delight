"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MobileCartBar } from "@/components/cart/mobile-cart-bar";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { SpecialOffersShowcase } from "@/components/orders/special-offers-showcase";
import { menuCategories, menuItems } from "@/data/menu";
import { useCart } from "@/components/cart/cart-provider";
import type { MenuCategory } from "@/types";

export function MenuBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MenuCategory | "All">("All");
  const [soldOutItemIds, setSoldOutItemIds] = useState<string[]>([]);
  const { count } = useCart();

  useEffect(() => {
    fetch("/api/settings")
      .then((response) => response.json())
      .then((data: { soldOutItemIds?: string[] }) => setSoldOutItemIds(data.soldOutItemIds ?? []))
      .catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesQuery =
        !normalized ||
        item.name.toLowerCase().includes(normalized) ||
        item.number.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  return (
    <section className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${count > 0 ? "pb-28 lg:pb-8" : ""}`}>
      <SpecialOffersShowcase className="mb-6" />
      <div className="grid gap-3 rounded-lg border border-red-900/10 bg-white p-3 shadow-warm sm:p-4 md:grid-cols-[1fr_280px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by dish name or number"
            className="focus-ring h-12 w-full rounded-md border border-stone-300 pl-12 pr-4 text-base sm:h-14 sm:text-lg"
          />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value as MenuCategory | "All")} className="focus-ring h-12 rounded-md border border-stone-300 px-3 text-base font-semibold sm:h-14 sm:px-4 sm:text-lg">
          <option value="All">All menu sections</option>
          {menuCategories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {["All", ...menuCategories].map((name) => (
          <button
            key={name}
            onClick={() => setCategory(name as MenuCategory | "All")}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-3 py-2 text-sm font-bold sm:px-4 sm:text-base ${
              category === name ? "border-china-red bg-china-red text-white" : "border-stone-300 bg-white text-stone-700"
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <p className="mt-5 font-semibold text-stone-700">{filtered.length} items found</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <MenuItemCard key={item.id} item={item} soldOut={soldOutItemIds.includes(item.id)} />
        ))}
      </div>
      <MobileCartBar />
    </section>
  );
}
