import { NextResponse } from "next/server";
import { confirmedReadyTime } from "@/lib/order-rules";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(request: Request) {
  const body = (await request.json()) as { orderNumber?: string; phone?: string };
  const orderNumber = body.orderNumber?.trim();
  const phone = digitsOnly(body.phone ?? "");

  if (!orderNumber || !phone) {
    return NextResponse.json({ error: "Enter your order number and phone number." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Order lookup is temporarily unavailable. Please call the restaurant." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("orders")
    .select("order_number, customer_phone, status, payment_method, payment_status, pickup_time_type, scheduled_pickup_time, estimated_ready_minutes, estimated_ready_at, promo_code, discount_amount, total, order_items(quantity)")
    .eq("order_number", orderNumber)
    .single();

  if (error || !data || digitsOnly(data.customer_phone ?? "") !== phone) {
    return NextResponse.json({ error: "Order not found. Check the order number and phone number." }, { status: 404 });
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
  });
}
