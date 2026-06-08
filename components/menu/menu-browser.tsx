"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MenuItemCard } from "@/components/menu/menu-item-card";
import { menuCategories, menuItems } from "@/data/menu";
import type { MenuCategory } from "@/types";

export function MenuBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MenuCategory | "All">("All");
  const [soldOutItemIds, setSoldOutItemIds] = useState<string[]>([]);

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
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-4 rounded-lg border border-red-900/10 bg-white p-4 shadow-warm md:grid-cols-[1fr_280px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by dish name or number"
            className="focus-ring h-14 w-full rounded-md border border-stone-300 pl-12 pr-4 text-lg"
          />
        </label>
        <select value={category} onChange={(event) => setCategory(event.target.value as MenuCategory | "All")} className="focus-ring h-14 rounded-md border border-stone-300 px-4 text-lg font-semibold">
          <option value="All">All menu sections</option>
          {menuCategories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {["All", ...menuCategories].map((name) => (
          <button
            key={name}
            onClick={() => setCategory(name as MenuCategory | "All")}
            className={`focus-ring min-h-11 shrink-0 rounded-md border px-4 py-2 font-bold ${
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
    </section>
  );
}
