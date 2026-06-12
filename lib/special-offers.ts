// Server-side store for special offers, persisted in the generic key/value `operational_settings`
// table under the `special_offers` key (JSONB), so adding/extending offer types needs NO database
// schema change. The pure offer logic (types, normalization, computation) lives in lib/offer-logic.ts
// and is shared with the client checkout.
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizeSpecialOffers, toPublicOffer } from "@/lib/offer-logic";
import type { PublicSpecialOffer, SpecialOffer } from "@/lib/offer-logic";

// Re-export so existing importers of these from "@/lib/special-offers" keep working.
export type { SpecialOffer, PublicSpecialOffer, OfferType } from "@/lib/offer-logic";
export {
  OFFER_TYPES,
  OFFER_TYPE_LABELS,
  isOfferType,
  isValidPercent,
  normalizeOffer,
  toPublicOffer,
  computeOffer,
  buildFreeLine,
  offerSummary,
  menuItemExists,
  itemNameById
} from "@/lib/offer-logic";

const settingsKey = "special_offers";

// Shipped out-of-the-box until the admin saves their own list. The first save (even an empty list)
// writes the row, after which this default no longer applies.
export function defaultSpecialOffers(): SpecialOffer[] {
  return [
    {
      id: "free-crab-rangoon-over-50",
      title: "Free Crab Rangoon on orders over $50",
      description: "Spend $50 or more (before tax) and add one free order of crab rangoon.",
      type: "free_item",
      active: true,
      minimumSubtotal: 50,
      rewardItemId: "crab-rangoon",
      rewardQuantity: 1
    }
  ];
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

// All active offers, sanitized for the public checkout (includes resolved item names).
export async function getActivePublicOffers(): Promise<PublicSpecialOffer[]> {
  const offers = await getSpecialOffers();
  return offers.filter((offer) => offer.active).map(toPublicOffer);
}

export async function saveSpecialOffers(offers: SpecialOffer[]): Promise<{ error: string | null; offers?: SpecialOffer[] }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { error: "Supabase is not configured." };
  const normalized = normalizeSpecialOffers({ offers });
  const { error } = await supabase
    .from("operational_settings")
    .upsert({ key: settingsKey, value: { offers: normalized }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    console.error("[special-offers] Failed to save offers", { message: error.message, code: error.code });
    return { error: error.message };
  }
  return { error: null, offers: normalized };
}
