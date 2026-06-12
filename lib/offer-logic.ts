// Pure special-offer logic shared by the customer checkout (preview) and the server (authoritative).
// NO database or environment access here, so it can be imported on the client safely. The server
// store lives in lib/special-offers.ts and re-uses these helpers.
import { menuItems } from "@/data/menu";
import type { CartCustomization, CartItem } from "@/types";

const menuById = new Map(menuItems.map((item) => [item.id, item]));

export type OfferType = "free_item" | "percent_off_order" | "bogo" | "buy_one_get_second_percent";

export const OFFER_TYPES: OfferType[] = ["free_item", "percent_off_order", "bogo", "buy_one_get_second_percent"];

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  free_item: "Free reward item",
  percent_off_order: "Percentage off order",
  bogo: "Buy one, get one free",
  buy_one_get_second_percent: "Buy one, get second % off"
};

export type SpecialOffer = {
  id: string;
  title: string;
  description?: string | null;
  type: OfferType;
  active: boolean;
  minimumSubtotal: number;
  // free_item
  rewardItemId?: string | null;
  rewardQuantity?: number;
  // percent_off_order
  percentOff?: number;
  // bogo + buy_one_get_second_percent
  requiredItemId?: string | null;
  secondItemId?: string | null;
  secondItemPercentOff?: number;
};

// Customer-facing projection: same fields plus resolved item names (so the client never needs
// to look anything up). Nothing here is sensitive, so it is safe to expose publicly.
export type PublicSpecialOffer = {
  id: string;
  title: string;
  description?: string | null;
  type: OfferType;
  active: boolean;
  minimumSubtotal: number;
  rewardItemId?: string | null;
  rewardItemName?: string | null;
  rewardQuantity?: number;
  percentOff?: number;
  requiredItemId?: string | null;
  requiredItemName?: string | null;
  secondItemId?: string | null;
  secondItemName?: string | null;
  secondItemPercentOff?: number;
};

export type OfferCartLine = { menuItemId: string; unitPrice: number; quantity: number };

function round2(value: number) {
  return Number(value.toFixed(2));
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function isValidPercent(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 100;
}

function clampPercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function isOfferType(value: unknown): value is OfferType {
  return typeof value === "string" && (OFFER_TYPES as string[]).includes(value);
}

export function menuItemExists(itemId?: string | null) {
  return Boolean(itemId && menuById.has(itemId));
}

export function itemNameById(itemId?: string | null) {
  if (!itemId) return null;
  return menuById.get(itemId)?.name ?? null;
}

// Normalize one stored offer. Missing `type` defaults to "free_item" for backward compatibility
// with offers saved before this upgrade. Returns null when the offer's required items/values are
// missing or no longer on the menu (e.g. a paused lunch reward), so broken offers are simply not
// served and get dropped on the next save.
export function normalizeOffer(value: Partial<SpecialOffer> | null | undefined): SpecialOffer | null {
  if (!value || typeof value.id !== "string" || !value.id) return null;
  const type: OfferType = isOfferType(value.type) ? value.type : "free_item";
  const base = {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : "Special offer",
    description: typeof value.description === "string" ? value.description : null,
    type,
    active: value.active !== false,
    minimumSubtotal: Math.max(0, Number(value.minimumSubtotal) || 0)
  };

  if (type === "free_item") {
    const rewardItemId = typeof value.rewardItemId === "string" ? value.rewardItemId : "";
    if (!menuById.has(rewardItemId)) return null;
    return { ...base, rewardItemId, rewardQuantity: Math.max(1, Math.round(Number(value.rewardQuantity) || 1)) };
  }
  if (type === "percent_off_order") {
    if (!isValidPercent(value.percentOff)) return null;
    return { ...base, percentOff: round2(clampPercent(value.percentOff)) };
  }
  if (type === "bogo") {
    const requiredItemId = typeof value.requiredItemId === "string" ? value.requiredItemId : "";
    if (!menuById.has(requiredItemId)) return null;
    const secondItemId = typeof value.secondItemId === "string" && menuById.has(value.secondItemId) ? value.secondItemId : requiredItemId;
    return { ...base, requiredItemId, secondItemId };
  }
  // buy_one_get_second_percent
  const requiredItemId = typeof value.requiredItemId === "string" ? value.requiredItemId : "";
  if (!menuById.has(requiredItemId)) return null;
  if (!isValidPercent(value.secondItemPercentOff)) return null;
  const secondItemId = typeof value.secondItemId === "string" && menuById.has(value.secondItemId) ? value.secondItemId : requiredItemId;
  return { ...base, requiredItemId, secondItemId, secondItemPercentOff: round2(clampPercent(value.secondItemPercentOff)) };
}

export function normalizeSpecialOffers(value: unknown): SpecialOffer[] {
  const list = Array.isArray((value as { offers?: unknown })?.offers) ? (value as { offers: unknown[] }).offers : [];
  return list.map((entry) => normalizeOffer(entry as Partial<SpecialOffer>)).filter((offer): offer is SpecialOffer => offer !== null);
}

export function toPublicOffer(offer: SpecialOffer): PublicSpecialOffer {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description ?? null,
    type: offer.type,
    active: offer.active,
    minimumSubtotal: offer.minimumSubtotal,
    rewardItemId: offer.rewardItemId ?? null,
    rewardItemName: itemNameById(offer.rewardItemId),
    rewardQuantity: offer.rewardQuantity,
    percentOff: offer.percentOff,
    requiredItemId: offer.requiredItemId ?? null,
    requiredItemName: itemNameById(offer.requiredItemId),
    secondItemId: offer.secondItemId ?? null,
    secondItemName: itemNameById(offer.secondItemId),
    secondItemPercentOff: offer.secondItemPercentOff
  };
}

function cartQty(items: OfferCartLine[], itemId?: string | null) {
  if (!itemId) return 0;
  return items.filter((item) => item.menuItemId === itemId).reduce((sum, item) => sum + item.quantity, 0);
}

function cartUnitPrice(items: OfferCartLine[], itemId?: string | null) {
  const line = items.find((item) => item.menuItemId === itemId);
  return line ? line.unitPrice : 0;
}

export type OfferComputation = {
  applied: boolean;
  reason: string;
  discount: number;
  freeItems: Array<{ itemId: string; quantity: number }>;
};

// Decide whether an offer applies to a cart and what it grants. Pure and deterministic so the
// client preview and the server-authoritative checkout always agree on the discount/free items.
// `items` is the paid cart (free reward lines are NOT included). `subtotal` is the paid subtotal.
export function computeOffer(offer: SpecialOffer | PublicSpecialOffer, items: OfferCartLine[], subtotal: number): OfferComputation {
  const none = (reason: string): OfferComputation => ({ applied: false, reason, discount: 0, freeItems: [] });
  if (!offer.active) return none("This offer is not active.");
  if (offer.minimumSubtotal > 0 && subtotal < offer.minimumSubtotal) {
    return none(`Spend ${money(offer.minimumSubtotal)} (before tax) to unlock this offer.`);
  }

  switch (offer.type) {
    case "free_item": {
      if (!menuItemExists(offer.rewardItemId)) return none("Reward item is unavailable.");
      return { applied: true, reason: "", discount: 0, freeItems: [{ itemId: offer.rewardItemId as string, quantity: Math.max(1, offer.rewardQuantity ?? 1) }] };
    }
    case "percent_off_order": {
      if (!isValidPercent(offer.percentOff)) return none("This offer is misconfigured.");
      const discount = round2((subtotal * (offer.percentOff as number)) / 100);
      return discount > 0 ? { applied: true, reason: "", discount, freeItems: [] } : none("Add items to unlock this discount.");
    }
    case "bogo": {
      const buyId = offer.requiredItemId;
      const freeId = offer.secondItemId || offer.requiredItemId;
      if (!menuItemExists(buyId) || !menuItemExists(freeId)) return none("This offer is misconfigured.");
      if (cartQty(items, buyId) < 1) return none(`Add ${itemNameById(buyId) ?? "the qualifying item"} to unlock this offer.`);
      return { applied: true, reason: "", discount: 0, freeItems: [{ itemId: freeId as string, quantity: 1 }] };
    }
    case "buy_one_get_second_percent": {
      const buyId = offer.requiredItemId;
      const secondId = offer.secondItemId || offer.requiredItemId;
      if (!menuItemExists(buyId) || !menuItemExists(secondId) || !isValidPercent(offer.secondItemPercentOff)) return none("This offer is misconfigured.");
      const sameItem = buyId === secondId;
      const enough = sameItem ? cartQty(items, buyId) >= 2 : cartQty(items, buyId) >= 1 && cartQty(items, secondId) >= 1;
      if (!enough) {
        return none(sameItem ? `Add 2 ${itemNameById(buyId) ?? "items"} to unlock this offer.` : `Add ${itemNameById(buyId)} and ${itemNameById(secondId)} to unlock this offer.`);
      }
      const discount = round2((cartUnitPrice(items, secondId) * (offer.secondItemPercentOff as number)) / 100);
      return discount > 0 ? { applied: true, reason: "", discount, freeItems: [] } : none("Add the discounted item to your cart.");
    }
    default:
      return none("Unknown offer type.");
  }
}

// Materialize a free-reward ref into a $0 cart line. The server appends these to the order items
// so the kitchen ticket and admin/customer order detail show the free item.
export function buildFreeLine(itemId: string, quantity: number, offer: { id: string; title: string }): CartItem | null {
  const menuItem = menuById.get(itemId);
  if (!menuItem) return null;
  const customization: CartCustomization = { size: "order", specialOffer: true, specialOfferTitle: offer.title };
  return {
    cartId: `offer-${offer.id}-${itemId}`,
    menuItemId: menuItem.id,
    number: menuItem.number,
    name: menuItem.name,
    category: menuItem.category,
    quantity: Math.max(1, quantity),
    unitPrice: 0,
    customization
  };
}

// Short human summary used by the admin list and the customer showcase.
export function offerSummary(offer: SpecialOffer | PublicSpecialOffer): string {
  const rewardName = ("rewardItemName" in offer && offer.rewardItemName) || itemNameById(offer.rewardItemId) || "item";
  const requiredName = ("requiredItemName" in offer && offer.requiredItemName) || itemNameById(offer.requiredItemId) || "item";
  const secondName = ("secondItemName" in offer && offer.secondItemName) || itemNameById(offer.secondItemId) || requiredName;
  const min = offer.minimumSubtotal > 0 ? `Spend ${money(offer.minimumSubtotal)}, ` : "";
  switch (offer.type) {
    case "free_item": {
      const qty = (offer.rewardQuantity ?? 1) > 1 ? `${offer.rewardQuantity} ` : "";
      return `${min}get ${qty}free ${rewardName}.`;
    }
    case "percent_off_order":
      return `${min}get ${offer.percentOff}% off your order.`;
    case "bogo":
      return `Buy one ${requiredName}, get one ${secondName} free.`;
    case "buy_one_get_second_percent":
      return `Buy one ${requiredName}, get a second ${secondName} ${offer.secondItemPercentOff}% off.`;
    default:
      return offer.title;
  }
}
