import { menuItems } from "@/data/menu";
import { customerFieldLimits, maxItemNotesLength } from "@/lib/checkout-limits";
import { comboIncludedItems, isComboItem, isLunchItem } from "@/lib/order-rules";
import { customizationUpcharge, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import { addonPrices } from "@/lib/restaurant";
import type { CartCustomization, CartItem, LunchRiceChoice, LunchSideChoice, MenuPriceKey } from "@/types";

const menuById = new Map(menuItems.map((item) => [item.id, item]));
const maxQuantityPerItem = 50;
const maxItemsPerOrder = 100;

export function customerFieldError(customer: { name?: unknown; phone?: unknown; email?: unknown; notes?: unknown }) {
  const tooLong = (value: unknown, limit: number) => typeof value === "string" && value.trim().length > limit;
  if (tooLong(customer.name, customerFieldLimits.name)) return `Name is limited to ${customerFieldLimits.name} characters.`;
  if (tooLong(customer.phone, customerFieldLimits.phone)) return "Please enter a valid phone number.";
  if (tooLong(customer.email, customerFieldLimits.email)) return "Please enter a valid email address.";
  if (tooLong(customer.notes, customerFieldLimits.notes)) return `Order notes are limited to ${customerFieldLimits.notes} characters.`;
  if ([customer.name, customer.phone, customer.email].some((value) => typeof value !== "string")) return "Missing customer information or cart items.";
  if (customer.notes !== undefined && customer.notes !== null && typeof customer.notes !== "string") return "Please re-enter your order notes.";
  return null;
}

// The same choices the menu card offers (components/menu/menu-item-card.tsx).
const spiceLevels = ["None", "Mild", "Medium", "Hot", "Extra Hot"] as const;
const lunchRiceChoices: LunchRiceChoice[] = ["Pork Fried Rice", "White Rice"];
const lunchSideChoices: LunchSideChoice[] = ["Egg Roll", "Wonton Soup", "Egg Drop Soup", "Canned Soda"];

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

// Reprice every cart line from the server-side menu so the browser cannot tamper with
// prices, names, or categories. Returns sanitized items whose identity fields and
// unit_price come only from data/menu.ts (plus known add-on upcharges).
//
// The customization is rebuilt from the choices the menu offers rather than copied, because
// everything in it prints on the kitchen ticket. A size the item does not have used to be charged
// at the item's default (cheapest) price while the ticket still showed the requested size, and
// free text such as a combo's "includes" line reached the kitchen unchecked.
export function priceCheckoutItems(rawItems: CartItem[]): { ok: true; items: CartItem[] } | { ok: false; error: string } {
  if (rawItems.length > maxItemsPerOrder) {
    return { ok: false, error: "That order has too many lines. Please call the restaurant for large orders." };
  }

  const priced: CartItem[] = [];
  for (const raw of rawItems) {
    const menuItem = menuById.get(String(raw?.menuItemId ?? ""));
    if (!menuItem) {
      return { ok: false, error: "An item in your cart is no longer on the menu. Please remove it and try again." };
    }
    const quantity = Number(raw?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantityPerItem) {
      return { ok: false, error: `Invalid quantity for ${menuItem.name}.` };
    }

    const submitted = (raw?.customization ?? {}) as Partial<Record<keyof CartCustomization, unknown>>;
    const size = submitted.size as MenuPriceKey;
    if (typeof size !== "string" || !Object.prototype.hasOwnProperty.call(menuItem.prices, size) || menuItem.prices[size] === undefined) {
      return { ok: false, error: `Please choose a size for ${menuItem.name} again.` };
    }
    if (hasReviewPrice(menuItem, size)) {
      return { ok: false, error: `${menuItem.name} cannot be ordered online right now. Please call the restaurant.` };
    }

    const customization: CartCustomization = { size };
    if (submitted.spiceLevel !== undefined && menuItem.category !== "Appetizers") {
      if (!oneOf(submitted.spiceLevel, spiceLevels)) return { ok: false, error: `Please choose a spice level for ${menuItem.name} again.` };
      customization.spiceLevel = submitted.spiceLevel;
    }
    if (isLunchItem(menuItem)) {
      if (submitted.lunchRice !== undefined) {
        if (!oneOf(submitted.lunchRice, lunchRiceChoices)) return { ok: false, error: `Please choose the rice for ${menuItem.name} again.` };
        customization.lunchRice = submitted.lunchRice;
      }
      if (submitted.lunchSide !== undefined) {
        if (!oneOf(submitted.lunchSide, lunchSideChoices)) return { ok: false, error: `Please choose the side for ${menuItem.name} again.` };
        customization.lunchSide = submitted.lunchSide;
      }
    }
    // What a combo includes is fixed by the restaurant, never by the browser.
    if (isComboItem(menuItem) || size === "combo") customization.includedItems = comboIncludedItems;
    for (const flag of ["sauceOnSide", "noOnion", "noBroccoli"] as const) {
      if (submitted[flag] === true) customization[flag] = true;
    }
    if (submitted.notes !== undefined) {
      if (typeof submitted.notes !== "string") return { ok: false, error: `Please re-enter the instructions for ${menuItem.name}.` };
      const notes = submitted.notes.trim();
      if (notes.length > maxItemNotesLength) {
        return { ok: false, error: `Instructions for ${menuItem.name} are limited to ${maxItemNotesLength} characters.` };
      }
      if (notes) customization.notes = notes;
    }
    const addOns = Array.isArray(submitted.addOns)
      ? submitted.addOns.filter((name): name is keyof typeof addonPrices => typeof name === "string" && name in addonPrices)
      : [];
    if (addOns.length) customization.addOns = addOns;

    const unitPrice = Number((getItemPrice(menuItem, size) + customizationUpcharge(addOns)).toFixed(2));

    priced.push({
      cartId: String(raw?.cartId ?? `${menuItem.id}-${priced.length}`),
      menuItemId: menuItem.id,
      number: menuItem.number,
      name: menuItem.name,
      category: menuItem.category,
      quantity,
      unitPrice,
      customization
    });
  }
  return { ok: true, items: priced };
}
