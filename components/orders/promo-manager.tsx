"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/pricing";
import { promoDiscountTypeLabel } from "@/lib/promo";
import type { PromoCode, PromoDiscountType } from "@/types";

type FormState = {
  id: string | null;
  code: string;
  description: string;
  discountType: PromoDiscountType;
  discountValue: string;
  minimumSubtotal: string;
  expiresAt: string;
  maxUses: string;
  active: boolean;
};

const emptyForm: FormState = {
  id: null,
  code: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  minimumSubtotal: "",
  expiresAt: "",
  maxUses: "",
  active: true
};

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function discountSummary(promo: PromoCode) {
  if (promo.discount_type === "percentage") return `${Number(promo.discount_value)}% off`;
  const prefix = promo.discount_type === "credit" ? "Store credit" : "Discount";
  return `${prefix} ${formatPrice(Number(promo.discount_value))}`;
}

function usageSummary(promo: PromoCode) {
  return promo.max_uses != null ? `${promo.used_count} / ${promo.max_uses} used` : `${promo.used_count} used`;
}

function isExpired(promo: PromoCode) {
  return Boolean(promo.expires_at && new Date(promo.expires_at).getTime() < Date.now());
}

export function PromoManager() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [panelOpen, setPanelOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promo-codes");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load promo codes.");
      setPromoCodes(data.promoCodes ?? []);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load promo codes.");
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

  function closeForm() {
    setFormOpen(false);
    resetForm();
  }

  function startCreate() {
    resetForm();
    setPanelOpen(true);
    setFormOpen(true);
  }

  function editPromo(promo: PromoCode) {
    setMessage(null);
    setError(null);
    setForm({
      id: promo.id,
      code: promo.code,
      description: promo.description ?? "",
      discountType: promo.discount_type,
      discountValue: String(promo.discount_value),
      minimumSubtotal: promo.minimum_subtotal != null ? String(promo.minimum_subtotal) : "",
      expiresAt: toDateInput(promo.expires_at),
      maxUses: promo.max_uses != null ? String(promo.max_uses) : "",
      active: promo.active
    });
    setPanelOpen(true);
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id ?? undefined,
          code: form.code,
          description: form.description,
          discountType: form.discountType,
          discountValue: form.discountValue,
          minimumSubtotal: form.minimumSubtotal || null,
          expiresAt: form.expiresAt || null,
          maxUses: form.maxUses || null,
          active: form.active
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save promo code.");
      const wasEditing = Boolean(form.id);
      resetForm();
      setFormOpen(false);
      setMessage(wasEditing ? "Promo code updated." : "Promo code created.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save promo code.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: PromoCode) {
    setError(null);
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promo.id, active: !promo.active })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update promo code.");
      setPromoCodes((current) => current.map((item) => (item.id === promo.id ? data.promoCode : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update promo code.");
    }
  }

  async function deletePromo(promo: PromoCode) {
    setError(null);
    setMessage(null);
    if (!window.confirm(`Delete promo code ${promo.code}? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/admin/promo-codes?id=${encodeURIComponent(promo.id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete promo code.");
      if (form.id === promo.id) closeForm();
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete promo code.");
    }
  }

  const activeCount = promoCodes.filter((promo) => promo.active).length;

  return (
    <div id="admin-promo" className="mobile-safe mt-5 scroll-mt-24 rounded-lg border border-china-gold/60 bg-[#fff7e8] p-3 shadow-sm sm:mt-6 sm:p-4">
      {!panelOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-black text-china-red">Promo Codes</p>
            <p className="text-sm font-bold text-stone-600">{activeCount} active · {promoCodes.length} total</p>
          </div>
          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <button onClick={() => setPanelOpen(true)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-4 py-2 text-sm font-black text-stone-800">
              Manage
            </button>
            <button onClick={startCreate} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-china-red px-4 py-2 text-sm font-black text-white">
              Create promo code
            </button>
          </div>
        </div>
      ) : (
      <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-china-red">Promo Codes</p>
          <p className="text-sm font-bold text-stone-600">{activeCount} active · {promoCodes.length} total · applied at checkout</p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button onClick={load} disabled={loading} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-bold text-stone-800 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {!formOpen && (
            <button onClick={startCreate} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-china-red px-3 py-2 text-sm font-black text-white">
              Create promo code
            </button>
          )}
          <button onClick={() => { setFormOpen(false); setPanelOpen(false); }} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-china-gold/70 bg-white px-3 py-2 text-sm font-black text-stone-800">
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-china-red">{error}</p>}
      {message && <p className="mt-3 rounded-md bg-green-100 px-3 py-2 text-sm font-bold text-green-800">{message}</p>}

      {formOpen && (
        <form onSubmit={submitForm} className="mt-3 grid gap-3 rounded-md border border-china-gold/60 bg-white p-3 sm:mt-4 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <p className="font-black text-stone-800">{form.id ? "Edit promo code" : "New promo code"}</p>
            <button type="button" onClick={closeForm} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300 text-stone-700" aria-label="Close form">
              <X className="h-4 w-4" />
            </button>
          </div>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Code
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              placeholder="WELCOME10"
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold uppercase"
            />
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Description
            <input
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="10% off first order"
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Discount type
            <select
              value={form.discountType}
              onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as PromoDiscountType }))}
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
            >
              <option value="percentage">Percentage discount</option>
              <option value="fixed">Fixed dollar discount</option>
              <option value="credit">Store credit</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            {form.discountType === "percentage" ? "Discount value (%)" : "Discount value ($)"}
            <input
              type="number"
              min="0"
              step={form.discountType === "percentage" ? "1" : "0.01"}
              inputMode="decimal"
              value={form.discountValue}
              onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
              placeholder={form.discountType === "percentage" ? "10" : "5.00"}
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Minimum order subtotal ($, optional)
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.minimumSubtotal}
              onChange={(event) => setForm((current) => ({ ...current, minimumSubtotal: event.target.value }))}
              placeholder="No minimum"
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Max uses (optional)
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={form.maxUses}
              onChange={(event) => setForm((current) => ({ ...current, maxUses: event.target.value }))}
              placeholder="Unlimited"
              className="focus-ring h-11 rounded-md border border-china-gold/70 px-3 font-bold"
            />
          </label>
          <label className="grid gap-1 text-sm font-black text-stone-700">
            Expiration date (optional)
            <input
              type="date"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
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
            Active (customers can apply this code)
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <button type="submit" disabled={saving} className="focus-ring min-h-11 rounded-md bg-china-red px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-stone-400">
              {saving ? "Saving..." : form.id ? "Update code" : "Create code"}
            </button>
            <button type="button" onClick={closeForm} className="focus-ring min-h-11 rounded-md border border-china-gold/70 bg-white px-4 font-black text-stone-800">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 grid gap-2">
        {promoCodes.length === 0 && !loading && <p className="rounded-md border border-china-gold/60 bg-white p-4 text-center font-bold text-stone-600">No promo codes yet. Click “Create promo code”.</p>}
        {promoCodes.map((promo) => {
          const expired = isExpired(promo);
          return (
            <div key={promo.id} className="grid gap-3 rounded-md border border-china-gold/50 bg-white p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-black text-stone-900">{promo.code}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-black uppercase ${promo.active ? "bg-green-100 text-green-800" : "bg-stone-200 text-stone-700"}`}>
                    {promo.active ? "Active" : "Inactive"}
                  </span>
                  {expired && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black uppercase text-amber-900">Expired</span>}
                </div>
                {promo.description && <p className="mt-0.5 text-sm font-bold text-stone-600">{promo.description}</p>}
                <p className="mt-0.5 break-words text-sm font-bold text-stone-700">
                  {discountSummary(promo)} · {promoDiscountTypeLabel(promo.discount_type)} · {usageSummary(promo)}
                </p>
                <p className="mt-0.5 break-words text-xs font-bold text-stone-500">
                  {promo.minimum_subtotal != null ? `Min ${formatPrice(Number(promo.minimum_subtotal))}` : "No minimum"}
                  {promo.expires_at ? ` · Expires ${new Date(promo.expires_at).toLocaleDateString()}` : " · No expiration"}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button onClick={() => editPromo(promo)} className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-2 text-sm font-black text-stone-800 sm:px-3">
                  Edit
                </button>
                <button onClick={() => toggleActive(promo)} className="focus-ring min-h-10 rounded-md border border-china-gold/70 bg-white px-2 text-sm font-black text-stone-800 sm:px-3">
                  {promo.active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => deletePromo(promo)}
                  disabled={(promo.used_count ?? 0) > 0}
                  title={(promo.used_count ?? 0) > 0 ? "Used codes cannot be deleted. Disable instead." : "Delete promo code"}
                  className="focus-ring inline-flex min-h-10 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-2 text-sm font-black text-china-red disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}
