import { addonPrices, restaurant } from "@/lib/restaurant";
import type { CartItem, MenuItem, MenuPrice, MenuPriceKey } from "@/types";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatMenuPrice(value: MenuPrice | undefined) {
  return value === "NEEDS_REVIEW" ? "NEEDS REVIEW" : formatPrice(value ?? 0);
}

export function defaultSize(item: MenuItem): MenuPriceKey {
  const preferred: MenuPriceKey[] = ["small", "pint", "order", "combo", "quart", "large"];
  return preferred.find((key) => item.prices[key] !== undefined) ?? "order";
}

export function getItemPrice(item: MenuItem, size: MenuPriceKey) {
  const price = item.prices[size] ?? item.prices[defaultSize(item)] ?? 0;
  return price === "NEEDS_REVIEW" ? 0 : price;
}

export function hasReviewPrice(item: MenuItem, size: MenuPriceKey) {
  return (item.prices[size] ?? item.prices[defaultSize(item)]) === "NEEDS_REVIEW";
}

export function customizationUpcharge(addOns: string[] = []) {
  return addOns.reduce((sum, name) => sum + (addonPrices[name as keyof typeof addonPrices] ?? 0), 0);
}

// discountAmount is a pre-computed promo discount in dollars (see lib/promo.ts).
// It is applied to the subtotal before tax and processing fee, and the discount can
// never exceed the subtotal, so the total never drops below $0.
export function calculateCart(items: CartItem[], tip = 0, discountAmount = 0) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discount = Math.min(subtotal, Math.max(0, discountAmount));
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const tax = discountedSubtotal * restaurant.taxRate;
  const processingFee = discountedSubtotal * restaurant.processingFeeRate;
  const safeTip = Math.max(0, tip);
  return {
    subtotal,
    discount,
    tax,
    processingFee,
    tip: safeTip,
    total: Math.max(0, discountedSubtotal + tax + processingFee + safeTip)
  };
}

// China Delight does not take payment online; customers pay at the restaurant, in cash or by
// card. Card Price is the existing total (already includes tax + the card processing fee).
// Cash Price re-derives from the same post-discount merchandise subtotal: 5% off before tax,
// tax recomputed on that discounted amount, plus tip — no processing fee, since that cost is
// never charged to cash customers. This is the single source of truth for both prices; every
// display surface (checkout, confirmation, email, receipt, admin) calls this instead of
// re-deriving the discount or tax itself.
export const CASH_DISCOUNT_RATE = 0.05;

export type CashDiscountPricingInput = {
  subtotal: number;
  discount?: number | null;
  tax: number;
  tip?: number | null;
  total: number;
};

export type CashDiscountPricing = {
  cardSubtotal: number;
  cardTax: number;
  cardTotal: number;
  cashSubtotal: number;
  cashTax: number;
  cashTotal: number;
};

export function calculateCashDiscountPricing(input: CashDiscountPricingInput): CashDiscountPricing {
  const cardSubtotal = Math.max(0, input.subtotal - Number(input.discount ?? 0));
  const tip = Number(input.tip ?? 0);
  const cashSubtotal = Number((cardSubtotal * (1 - CASH_DISCOUNT_RATE)).toFixed(2));
  const cashTax = Number((cashSubtotal * restaurant.taxRate).toFixed(2));
  const cashTotal = Number((cashSubtotal + cashTax + tip).toFixed(2));
  return {
    cardSubtotal,
    cardTax: input.tax,
    cardTotal: input.total,
    cashSubtotal,
    cashTax,
    cashTotal
  };
}
