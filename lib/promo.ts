// Shared promo-code logic. Pure and import-safe on both the client and the server
// (no env, no Supabase, no Node APIs) so checkout, the validate route, and the
// checkout route all compute the same discount.
import type { PromoDiscountType } from "@/types";

export const PROMO_DISCOUNT_TYPES: PromoDiscountType[] = ["percentage", "fixed", "credit"];

export function normalizePromoCode(code: string) {
  return code.trim().toUpperCase();
}

export function isPromoDiscountType(value: unknown): value is PromoDiscountType {
  return typeof value === "string" && (PROMO_DISCOUNT_TYPES as string[]).includes(value);
}

export function promoDiscountTypeLabel(type: PromoDiscountType) {
  if (type === "percentage") return "Percentage discount";
  if (type === "fixed") return "Fixed dollar discount";
  return "Store credit";
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

// Discount can never exceed the subtotal, so the discounted subtotal (and total) never goes below $0.
export function computePromoDiscount(subtotal: number, discountType: PromoDiscountType, discountValue: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  const value = Math.max(0, Number(discountValue) || 0);
  const raw = discountType === "percentage" ? subtotal * (value / 100) : value;
  return round2(Math.min(subtotal, Math.max(0, raw)));
}

export type PromoValidationInput = {
  active?: boolean | null;
  expires_at?: string | null;
  minimum_subtotal?: number | null;
  max_uses?: number | null;
  used_count?: number | null;
};

export type PromoValidationResult = { ok: true } | { ok: false; error: string };

// Validates one promo record against the current subtotal. Used identically on the
// customer validate route and again (authoritatively) when the order is placed.
export function validatePromo(promo: PromoValidationInput | null | undefined, subtotal: number, now: number = Date.now()): PromoValidationResult {
  if (!promo) return { ok: false, error: "Invalid promo code." };
  if (!promo.active) return { ok: false, error: "This promo code is not active." };
  if (promo.expires_at) {
    const expires = new Date(promo.expires_at).getTime();
    if (Number.isFinite(expires) && expires < now) return { ok: false, error: "This promo code has expired." };
  }
  if (promo.max_uses != null && (promo.used_count ?? 0) >= promo.max_uses) {
    return { ok: false, error: "This promo code has reached its usage limit." };
  }
  if (promo.minimum_subtotal != null && promo.minimum_subtotal > 0 && subtotal < promo.minimum_subtotal) {
    return { ok: false, error: `This code requires a minimum order of $${promo.minimum_subtotal.toFixed(2)} before tax.` };
  }
  return { ok: true };
}
