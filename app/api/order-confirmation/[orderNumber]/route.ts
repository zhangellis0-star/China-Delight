import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function GET(_request: Request, { params }: { params: { orderNumber: string } }) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ order: null, source: "localFallback" });
  }

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, customer_name, customer_phone, customer_email, customer_notes, payment_method, pickup_time_type, scheduled_pickup_time, subtotal, tax, total, order_items(item_number, item_name, quantity, unit_price, customization)"
    )
    .eq("order_number", params.orderNumber)
    .single();

  if (error) {
    console.error("[confirmation] Supabase order lookup failed", {
      orderNumber: params.orderNumber,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return NextResponse.json({ order: null, source: "localFallback", error: error.message });
  }

  return NextResponse.json({ order: data, source: "supabase" });
}
