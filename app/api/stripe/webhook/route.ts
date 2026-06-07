import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { PaymentStatus } from "@/types";

// Stripe signature verification needs the Node runtime (crypto), not Edge.
export const runtime = "nodejs";

function resolveOrderNumber(session: Stripe.Checkout.Session) {
  return session.metadata?.orderNumber ?? session.client_reference_id ?? null;
}

async function setPaymentStatus(orderNumber: string, paymentStatus: PaymentStatus, sessionId?: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn("[stripe-webhook] Supabase not configured; cannot update payment status", { orderNumber, paymentStatus });
    return;
  }

  const update: { payment_status: PaymentStatus; updated_at: string; stripe_session_id?: string } = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString()
  };
  if (sessionId) update.stripe_session_id = sessionId;

  const { error } = await supabase.from("orders").update(update).eq("order_number", orderNumber);
  if (error) {
    console.error("[stripe-webhook] Failed to update order payment status", { orderNumber, paymentStatus, error: error.message });
    return;
  }
  console.log("[stripe-webhook] Order payment status updated", { orderNumber, paymentStatus });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.error("[stripe-webhook] Stripe is not configured (missing secret key or webhook secret).");
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature.";
    console.error("[stripe-webhook] Signature verification failed", { message });
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderNumber = resolveOrderNumber(session);
      if (orderNumber) await setPaymentStatus(orderNumber, "paid", session.id);
      else console.warn("[stripe-webhook] Completed session without an order number", { sessionId: session.id });
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderNumber = resolveOrderNumber(session);
      if (orderNumber) await setPaymentStatus(orderNumber, "failed", session.id);
      break;
    }
    default:
      console.log("[stripe-webhook] Unhandled event", { type: event.type });
  }

  return NextResponse.json({ received: true });
}
