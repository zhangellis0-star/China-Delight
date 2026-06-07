import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe-server";
import { getSupabaseAdmin, getSupabaseEnvStatus } from "@/lib/supabase-server";
import type { CartItem, CheckoutCustomer } from "@/types";

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

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customer: CheckoutCustomer;
    items: CartItem[];
    totals: { subtotal: number; tax: number; total: number };
  };

  if (!body.customer?.name || !body.customer?.phone || !body.items?.length) {
    return NextResponse.json({ error: "Missing customer information or cart items." }, { status: 400 });
  }
  if (body.customer.pickupTimeType === "scheduled" && !body.customer.scheduledPickupTime) {
    return NextResponse.json({ error: "Please choose a scheduled pickup time." }, { status: 400 });
  }

  const orderNumber = createOrderNumber();
  let supabaseSaved = false;
  let supabaseErrorMessage: string | null = null;
  let savedOrderId: string | null = null;
  const supabaseEnv = getSupabaseEnvStatus();
  console.log("[checkout] Supabase env detection", supabaseEnv);

  const supabase = getSupabaseAdmin();

  if (supabase) {
    console.log("[checkout] Supabase insert attempted", {
      orderNumber,
      itemCount: body.items.length,
      paymentMethod: body.customer.paymentMethod
    });

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_name: body.customer.name,
        customer_phone: body.customer.phone,
        customer_email: body.customer.email || null,
        fulfillment_type: body.customer.fulfillment,
        delivery_address: body.customer.address || null,
        customer_notes: body.customer.notes || null,
        payment_method: body.customer.paymentMethod,
        pickup_time_type: body.customer.pickupTimeType,
        scheduled_pickup_time: body.customer.scheduledPickupTime || null,
        status: "new",
        payment_status: "unpaid",
        subtotal: body.totals.subtotal,
        tax: body.totals.tax,
        total: body.totals.total
      })
      .select("id")
      .single();

    if (error) {
      supabaseErrorMessage = error.message;
      console.error("[checkout] Supabase orders insert failed", { orderNumber, error: toSupabaseErrorLog(error) });
    } else {
      console.log("[checkout] Supabase orders insert succeeded", {
        orderNumber,
        orderId: order.id
      });

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
        console.log("[checkout] Supabase order_items insert succeeded", {
          orderNumber,
          orderId: order.id,
          itemCount: body.items.length
        });
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
  console.log("[checkout] Stripe config detection", {
    hasStripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeSecretLength: process.env.STRIPE_SECRET_KEY?.length ?? 0,
    stripeClientCreated: Boolean(stripe),
    paymentMethod: body.customer.paymentMethod
  });
  if (body.customer.paymentMethod === "stripe" && stripe) {
    const successUrl = `${siteUrl}/confirmation?order=${orderNumber}`;
    const cancelUrl = `${siteUrl}/checkout`;
    console.log("[checkout] Stripe redirect URLs", { orderNumber, successUrl, cancelUrl });
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
              description: [
                `Size: ${item.customization.size}`,
                item.customization.rice ? `Rice: ${item.customization.rice}` : "",
                `Spice: ${item.customization.spiceLevel ?? "None"}`
              ]
                .filter(Boolean)
                .join(" | ")
            }
          }
        })),
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(body.totals.tax * 100),
            product_data: { name: "Sales tax" }
          }
        }
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

    console.log("[checkout] Stripe session created", {
      orderNumber,
      hasCheckoutUrl: Boolean(session.url)
    });

    return NextResponse.json({ orderNumber, checkoutUrl: session.url, supabaseSaved, supabaseError: supabaseErrorMessage });
  }

  console.log("[checkout] No Stripe redirect; returning order without checkoutUrl", {
    orderNumber,
    paymentMethod: body.customer.paymentMethod,
    hasCheckoutUrl: false
  });
  return NextResponse.json({ orderNumber, supabaseSaved, supabaseError: supabaseErrorMessage });
}
