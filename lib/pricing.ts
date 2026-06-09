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
