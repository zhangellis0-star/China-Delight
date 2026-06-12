import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { menuItems } from "@/data/menu";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { getSpecialOffers, saveSpecialOffers } from "@/lib/special-offers";
import { isOfferType, isValidPercent } from "@/lib/offer-logic";
import type { OfferType, SpecialOffer } from "@/lib/offer-logic";

export const dynamic = "force-dynamic";

const menuIds = new Set(menuItems.map((item) => item.id));

function authorized() {
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

type OfferBody = {
  id?: string;
  title?: string;
  description?: string | null;
  type?: string;
  active?: boolean;
  minimumSubtotal?: number | string;
  rewardItemId?: string;
  rewardQuantity?: number | string;
  percentOff?: number | string;
  requiredItemId?: string;
  secondItemId?: string;
  secondItemPercentOff?: number | string;
};

function makeId(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return `${slug || "offer"}-${Date.now().toString(36)}`;
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const offers = await getSpecialOffers();
  // Lunch items are already excluded from menuItems while lunch is paused, so they never appear here.
  const menuOptions = menuItems.map((item) => ({ id: item.id, number: item.number, name: item.name, label: `#${item.number} ${item.name}` }));
  return NextResponse.json({ specialOffers: offers, menuOptions });
}

// Create a new offer, or update an existing one when an id is supplied.
export async function POST(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as OfferBody;

  const title = (body.title ?? "").trim();
  if (!title) return bad("A title is required.");

  const type: OfferType = isOfferType(body.type) ? body.type : "free_item";

  const minimumSubtotal = Number(body.minimumSubtotal ?? 0);
  if (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0) return bad("Enter a minimum order amount of 0 or more.");

  const offers = await getSpecialOffers();
  const existing = body.id ? offers.find((offer) => offer.id === body.id) : null;
  if (body.id && !existing) return NextResponse.json({ error: "Special offer not found." }, { status: 404 });

  const base = {
    id: existing?.id ?? makeId(title),
    title,
    description: (body.description ?? "").toString().trim() || null,
    type,
    active: body.active ?? existing?.active ?? true,
    minimumSubtotal: Number(minimumSubtotal.toFixed(2))
  };

  let next: SpecialOffer;
  if (type === "free_item") {
    const rewardItemId = (body.rewardItemId ?? "").trim();
    if (!menuIds.has(rewardItemId)) return bad("Choose a valid reward menu item.");
    const rewardQuantity = Math.round(Number(body.rewardQuantity));
    if (!Number.isFinite(rewardQuantity) || rewardQuantity < 1) return bad("Reward quantity must be 1 or more.");
    next = { ...base, rewardItemId, rewardQuantity };
  } else if (type === "percent_off_order") {
    if (!isValidPercent(body.percentOff)) return bad("Percentage off must be greater than 0 and at most 100.");
    next = { ...base, percentOff: Number(Number(body.percentOff).toFixed(2)) };
  } else if (type === "bogo") {
    const requiredItemId = (body.requiredItemId ?? "").trim();
    if (!menuIds.has(requiredItemId)) return bad("Choose a valid 'buy' item.");
    const secondItemId = (body.secondItemId ?? "").trim();
    const freeItemId = menuIds.has(secondItemId) ? secondItemId : requiredItemId;
    next = { ...base, requiredItemId, secondItemId: freeItemId };
  } else {
    // buy_one_get_second_percent
    const requiredItemId = (body.requiredItemId ?? "").trim();
    if (!menuIds.has(requiredItemId)) return bad("Choose a valid 'buy' item.");
    if (!isValidPercent(body.secondItemPercentOff)) return bad("Second-item percentage off must be greater than 0 and at most 100.");
    const secondItemId = (body.secondItemId ?? "").trim();
    const discountItemId = menuIds.has(secondItemId) ? secondItemId : requiredItemId;
    next = { ...base, requiredItemId, secondItemId: discountItemId, secondItemPercentOff: Number(Number(body.secondItemPercentOff).toFixed(2)) };
  }

  const updated = existing ? offers.map((offer) => (offer.id === existing.id ? next : offer)) : [...offers, next];
  const saved = await saveSpecialOffers(updated);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  // If normalization dropped the offer (e.g. invalid config slipped through), surface it.
  if (!(saved.offers ?? []).some((offer) => offer.id === next.id)) {
    return bad("That offer could not be saved. Please check the selected items and values.");
  }
  return NextResponse.json({ specialOffers: saved.offers ?? updated });
}

// Quick enable/disable toggle.
export async function PATCH(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { id?: string; active?: boolean };
  if (!body.id) return bad("Missing offer id.");
  if (typeof body.active !== "boolean") return bad("Missing active flag.");

  const offers = await getSpecialOffers();
  if (!offers.some((offer) => offer.id === body.id)) return NextResponse.json({ error: "Special offer not found." }, { status: 404 });
  const updated = offers.map((offer) => (offer.id === body.id ? { ...offer, active: body.active as boolean } : offer));
  const saved = await saveSpecialOffers(updated);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ specialOffers: saved.offers ?? updated });
}

export async function DELETE(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return bad("Missing offer id.");

  const offers = await getSpecialOffers();
  const updated = offers.filter((offer) => offer.id !== id);
  const saved = await saveSpecialOffers(updated);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ specialOffers: saved.offers ?? updated });
}
