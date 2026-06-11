import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { menuItems } from "@/data/menu";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { getSpecialOffers, saveSpecialOffers } from "@/lib/special-offers";
import type { SpecialOffer } from "@/lib/special-offers";

export const dynamic = "force-dynamic";

const menuIds = new Set(menuItems.map((item) => item.id));

function authorized() {
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

type OfferBody = {
  id?: string;
  title?: string;
  description?: string | null;
  minimumSubtotal?: number | string;
  rewardItemId?: string;
  rewardQuantity?: number | string;
  active?: boolean;
};

function makeId(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
  return `${slug || "offer"}-${Date.now().toString(36)}`;
}

export async function GET() {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const offers = await getSpecialOffers();
  return NextResponse.json({ specialOffers: offers, menuOptions: menuItems.map((item) => ({ id: item.id, label: `#${item.number} ${item.name}` })) });
}

// Create a new offer, or update an existing one when an id is supplied.
export async function POST(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as OfferBody;

  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

  const rewardItemId = (body.rewardItemId ?? "").trim();
  if (!menuIds.has(rewardItemId)) return NextResponse.json({ error: "Choose a valid reward menu item." }, { status: 400 });

  const minimumSubtotal = Number(body.minimumSubtotal);
  if (!Number.isFinite(minimumSubtotal) || minimumSubtotal < 0) {
    return NextResponse.json({ error: "Enter a minimum order amount of 0 or more." }, { status: 400 });
  }
  const rewardQuantity = Math.round(Number(body.rewardQuantity));
  if (!Number.isFinite(rewardQuantity) || rewardQuantity < 1) {
    return NextResponse.json({ error: "Reward quantity must be 1 or more." }, { status: 400 });
  }

  const offers = await getSpecialOffers();
  const existing = body.id ? offers.find((offer) => offer.id === body.id) : null;
  if (body.id && !existing) return NextResponse.json({ error: "Special offer not found." }, { status: 404 });

  const next: SpecialOffer = {
    id: existing?.id ?? makeId(title),
    title,
    description: (body.description ?? "").toString().trim() || null,
    type: "free_item",
    minimumSubtotal: Number(minimumSubtotal.toFixed(2)),
    rewardItemId,
    rewardQuantity,
    active: body.active ?? existing?.active ?? true
  };

  const updated = existing ? offers.map((offer) => (offer.id === existing.id ? next : offer)) : [...offers, next];
  const saved = await saveSpecialOffers(updated);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ specialOffers: saved.offers ?? updated });
}

// Quick enable/disable toggle.
export async function PATCH(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json()) as { id?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "Missing offer id." }, { status: 400 });
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "Missing active flag." }, { status: 400 });

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
  if (!id) return NextResponse.json({ error: "Missing offer id." }, { status: 400 });

  const offers = await getSpecialOffers();
  const updated = offers.filter((offer) => offer.id !== id);
  const saved = await saveSpecialOffers(updated);
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 500 });
  return NextResponse.json({ specialOffers: saved.offers ?? updated });
}
