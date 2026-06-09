import { NextResponse } from "next/server";
import { computePromoDiscount, normalizePromoCode, validatePromo } from "@/lib/promo";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// Customer-facing: validates a code against a subtotal and returns only the public
// discount info (no id, used_count, or max_uses). The order route re-validates on submit.
export async function POST(request: Request) {
  const body = (await request.json()) as { code?: string; subtotal?: number };
  const code = normalizePromoCode(body.code ?? "");
  const subtotal = Math.max(0, Number(body.subtotal) || 0);

  if (!code) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Promo codes are temporarily unavailable. Please try again later." }, { status: 503 });
  }

  const { data: promo } = await supabase.from("promo_codes").select("*").eq("code", code).maybeSingle();
  const validation = validatePromo(promo, subtotal);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const discountAmount = computePromoDiscount(subtotal, promo.discount_type, promo.discount_value);

  return NextResponse.json({
    ok: true,
    promo: {
      code: promo.code,
      description: promo.description ?? null,
      discountType: promo.discount_type,
      discountValue: Number(promo.discount_value),
      discountAmount
    }
  });
}
