import { NextResponse } from "next/server";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { closedOrderingMessage, isLunchAvailable, isLunchItem, lunchAvailabilityMessage, nextOpeningLabel, validateScheduledPickupISO } from "@/lib/order-rules";
import { getOperationalSettings, orderingAllowed } from "@/lib/operations";
import { calculateCart } from "@/lib/pricing";
import { computePromoDiscount, normalizePromoCode, validatePromo } from "@/lib/promo";
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
    promoCode?: string | null;
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
  const hasLunchItem = body.items.some((item) => isLunchItem(item));
  const operationalSettings = await getOperationalSettings();
  const allowAfterOnlineCutoff = operationalSettings.orderingOverride.mode === "open";
  if (body.customer.pickupTimeType === "scheduled" && !body.customer.scheduledPickupTime) {
    return NextResponse.json({ error: "Please choose a scheduled pickup time." }, { status: 400 });
  }
  if (body.customer.pickupTimeType === "scheduled") {
    const scheduleError = validateScheduledPickupISO(body.customer.scheduledPickupTime ?? "", { hasLunchItem, allowAfterOnlineCutoff });
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
  }
  if (!orderingAllowed(operationalSettings)) {
    return NextResponse.json({ error: `${closedOrderingMessage} ${nextOpeningLabel()}` }, { status: 400 });
  }
  const soldOutItem = body.items.find((item) => operationalSettings.soldOutItemIds.includes(item.menuItemId));
  if (soldOutItem) {
    return NextResponse.json({ error: `${soldOutItem.name} is sold out today.` }, { status: 400 });
  }
  if (hasLunchItem && body.customer.pickupTimeType !== "scheduled" && !isLunchAvailable()) {
    return NextResponse.json({ error: lunchAvailabilityMessage }, { status: 400 });
  }

  const orderNumber = createOrderNumber();
  let supabaseSaved = false;
  let supabaseErrorMessage: string | null = null;
  const supabaseEnv = getSupabaseEnvStatus();

  const supabase = getSupabaseAdmin();

  if (supabase) {
    // Recompute the subtotal from the items and validate any promo code server-side, so the
    // discount and final totals are authoritative and cannot be tampered with by the client.
    const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tip = Math.max(0, Number(body.totals?.tip ?? 0));
    let promoCode: string | null = null;
    let discountAmount = 0;
    let promoRecord: { id: string; used_count: number; discount_type: "percentage" | "fixed" | "credit"; discount_value: number } | null = null;

    if (body.promoCode) {
      const code = normalizePromoCode(body.promoCode);
      const { data: promo } = await supabase.from("promo_codes").select("*").eq("code", code).maybeSingle();
      const validation = validatePromo(promo, subtotal);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error, promoInvalid: true }, { status: 400 });
      }
      promoRecord = promo;
      promoCode = code;
      discountAmount = computePromoDiscount(subtotal, promo.discount_type, promo.discount_value);
    }

    const finalTotals = calculateCart(body.items, tip, discountAmount);

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
        subtotal: finalTotals.subtotal,
        tax: finalTotals.tax,
        processing_fee: finalTotals.processingFee,
        tip_amount: finalTotals.tip,
        promo_code: promoCode,
        discount_amount: finalTotals.discount,
        total: finalTotals.total
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
        // Count the promo use only once the order and its items are safely saved.
        if (promoRecord) {
          const { error: usageError } = await supabase
            .from("promo_codes")
            .update({ used_count: (promoRecord.used_count ?? 0) + 1, updated_at: new Date().toISOString() })
            .eq("id", promoRecord.id);
          if (usageError) {
            console.error("[checkout] Promo used_count increment failed", { orderNumber, code: promoCode, error: toSupabaseErrorLog(usageError) });
          }
        }
        const emailResult = await sendOrderConfirmationEmail({
          order_number: orderNumber,
          customer_name: body.customer.name,
          customer_email: body.customer.email,
          customer_phone: body.customer.phone,
          payment_method: paymentMethod,
          payment_status: "unpaid",
          pickup_time_type: body.customer.pickupTimeType,
          scheduled_pickup_time: body.customer.scheduledPickupTime || null,
          subtotal: finalTotals.subtotal,
          tax: finalTotals.tax,
          processing_fee: finalTotals.processingFee,
          tip_amount: finalTotals.tip,
          promo_code: promoCode,
          discount_amount: finalTotals.discount,
          total: finalTotals.total,
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
