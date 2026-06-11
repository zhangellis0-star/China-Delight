"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import type { SpecialOffer } from "@/lib/special-offers";

type MenuOption = { id: string; label: string };

type FormState = {
  id: string | null;
  title: string;
  description: string;
  minimumSubtotal: string;
  rewardItemId: string;
  rewardQuantity: string;
  active: boolean;
};

const emptyForm: FormState = {
  id: null,
  title: "",
  description: "",
  minimumSubtotal: "",
  rewardItemId: "",
  rewardQuantity: "1",
  active: true
};

export function SpecialOffersManager() {
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
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

  function resetForm() {
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  function editOffer(offer: SpecialOffer) {
    setMessage(null);
    setError(null);
    setForm({
      id: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      minimumSubtotal: String(offer.minimumSubtotal),
      rewardItemId: offer.rewardItemId,
      rewardQuantity: String(offer.rewardQuantity),
      active: offer.active
    });
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          minimumSubtotal: form.minimumSubtotal || 0,
          rewardItemId: form.rewardItemId,
          rewardQuantity: form.rewardQuantity || 1,
          active: form.active
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save special offer.");
      setOffers(data.specialOffers ?? []);
      setMessage(form.id ? "Special offer updated." : "Special offer created.");
      resetForm();
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
      if (form.id === offer.id) resetForm();
      setOffers(data.specialOffers ?? []);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove special offer.");
    }
  }

  function rewardLabel(offer: SpecialOffer) {
    return menuOptions.find((option) => option.id === offer.rewardItemId)?.label ?? offer.rewardItemId;
  }

  return (
    <div id="admin-special-offers" className="mt-6 scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-black text-china-red">Special Offers</p>
        <button onClick={load} disabled={loading} className="focus-ring inline-flex items-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-bold text-stone-800 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      <p className="mt-1 text-sm font-bold text-stone-600">Customer-facing offers (e.g. spend $50, get a free item). Customers can use one offer per order.</p>

      {error && <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-china-red">{error}</p>}
      {message && <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800">{message}</p>}

      <form onSubmit={submitForm} className="mt-4 grid gap-3 rounded-md border border-china-gold/60 bg-white p-3 sm:grid-cols-2">
        <p className="font-black text-stone-800 sm:col-span-2">{form.id ? "Edit special offer" : "New special offer"}</p>
        <label className="grid gap-1 text-sm font-black text-stone-700">
          Title
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Free Crab Rangoon on orders over $50"
            className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-stone-700">
          Description (optional)
          <input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Spend $50 or more and add a free order of crab rangoon."
            className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-stone-700">
          Minimum order subtotal ($, before tax)
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.minimumSubtotal}
            onChange={(event) => setForm((current) => ({ ...current, minimumSubtotal: event.target.value }))}
            placeholder="50.00"
            className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
          />
        </label>
        <label className="grid gap-1 text-sm font-black text-stone-700">
          Free reward item
          <select
            value={form.rewardItemId}
            onChange={(event) => setForm((current) => ({ ...current, rewardItemId: event.target.value }))}
            className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
          >
            <option value="">Select a menu item</option>
            {menuOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-black text-stone-700">
          Free reward quantity
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={form.rewardQuantity}
            onChange={(event) => setForm((current) => ({ ...current, rewardQuantity: event.target.value }))}
            className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-black text-stone-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            className="focus-ring h-5 w-5"
          />
          Active (customers can see and use this offer)
        </label>
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="focus-ring min-h-11 rounded-md bg-china-red px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
            {saving ? "Saving..." : form.id ? "Update offer" : "Create offer"}
          </button>
          <button type="button" onClick={resetForm} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-4 font-black text-stone-800">
            {form.id ? "Cancel edit" : "Clear form"}
          </button>
        </div>
      </form>

      <div className="mt-4 grid gap-2">
        {offers.length === 0 && !loading && <p className="rounded-md border border-china-gold/60 bg-white p-4 text-center font-bold text-stone-600">No special offers yet.</p>}
        {offers.map((offer) => (
          <div key={offer.id} className="grid gap-2 rounded-md border border-china-gold/50 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-stone-900">{offer.title}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-black uppercase ${offer.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>
                  {offer.active ? "Active" : "Inactive"}
                </span>
              </div>
              {offer.description && <p className="mt-0.5 text-sm font-bold text-stone-600">{offer.description}</p>}
              <p className="mt-0.5 text-sm font-bold text-stone-700">
                Spend {formatPrice(offer.minimumSubtotal)} → free {offer.rewardQuantity > 1 ? `${offer.rewardQuantity} x ` : ""}{rewardLabel(offer)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button onClick={() => editOffer(offer)} className="focus-ring min-h-9 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
                Edit
              </button>
              <button onClick={() => toggleActive(offer)} className="focus-ring min-h-9 rounded-md border border-china-gold/70 bg-white px-3 text-sm font-black text-stone-800">
                {offer.active ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => deleteOffer(offer)}
                className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-md border border-red-200 bg-white px-3 text-sm font-black text-china-red"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
