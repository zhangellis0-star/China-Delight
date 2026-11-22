import { NextResponse } from "next/server";
import { confirmedReadyTime } from "@/lib/order-rules";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { orderNumber?: unknown; phone?: unknown; email?: unknown };
  const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
  const phone = digitsOnly(typeof body.phone === "string" ? body.phone : "");
  const email = normalizedEmail(body.email);

  if (!orderNumber || !phone || !email) {
    return NextResponse.json({ error: "Enter your order number, phone number, and email." }, { status: 400, headers: noStore });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Order lookup is temporarily unavailable. Please call the restaurant." }, { status: 503 });
  }

  // Order numbers are short and repeat daily, and a phone number is easy to find out, so a lookup
  // must match the number, phone and email together before anything is shown. Contact details
  // are only compared here, never returned. Most recent match wins if several share all three.
  const { data: matches, error } = await supabase
    .from("orders")
    .select("order_number, customer_phone, customer_email, status, payment_method, payment_status, pickup_time_type, scheduled_pickup_time, estimated_ready_minutes, estimated_ready_at, promo_code, discount_amount, total, created_at, order_items(quantity)")
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: false });

  const data = (matches ?? []).find((order) => digitsOnly(order.customer_phone ?? "") === phone && normalizedEmail(order.customer_email) === email);
  if (error || !data) {
    return NextResponse.json({ error: "Order not found. Check the order number, phone number, and email." }, { status: 404, headers: noStore });
  }

  return NextResponse.json({
    order: {
      orderNumber: data.order_number,
      status: data.status,
      paymentMethod: data.payment_method,
      paymentStatus: data.payment_status,
      pickupTimeType: data.pickup_time_type,
      scheduledPickupTime: data.scheduled_pickup_time,
      estimatedReady: confirmedReadyTime(data.estimated_ready_at),
      promoCode: data.promo_code,
      discountAmount: data.discount_amount,
      total: data.total
    }
  }, { headers: noStore });
}
