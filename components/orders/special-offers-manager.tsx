"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { OFFER_TYPE_LABELS, OFFER_TYPES, offerSummary } from "@/lib/offer-logic";
import type { OfferType, SpecialOffer } from "@/lib/offer-logic";

type MenuOption = { id: string; number: string; name: string; label: string };

type FormState = {
  id: string | null;
  title: string;
  description: string;
  type: OfferType;
  active: boolean;
  minimumSubtotal: string;
  rewardItemId: string;
  rewardQuantity: string;
  percentOff: string;
  requiredItemId: string;
  secondItemId: string;
  secondItemPercentOff: string;
};

const emptyForm: FormState = {
  id: null,
  title: "",
  description: "",
  type: "free_item",
  active: true,
  minimumSubtotal: "",
  rewardItemId: "",
  rewardQuantity: "1",
  percentOff: "",
  requiredItemId: "",
  secondItemId: "",
  secondItemPercentOff: ""
};

// Fast searchable picker: type a menu number ("6A", "C1") or any part of the name ("crab", "wonton").
function ItemPicker({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (id: string) => void; options: MenuOption[]; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.id === value);
  const q = query.trim().toLowerCase();
  const results = q ? options.filter((option) => `#${option.number} ${option.name}`.toLowerCase().includes(q) || option.number.toLowerCase() === q).slice(0, 8) : [];

  return (
    <div className="grid gap-1 text-sm font-black text-stone-700">
      <span>{label}</span>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2">
          <span className="min-w-0 truncate font-bold text-stone-800">{selected.label}</span>
          <button type="button" onClick={() => { onChange(""); setQuery(""); }} className="focus-ring shrink-0 rounded-md border border-stone-300 px-2 py-1 text-xs font-black text-stone-700">
            Change
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder ?? "Search by number or name"}
            className="focus-ring h-11 w-full rounded-md border border-china-gold/70 pl-9 pr-3 font-bold"
          />
          {q && (
            <div className="mt-1 grid max-h-56 gap-1 overflow-y-auto rounded-md border border-stone-200 bg-white p-1">
              {results.length === 0 && <p className="px-2 py-1 text-sm font-bold text-stone-500">No matching items.</p>}
              {results.map((option) => (
                <button key={option.id} type="button" onClick={() => { onChange(option.id); setQuery(""); }} className="focus-ring rounded-md px-2 py-2 text-left text-sm font-bold text-stone-800 hover:bg-china-paper">
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SpecialOffersManager() {
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<null | "new" | string>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/special-offers");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load special offers.");
      setOffers(data.specialOffers ?? []);
      setMenuOptions(data.menuOptions ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load special offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    setForm(emptyForm);
    setError(null);
    setMessage(null);
    setPanelOpen(true);
    setEditing("new");
  }

  function editOffer(offer: SpecialOffer) {
    setError(null);
    setMessage(null);
    setForm({
      id: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      type: offer.type,
      active: offer.active,
      minimumSubtotal: offer.minimumSubtotal ? String(offer.minimumSubtotal) : "",
      rewardItemId: offer.rewardItemId ?? "",
      rewardQuantity: String(offer.rewardQuantity ?? 1),
      percentOff: offer.percentOff != null ? String(offer.percentOff) : "",
      requiredItemId: offer.requiredItemId ?? "",
      secondItemId: offer.secondItemId ?? "",
      secondItemPercentOff: offer.secondItemPercentOff != null ? String(offer.secondItemPercentOff) : ""
    });
    setEditing(offer.id);
  }

  function closeEditor() {
    setEditing(null);
    setForm(emptyForm);
  }

  function validate(): string | null {
    if (!form.title.trim()) return "A title is required.";
    const min = Number(form.minimumSubtotal || 0);
    if (!Number.isFinite(min) || min < 0) return "Minimum order amount must be 0 or more.";
    if (form.type === "free_item") {
      if (!form.rewardItemId) return "Choose a free reward item.";
      if (Math.round(Number(form.rewardQuantity)) < 1) return "Reward quantity must be 1 or more.";
    }
    if (form.type === "percent_off_order") {
      const pct = Number(form.percentOff);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return "Percentage off must be greater than 0 and at most 100.";
    }
    if (form.type === "bogo") {
      if (!form.requiredItemId) return "Choose the 'buy' item.";
    }
    if (form.type === "buy_one_get_second_percent") {
      if (!form.requiredItemId) return "Choose the 'buy' item.";
      const pct = Number(form.secondItemPercentOff);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return "Second-item percentage off must be greater than 0 and at most 100.";
    }
    return null;
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/special-offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id ?? undefined,
          title: form.title,
          description: form.description,
          type: form.type,
          active: form.active,
          minimumSubtotal: form.minimumSubtotal || 0,
          rewardItemId: form.rewardItemId,
          rewardQuantity: form.rewardQuantity || 1,
          percentOff: form.percentOff,
          requiredItemId: form.requiredItemId,
          secondItemId: form.secondItemId,
          secondItemPercentOff: form.secondItemPercentOff
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save special offer.");
      setOffers(data.specialOffers ?? []);
      setMessage(form.id ? "Special offer updated." : "Special offer created.");
      closeEditor();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save special offer.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(offer: SpecialOffer) {
    setError(null);
    try {
      const response = await fetch("/api/admin/special-offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: offer.id, active: !offer.active })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update special offer.");
      setOffers(data.specialOffers ?? []);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update special offer.");
    }
  }

  async function deleteOffer(offer: SpecialOffer) {
    setError(null);
    setMessage(null);
    if (!window.confirm(`Remove special offer "${offer.title}"?`)) return;
    try {
      const response = await fetch(`/api/admin/special-offers?id=${encodeURIComponent(offer.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not remove special offer.");
      if (form.id === offer.id) closeEditor();
      setOffers(data.specialOffers ?? []);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove special offer.");
    }
  }

  const activeCount = offers.filter((offer) => offer.active).length;

  return (
    <div id="admin-special-offers" className="mobile-safe mt-5 scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:mt-6 sm:p-4">
      {!panelOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-black text-china-red">Special Offers</p>
            <p className="text-sm font-bold text-stone-600">{activeCount} active · {offers.length} total · one offer per order</p>
          </div>
          <button onClick={() => setPanelOpen(true)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-china-red px-4 py-2 text-sm font-black text-white">
            Manage offers
          </button>
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-china-red">Special Offers</p>
          <p className="text-sm font-bold text-stone-600">{activeCount} active · {offers.length} total · one offer per order</p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button onClick={load} disabled={loading} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-bold text-stone-800 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {editing === null && (
            <button onClick={startCreate} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-china-red px-3 py-2 text-sm font-black text-white">
              <Plus className="h-4 w-4" />
              Create offer
            </button>
          )}
          <button onClick={() => { closeEditor(); setPanelOpen(false); }} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-black text-stone-800">
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-china-red">{error}</p>}
      {message && <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800">{message}</p>}

      {editing !== null && (
        <form onSubmit={submitForm} className="mt-3 grid gap-3 rounded-md border border-china-gold/60 bg-white p-3 sm:mt-4 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <p className="font-black text-stone-800">{form.id ? "Edit special offer" : "New special offer"}</p>
            <button type="button" onClick={closeEditor} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-stone-700" aria-label="Close editor">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="grid gap-1 text-sm font-black text-stone-700">
            Offer type
            <select value={form.type} onChange={(event) => update("type", event.target.value as OfferType)} className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold">
              {OFFER_TYPES.map((type) => (
                <option key={type} value={type}>{OFFER_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Title
            <input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="Free Crab Rangoon on orders over $50" className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
          </label>

          <label className="grid gap-1 text-sm font-black text-stone-700 sm:col-span-2">
            Description / display text (optional)
            <input value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Spend $50 or more and add a free order of crab rangoon." className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
          </label>

          {(form.type === "free_item" || form.type === "percent_off_order") && (
            <label className="grid gap-1 text-sm font-black text-stone-700">
              Minimum order subtotal ($, before tax)
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.minimumSubtotal} onChange={(event) => update("minimumSubtotal", event.target.value)} placeholder="50.00" className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
            </label>
          )}

          {form.type === "free_item" && (
            <>
              <ItemPicker label="Free reward item" value={form.rewardItemId} onChange={(id) => update("rewardItemId", id)} options={menuOptions} />
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Free reward quantity
                <input type="number" min="1" step="1" inputMode="numeric" value={form.rewardQuantity} onChange={(event) => update("rewardQuantity", event.target.value)} className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
              </label>
            </>
          )}

          {form.type === "percent_off_order" && (
            <label className="grid gap-1 text-sm font-black text-stone-700">
              Percent off (applies to the whole order subtotal)
              <input type="number" min="1" max="100" step="1" inputMode="decimal" value={form.percentOff} onChange={(event) => update("percentOff", event.target.value)} placeholder="10" className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
            </label>
          )}

          {form.type === "bogo" && (
            <>
              <ItemPicker label="Buy this item" value={form.requiredItemId} onChange={(id) => update("requiredItemId", id)} options={menuOptions} />
              <ItemPicker label="Get this item free (leave to use the same item)" value={form.secondItemId} onChange={(id) => update("secondItemId", id)} options={menuOptions} placeholder="Same as buy item if blank" />
            </>
          )}

          {form.type === "buy_one_get_second_percent" && (
            <>
              <ItemPicker label="Buy this item" value={form.requiredItemId} onChange={(id) => update("requiredItemId", id)} options={menuOptions} />
              <ItemPicker label="Discount this second item (leave to use the same item)" value={form.secondItemId} onChange={(id) => update("secondItemId", id)} options={menuOptions} placeholder="Same as buy item if blank" />
              <label className="grid gap-1 text-sm font-black text-stone-700">
                Percent off the second item only
                <input type="number" min="1" max="100" step="1" inputMode="decimal" value={form.secondItemPercentOff} onChange={(event) => update("secondItemPercentOff", event.target.value)} placeholder="50" className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold" />
              </label>
            </>
          )}

          <label className="flex items-center gap-2 text-sm font-black text-stone-700 sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(event) => update("active", event.target.checked)} className="focus-ring h-5 w-5" />
            Active (customers can see and use this offer)
          </label>

          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <button type="submit" disabled={saving} className="focus-ring min-h-11 rounded-md bg-china-red px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
              {saving ? "Saving..." : form.id ? "Update offer" : "Create offer"}
            </button>
            <button type="button" onClick={closeEditor} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-4 font-black text-stone-800">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 grid gap-2">
        {offers.length === 0 && !loading && <p className="rounded-md border border-china-gold/60 bg-white p-4 text-center font-bold text-stone-600">No special offers yet. Click “Create offer”.</p>}
        {offers.map((offer) => (
          <div key={offer.id} className="grid gap-3 rounded-md border border-china-gold/50 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words font-black text-stone-900">{offer.title}</span>
                <span className="rounded-md bg-china-aqua px-2 py-0.5 text-xs font-black uppercase text-teal-900">{OFFER_TYPE_LABELS[offer.type]}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-black uppercase ${offer.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>
                  {offer.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-0.5 break-words text-sm font-bold text-stone-700">{offerSummary(offer)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <button onClick={() => editOffer(offer)} className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-2 text-sm font-black text-stone-800 sm:px-3">
                Edit
              </button>
              <button onClick={() => toggleActive(offer)} className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-2 text-sm font-black text-stone-800 sm:px-3">
                {offer.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => deleteOffer(offer)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-2 text-sm font-black text-china-red sm:px-3">
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
