// Special offers (e.g. "spend $50, get a free crab rangoon"). These are persisted in the
// generic key/value `operational_settings` table under the `special_offers` key, so adding
// this feature needs NO database schema change. Offers reward a free menu item ($0 line),
// which keeps order totals clean and can never push a total negative.
import { menuItems } from "@/data/menu";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { CartCustomization, CartItem } from "@/types";

const settingsKey = "special_offers";
const menuById = new Map(menuItems.map((item) => [item.id, item]));

export type SpecialOffer = {
  id: string;
  title: string;
  description?: string | null;
  // Only "free_item" is supported today; the field keeps the door open for future types.
  type: "free_item";
  minimumSubtotal: number;
  rewardItemId: string;
  rewardQuantity: number;
  active: boolean;
};

// What customers receive (no admin-only churn). Safe to expose publicly.
export type PublicSpecialOffer = {
  id: string;
  title: string;
  description?: string | null;
  minimumSubtotal: number;
  rewardItemId: string;
  rewardItemName: string;
  rewardQuantity: number;
};

// Shipped out-of-the-box until the admin saves their own list. The very first save (even an
// empty list) writes the row, after which this default no longer applies.
export function defaultSpecialOffers(): SpecialOffer[] {
  return [
    {
      id: "free-crab-rangoon-over-50",
      title: "Free Crab Rangoon on orders over $50",
      description: "Spend $50 or more (before tax) and add one free order of crab rangoon.",
      type: "free_item",
      minimumSubtotal: 50,
      rewardItemId: "crab-rangoon",
      rewardQuantity: 1,
      active: true
    }
  ];
}

function normalizeOffer(value: Partial<SpecialOffer> | null | undefined): SpecialOffer | null {
  if (!value || typeof value.id !== "string" || !value.id) return null;
  const rewardItemId = typeof value.rewardItemId === "string" ? value.rewardItemId : "";
  if (!menuById.has(rewardItemId)) return null;
  return {
    id: value.id,
    title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : "Special offer",
    description: typeof value.description === "string" ? value.description : null,
    type: "free_item",
    minimumSubtotal: Math.max(0, Number(value.minimumSubtotal) || 0),
    rewardItemId,
    rewardQuantity: Math.max(1, Math.round(Number(value.rewardQuantity) || 1)),
    active: value.active !== false
  };
}

export function normalizeSpecialOffers(value: unknown): SpecialOffer[] {
  const list = Array.isArray((value as { offers?: unknown })?.offers) ? (value as { offers: unknown[] }).offers : [];
  return list.map((entry) => normalizeOffer(entry as Partial<SpecialOffer>)).filter((offer): offer is SpecialOffer => offer !== null);
}

export function rewardItemName(rewardItemId: string) {
  return menuById.get(rewardItemId)?.name ?? "Free item";
}

export function toPublicOffer(offer: SpecialOffer): PublicSpecialOffer {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description ?? null,
    minimumSubtotal: offer.minimumSubtotal,
    rewardItemId: offer.rewardItemId,
    rewardItemName: rewardItemName(offer.rewardItemId),
    rewardQuantity: offer.rewardQuantity
  };
}

// An offer is usable when it is active and the (paid) subtotal meets its minimum.
export function isOfferEligible(offer: SpecialOffer, subtotal: number) {
  return offer.active && Number.isFinite(subtotal) && subtotal >= offer.minimumSubtotal;
}

// Build the $0 reward line that gets appended to the order's items server-side.
export function buildFreeOfferItem(offer: SpecialOffer): CartItem | null {
  const menuItem = menuById.get(offer.rewardItemId);
  if (!menuItem) return null;
  const customization: CartCustomization = {
    size: "order",
    specialOffer: true,
    specialOfferTitle: offer.title
  };
  return {
    cartId: `offer-${offer.id}`,
    menuItemId: menuItem.id,
    number: menuItem.number,
    name: menuItem.name,
    category: menuItem.category,
    quantity: offer.rewardQuantity,
    unitPrice: 0,
    customization
  };
}

export async function getSpecialOffers(): Promise<SpecialOffer[]> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return defaultSpecialOffers();
  const { data, error } = await supabase.from("operational_settings").select("value").eq("key", settingsKey).maybeSingle();
  if (error) {
    console.error("[special-offers] Failed to load offers", { message: error.message, code: error.code });
    return defaultSpecialOffers();
  }
  // No row yet -> ship the starter offer. Once a row exists (even empty), respect it.
  if (!data) return defaultSpecialOffers();
  return normalizeSpecialOffers(data.value);
}

// All active offers, sanitized for the public checkout. The client decides which are
// currently unlocked by comparing the live subtotal against each offer's minimum.
export async function getActivePublicOffers(): Promise<PublicSpecialOffer[]> {
  const offers = await getSpecialOffers();
  return offers.filter((offer) => offer.active).map(toPublicOffer);
}

export async function saveSpecialOffers(offers: SpecialOffer[]): Promise<{ error: string | null; offers?: SpecialOffer[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "Supabase is not configured." };
  const normalized = offers.map((offer) => normalizeOffer(offer)).filter((offer): offer is SpecialOffer => offer !== null);
  const { error } = await supabase
    .from("operational_settings")
    .upsert({ key: settingsKey, value: { offers: normalized }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[special-offers] Failed to save offers", { message: error.message, code: error.code });
    return { error: error.message };
  }
  return { error: null, offers: normalized };
}
