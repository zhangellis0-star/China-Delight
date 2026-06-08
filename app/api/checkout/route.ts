import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { closedOrderingMessage, isLunchAvailable, isLunchItem, lunchAvailabilityMessage, nextOpeningLabel } from "@/lib/order-rules";
import { getOperationalSettings, orderingAllowed } from "@/lib/operations";
import { getSupabaseAdmin, getSupabaseEnvStatus } from "@/lib/supabase-server";
import type { CartItem, CartTotals, CheckoutCustomer } from "@/types";

function createOrderNumber() {
  return `CD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function toSupabaseErrorLog(error: { message: string; details?: string; hint?: string; code?: string }) {
  return {
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null
  };
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customer: CheckoutCustomer;
    items: CartItem[];
    totals: CartTotals;
  };

  if (!body.customer?.name || !body.customer?.phone || !body.customer?.email || !body.items?.length) {
    return NextResponse.json({ error: "Missing customer information or cart items." }, { status: 400 });
  }
  if (!isValidEmail(body.customer.email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (body.customer.fulfillment !== "pickup") {
    return NextResponse.json({ error: "Online orders through this website are pickup only. Please use DoorDash, Uber Eats, or Grubhub for delivery." }, { status: 400 });
  }
  const paymentMethod = "pay_at_pickup";
  if (body.customer.pickupTimeType === "scheduled" && !body.customer.scheduledPickupTime) {
    return NextResponse.json({ error: "Please choose a scheduled pickup time." }, { status: 400 });
  }
  const operationalSettings = await getOperationalSettings();
  if (!orderingAllowed(operationalSettings)) {
    return NextResponse.json({ error: `${closedOrderingMessage} ${nextOpeningLabel()}` }, { status: 400 });
  }
  const soldOutItem = body.items.find((item) => operationalSettings.soldOutItemIds.includes(item.menuItemId));
  if (soldOutItem) {
    return NextResponse.json({ error: `${soldOutItem.name} is sold out today.` }, { status: 400 });
  }
  if (body.items.some((item) => isLunchItem(item)) && !isLunchAvailable()) {
    return NextResponse.json({ error: lunchAvailabilityMessage }, { status: 400 });
  }

  const orderNumber = createOrderNumber();
  let supabaseSaved = false;
  let supabaseErrorMessage: string | null = null;
  const supabaseEnv = getSupabaseEnvStatus();

  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email || null,
        fulfillment_type: body.customer.fulfillment,
        delivery_address: null,
        customer_notes: body.customer.notes || null,
        payment_method: paymentMethod,
        pickup_time_type: body.customer.pickupTimeType,
        scheduled_pickup_time: body.customer.scheduledPickupTime || null,
        status: "new",
        payment_status: "unpaid",
        subtotal: body.totals.subtotal,
        tax: body.totals.tax,
        processing_fee: body.totals.processingFee ?? 0,
        tip_amount: body.totals.tip ?? 0,
        total: body.totals.total
      })
      .select("id")
      .single();

    if (error) {
      supabaseErrorMessage = error.message;
      console.error("[checkout] Supabase orders insert failed", { orderNumber, error: toSupabaseErrorLog(error) });
    } else {
      const { error: itemsError } = await supabase.from("order_items").insert(
        body.items.map((item) => ({
          order_id: order.id,
          menu_item_id: item.menuItemId,
          item_number: item.number,
          item_name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          customization: item.customization
        }))
      );

      if (itemsError) {
        supabaseErrorMessage = itemsError.message;
        console.error("[checkout] Supabase order_items insert failed", { orderNumber, orderId: order.id, error: toSupabaseErrorLog(itemsError) });
      } else {
        supabaseSaved = true;
        const emailResult = await sendOrderConfirmationEmail({
          order_number: orderNumber,
          customer_name: body.customer.name,
          customer_email: body.customer.email,
          customer_phone: body.customer.phone,
          payment_method: paymentMethod,
          payment_status: "unpaid",
          pickup_time_type: body.customer.pickupTimeType,
          scheduled_pickup_time: body.customer.scheduledPickupTime || null,
          subtotal: body.totals.subtotal,
          tax: body.totals.tax,
          processing_fee: body.totals.processingFee ?? 0,
          tip_amount: body.totals.tip ?? 0,
          total: body.totals.total,
          order_items: body.items.map((item) => ({
            item_number: item.number,
            item_name: item.name,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            customization: item.customization
          }))
        });
        const { error: emailUpdateError } = await supabase
          .from("orders")
          .update({
            confirmation_email_sent_at: emailResult.sent ? new Date().toISOString() : null,
            confirmation_email_error: emailResult.sent ? null : emailResult.error ?? null
          })
          .eq("id", order.id);
        if (emailUpdateError) {
          console.error("[checkout] Supabase confirmation email status update failed", {
            orderNumber,
            orderId: order.id,
            error: toSupabaseErrorLog(emailUpdateError)
          });
        }
      }
    }
  } else {
    supabaseErrorMessage = supabaseEnv.validationError ?? "Supabase env missing or invalid.";
    console.warn("[checkout] Supabase client not created; order will use browser localStorage fallback", {
      orderNumber,
      supabaseEnv
    });
  }

  if (!supabaseSaved) {
    console.warn("[checkout] Falling back to client localStorage order copy", {
      orderNumber,
      reason: supabaseErrorMessage
    });
  }

  return NextResponse.json({ orderNumber, supabaseSaved, supabaseError: supabaseErrorMessage });
}
