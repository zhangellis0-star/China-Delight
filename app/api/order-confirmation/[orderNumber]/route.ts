import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

// Display numbers are short, sequential, and reset daily, so a number alone must never unlock an
// order. Checkout hands the customer's browser the order's random ID, and the confirmation link
// carries it as `ref`; both must match the same row. A missing or wrong ref gets the same empty
// answer as an unknown order, so the response reveals nothing about other orders.
export async function GET(request: Request, { params }: { params: { orderNumber: string } }) {
  const ref = new URL(request.url).searchParams.get("ref") ?? "";
  if (!uuidPattern.test(ref)) return NextResponse.json({ order: null, source: "supabase" }, { headers: noStore });

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ order: null, source: "localFallback" }, { headers: noStore });
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, customer_name, payment_method, payment_status, pickup_time_type, scheduled_pickup_time, estimated_ready_minutes, estimated_ready_at, subtotal, tax, processing_fee, tip_amount, promo_code, discount_amount, total, order_items(item_number, item_name, quantity, unit_price, customization)"
    )
    .eq("id", ref)
    .eq("order_number", params.orderNumber)
    .maybeSingle();

  if (error) {
    console.error("[confirmation] Supabase order lookup failed", { code: error.code });
    return NextResponse.json({ order: null, source: "localFallback" }, { headers: noStore });
  }

  return NextResponse.json({ order: data, source: "supabase" }, { headers: noStore });
}
