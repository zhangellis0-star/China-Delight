import { NextResponse } from "next/server";
import { menuItems } from "@/data/menu";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { appendOrderToGoogleSheets } from "@/lib/google-sheets";
import { closedOrderingMessage, isLunchAvailable, isLunchItem, lunchAvailabilityMessage, nextOpeningLabel, validateScheduledPickupISO } from "@/lib/order-rules";
import { getOperationalSettings, orderingAllowed } from "@/lib/operations";
import { calculateCart, customizationUpcharge, getItemPrice, hasReviewPrice } from "@/lib/pricing";
import { computePromoDiscount, normalizePromoCode, validatePromo } from "@/lib/promo";
import { addonPrices, restaurant } from "@/lib/restaurant";
import { buildFreeLine, computeOffer, getSpecialOffers } from "@/lib/special-offers";
import { getSupabaseAdmin, getSupabaseEnvStatus } from "@/lib/supabase-server";
import { sendNewOrderTelegramNotification } from "@/lib/telegram";
import type { CartCustomization, CartItem, CartTotals, CheckoutCustomer } from "@/types";

const menuById = new Map(menuItems.map((item) => [item.id, item]));
const orderingUnavailableMessage = `Online ordering is temporarily unavailable. Please call China Delight at ${restaurant.phone} to place your order.`;
const maxQuantityPerItem = 50;
const maxItemsPerOrder = 100;

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

// Reprice every cart line from the server-side menu so the browser cannot tamper with
// prices, names, or categories. Returns sanitized items whose identity fields and
// unit_price come only from data/menu.ts (plus known add-on upcharges).
function priceCheckoutItems(rawItems: CartItem[]): { ok: true; items: CartItem[] } | { ok: false; error: string } {
  if (rawItems.length > maxItemsPerOrder) {
    return { ok: false, error: "That order has too many lines. Please call the restaurant for large orders." };
  }

  const priced: CartItem[] = [];
  for (const raw of rawItems) {
    const menuItem = menuById.get(String(raw?.menuItemId ?? ""));
    if (!menuItem) {
      return { ok: false, error: "An item in your cart is no longer on the menu. Please remove it and try again." };
    }
    const quantity = Number(raw?.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxQuantityPerItem) {
      return { ok: false, error: `Invalid quantity for ${menuItem.name}.` };
    }

    const customization: CartCustomization = { ...(raw?.customization ?? { size: "order" }) };
    // extraCharge fields are admin-dashboard-only; never accepted from the public checkout.
    delete customization.extraChargeLabel;
    delete customization.extraChargeAmount;
    // Special-offer markers are server-created only. A browser-submitted cart item must never be
    // able to label itself as a free reward on saved orders, receipts, or kitchen tickets.
    delete customization.specialOffer;
    delete customization.specialOfferTitle;
    if (hasReviewPrice(menuItem, customization.size)) {
      return { ok: false, error: `${menuItem.name} cannot be ordered online right now. Please call the restaurant.` };
    }
    const addOns = Array.isArray(customization.addOns)
      ? customization.addOns.filter((name): name is keyof typeof addonPrices => typeof name === "string" && name in addonPrices)
      : [];
    if (customization.addOns) customization.addOns = addOns;

    const unitPrice = Number((getItemPrice(menuItem, customization.size) + customizationUpcharge(addOns)).toFixed(2));

    priced.push({
      cartId: String(raw?.cartId ?? `${menuItem.id}-${priced.length}`),
      menuItemId: menuItem.id,
      number: menuItem.number,
      name: menuItem.name,
      category: menuItem.category,
      quantity,
      unitPrice,
      customization
    });
  }
  return { ok: true, items: priced };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customer: CheckoutCustomer;
    items: CartItem[];
    totals: CartTotals;
    promoCode?: string | null;
    specialOfferId?: string | null;
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

  const pricedResult = priceCheckoutItems(body.items);
  if (!pricedResult.ok) {
    return NextResponse.json({ error: pricedResult.error }, { status: 400 });
  }
  const items = pricedResult.items;

  const hasLunchItem = items.some((item) => isLunchItem(item));
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
  const soldOutItem = items.find((item) => operationalSettings.soldOutItemIds.includes(item.menuItemId));
  if (soldOutItem) {
    return NextResponse.json({ error: `${soldOutItem.name} is sold out today.` }, { status: 400 });
  }
  if (hasLunchItem && body.customer.pickupTimeType !== "scheduled" && !isLunchAvailable()) {
    return NextResponse.json({ error: lunchAvailabilityMessage }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error("[checkout] Supabase client not created; rejecting order", { supabaseEnv: getSupabaseEnvStatus() });
    return NextResponse.json({ error: orderingUnavailableMessage }, { status: 503 });
  }

  const orderNumber = createOrderNumber();

  // Server-authoritative totals: subtotal from the repriced items, promo validated
  // against the database, tax/fee/tip recomputed in calculateCart.
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
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

  // Special offer (max one per order). Free-reward types add $0 line items (no money impact);
  // percentage/second-item types add a discount. computeOffer is the same pure function the
  // browser used to preview the total, so the two always agree (and the client-total guard below
  // is a final safety net). The combined discount is clamped to the subtotal in calculateCart, so
  // the total can never go negative.
  let offerDiscount = 0;
  let specialOfferLabel: string | null = null;
  if (body.specialOfferId) {
    const offers = await getSpecialOffers();
    const offer = offers.find((candidate) => candidate.id === body.specialOfferId);
    if (!offer) {
      return NextResponse.json({ error: "That special offer is no longer available. Please review your order and try again." }, { status: 400 });
    }

    const result = computeOffer(offer, items, subtotal);
    if (!result.applied) {
      console.warn("[checkout] Special offer rejected", { orderNumber, specialOfferId: body.specialOfferId, reason: result.reason });
      return NextResponse.json({ error: result.reason || "That special offer is not available for this cart." }, { status: 400 });
    }

    specialOfferLabel = offer.title;
    for (const ref of result.freeItems) {
      const line = buildFreeLine(ref.itemId, ref.quantity, offer);
      if (!line) {
        return NextResponse.json({ error: "That special offer item is no longer available. Please review your order and try again." }, { status: 400 });
      }
      items.push(line);
    }
    offerDiscount = result.discount;
  }

  const finalTotals = calculateCart(items, tip, discountAmount + offerDiscount);

  // If the browser's displayed total no longer matches the server-priced total
  // (tampered cart, or a stale cart from before a menu price change), make the
  // customer refresh instead of silently charging a different amount.
  const clientTotal = Number(body.totals?.total);
  if (Number.isFinite(clientTotal) && Math.abs(clientTotal - finalTotals.total) > 0.01) {
    console.warn("[checkout] Client total mismatch; order rejected", { orderNumber: null, clientTotal, serverTotal: finalTotals.total });
    return NextResponse.json({ error: "Menu prices have been updated since you started your order. Please refresh the page, review your cart, and try again." }, { status: 409 });
  }

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
    console.error("[checkout] Supabase orders insert failed; order rejected", { orderNumber, error: toSupabaseErrorLog(error) });
    return NextResponse.json({ error: orderingUnavailableMessage }, { status: 503 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
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
    console.error("[checkout] Supabase order_items insert failed; order rejected", { orderNumber, orderId: order.id, error: toSupabaseErrorLog(itemsError) });
    // Remove the orphaned order header so the admin dashboard never shows an empty order.
    const { error: cleanupError } = await supabase.from("orders").delete().eq("id", order.id);
    if (cleanupError) {
      console.error("[checkout] Failed to clean up orphaned order", { orderNumber, orderId: order.id, error: toSupabaseErrorLog(cleanupError) });
    }
    return NextResponse.json({ error: orderingUnavailableMessage }, { status: 503 });
  }

  const savedTotals = { ...finalTotals, promoCode };
  try {
    await appendOrderToGoogleSheets({
      orderNumber,
      createdAt: new Date(),
      customer: body.customer,
      status: "new",
      paymentMethod,
      paymentStatus: "unpaid",
      totals: savedTotals,
      items,
      specialOfferLabel
    });
  } catch (sheetsError) {
    console.warn("[checkout] Google Sheets sync failed", {
      orderNumber,
      error: sheetsError instanceof Error ? sheetsError.message : "Unknown Google Sheets error"
    });
  }

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
  const telegramResult = await sendNewOrderTelegramNotification({
    orderNumber,
    customer: body.customer,
    items,
    totals: savedTotals
  });
  if (!telegramResult.sent && !telegramResult.skipped) {
    console.warn("[checkout] Telegram new-order notification failed", {
      orderNumber,
      error: telegramResult.error
    });
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
    order_items: items.map((item) => ({
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

  return NextResponse.json({ orderNumber });
}
