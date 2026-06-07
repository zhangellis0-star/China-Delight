import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { customizationText } from "@/lib/order-display";
import { closedOrderingMessage, isLunchAvailable, isLunchItem, isRestaurantOpen, lunchAvailabilityMessage, nextOpeningLabel } from "@/lib/order-rules";
import { getStripe } from "@/lib/stripe-server";
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
  if (body.customer.pickupTimeType === "scheduled" && !body.customer.scheduledPickupTime) {
    return NextResponse.json({ error: "Please choose a scheduled pickup time." }, { status: 400 });
  }
  if (!isRestaurantOpen()) {
    return NextResponse.json({ error: `${closedOrderingMessage} ${nextOpeningLabel()}` }, { status: 400 });
  }
  if (body.items.some((item) => isLunchItem(item)) && !isLunchAvailable()) {
    return NextResponse.json({ error: lunchAvailabilityMessage }, { status: 400 });
  }

  const orderNumber = createOrderNumber();
  let supabaseSaved = false;
  let supabaseErrorMessage: string | null = null;
  let savedOrderId: string | null = null;
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
        payment_method: body.customer.paymentMethod,
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
      savedOrderId = order.id;

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
        if (body.customer.paymentMethod === "pay_at_pickup") {
          const emailResult = await sendOrderConfirmationEmail({
            order_number: orderNumber,
            customer_name: body.customer.name,
            customer_email: body.customer.email,
            customer_phone: body.customer.phone,
            payment_method: body.customer.paymentMethod,
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

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (body.customer.paymentMethod === "stripe" && stripe) {
    const successUrl = `${siteUrl}/confirmation?order=${orderNumber}`;
    const cancelUrl = `${siteUrl}/checkout`;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.customer.email || undefined,
      phone_number_collection: { enabled: true },
      client_reference_id: orderNumber,
      metadata: { orderNumber },
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        ...body.items.map((item) => ({
          quantity: item.quantity,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(item.unitPrice * 100),
            product_data: {
              name: `${item.number}. ${item.name}`,
              description: customizationText(item.customization)
            }
          }
        })),
        // Tax and processing fee as their own line items so Stripe charges the exact final total.
        ...[
          { name: "Sales tax", amount: Math.round(body.totals.tax * 100) },
          { name: "Processing fee", amount: Math.round((body.totals.processingFee ?? 0) * 100) },
          { name: "Tip", amount: Math.round((body.totals.tip ?? 0) * 100) }
        ]
          .filter((line) => line.amount > 0)
          .map((line) => ({
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: line.amount,
              product_data: { name: line.name }
            }
          }))
      ]
    });

    if (supabase && savedOrderId) {
      const { error: sessionUpdateError } = await supabase
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", savedOrderId);
      if (sessionUpdateError) {
        console.error("[checkout] Supabase stripe_session_id update failed", {
          orderNumber,
          orderId: savedOrderId,
          error: toSupabaseErrorLog(sessionUpdateError)
        });
      }
    }

    return NextResponse.json({ orderNumber, checkoutUrl: session.url, supabaseSaved, supabaseError: supabaseErrorMessage });
  }

  return NextResponse.json({ orderNumber, supabaseSaved, supabaseError: supabaseErrorMessage });
}
