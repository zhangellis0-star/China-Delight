import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { isPromoDiscountType, normalizePromoCode } from "@/lib/promo";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function authorized() {
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

type PromoBody = {
  id?: string;
  code?: string;
  description?: string | null;
  discountType?: string;
  discountValue?: number | string;
  minimumSubtotal?: number | string | null;
  expiresAt?: string | null;
  maxUses?: number | string | null;
  active?: boolean;
};

function toOptionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toOptionalInteger(value: number | string | null | undefined) {
  const parsed = toOptionalNumber(value);
  return parsed === null ? null : Math.round(parsed);
}

export async function GET() {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ promoCodes: [] });
  const { data, error } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promoCodes: data ?? [] });
}

// Create a new promo code, or update an existing one when an id is supplied.
export async function POST(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const body = (await request.json()) as PromoBody;
  const code = normalizePromoCode(body.code ?? "");
  if (!code) return NextResponse.json({ error: "A promo code is required." }, { status: 400 });
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    return NextResponse.json({ error: "Use 2-32 letters, numbers, dashes, or underscores for the code." }, { status: 400 });
  }
  if (!isPromoDiscountType(body.discountType)) {
    return NextResponse.json({ error: "Choose a valid discount type." }, { status: 400 });
  }
  const discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return NextResponse.json({ error: "Enter a discount value greater than 0." }, { status: 400 });
  }
  if (body.discountType === "percentage" && discountValue > 100) {
    return NextResponse.json({ error: "A percentage discount cannot be more than 100%." }, { status: 400 });
  }
  const minimumSubtotal = toOptionalNumber(body.minimumSubtotal);
  const maxUses = toOptionalInteger(body.maxUses);
  if (maxUses !== null && maxUses < 1) {
    return NextResponse.json({ error: "Max uses must be 1 or more (leave blank for unlimited)." }, { status: 400 });
  }
  let expiresAt: string | null = null;
  if (body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) return NextResponse.json({ error: "Enter a valid expiration date." }, { status: 400 });
    expiresAt = parsed.toISOString();
  }

  const fields = {
    code,
    description: body.description?.trim() || null,
    discount_type: body.discountType,
    discount_value: Number(discountValue.toFixed(2)),
    minimum_subtotal: minimumSubtotal,
    expires_at: expiresAt,
    max_uses: maxUses,
    active: body.active ?? true,
    updated_at: new Date().toISOString()
  };

  if (body.id) {
    const { data, error } = await supabase.from("promo_codes").update(fields).eq("id", body.id).select("*").single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Another promo code already uses that code." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ promoCode: data });
  }

  const { data, error } = await supabase.from("promo_codes").insert(fields).select("*").single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "That promo code already exists." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ promoCode: data });
}

// Enable/disable a promo code (and any other quick field toggle).
export async function PATCH(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const body = (await request.json()) as { id?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "Missing promo code id." }, { status: 400 });
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "Missing active flag." }, { status: 400 });

  const { data, error } = await supabase
    .from("promo_codes")
    .update({ active: body.active, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promoCode: data });
}

// Delete only when the code was never used, to preserve order history. Otherwise disable it instead.
export async function DELETE(request: Request) {
  if (!authorized()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing promo code id." }, { status: 400 });

  const { data: existing, error: lookupError } = await supabase.from("promo_codes").select("id, used_count").eq("id", id).single();
  if (lookupError || !existing) return NextResponse.json({ error: lookupError?.message ?? "Promo code not found." }, { status: 404 });
  if ((existing.used_count ?? 0) > 0) {
    return NextResponse.json({ error: "This code has already been used. Disable it instead of deleting to keep order history." }, { status: 409 });
  }

  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
