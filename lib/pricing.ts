import { addonPrices, restaurant } from "@/lib/restaurant";
import type { CartItem, MenuItem, MenuPrice, MenuPriceKey } from "@/types";

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatMenuPrice(value: MenuPrice | undefined) {
  return value === "NEEDS_REVIEW" ? "NEEDS REVIEW" : formatPrice(value ?? 0);
}

export function defaultSize(item: MenuItem): MenuPriceKey {
  const preferred: MenuPriceKey[] = ["order", "pint", "quart", "combo", "large", "small"];
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

export function calculateCart(items: CartItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = subtotal * restaurant.taxRate;
  return {
    subtotal,
    tax,
    total: subtotal + tax
  };
}
