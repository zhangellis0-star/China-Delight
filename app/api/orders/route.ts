import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { currentAutoPickupCutoff } from "@/lib/auto-pickup";
import { runAutoPickupSweep } from "@/lib/auto-pickup-sweep";
import { sendOrderAcceptedEmail } from "@/lib/email";
import { updateOrderStatusInGoogleSheets } from "@/lib/google-sheets";
import { isStoreOpen } from "@/lib/order-rules";
import { editableOrderStatuses } from "@/lib/order-status";
import { restaurant } from "@/lib/restaurant";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderStatus } from "@/types";

function readyDate(minutes?: number) {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

// order_number resets daily and is not globally unique (see sql/schema.sql), so a caller that
// already knows the exact row (the admin dashboard always does, from its own fetched order list)
// should target it by id. orderNumber-only lookups fall back to the most recent matching row,
// which is merely the best available guess when no id is supplied.
async function resolveOrderRow<T = Record<string, unknown>>(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  columns: string,
  { orderId, orderNumber }: { orderId?: string; orderNumber: string }
) {
  if (orderId) {
    return supabase.from("orders").select(columns).eq("id", orderId).maybeSingle() as unknown as Promise<{ data: T | null; error: { message: string } | null }>;
  }
  return supabase
    .from("orders")
    .select(columns)
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() as unknown as Promise<{ data: T | null; error: { message: string } | null }>;
}

export async function GET(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ orders: [] });

  // Live, hours-driven auto-complete: the admin dashboard polls this endpoint every 15s while
  // it's open, so checking here — only when the store's real hours (which vary by day) say it's
  // currently closed — closes out any leftover active orders automatically, right around actual
  // closing time, with no fixed clock time involved. The daily cron is just a backup for days
  // nobody has the dashboard open. Failure here never blocks the order list itself.
  if (!isStoreOpen()) {
    try {
      await runAutoPickupSweep(supabase, currentAutoPickupCutoff());
    } catch (sweepError) {
      console.warn("[orders] Live auto-pickup sweep failed", { error: sweepError instanceof Error ? sweepError.message : sweepError });
    }
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.trim();
  // Bumped from a hardcoded 500 (which silently dropped older orders from search/history once
  // the restaurant passed 500 orders all-time, even though this query is already sorted
  // newest-first) and now actually honors a caller-supplied `limit`, bounded to a sane max.
  const maxLimit = 2000;
  const requestedLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, maxLimit) : maxLimit;

  let builder = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") builder = builder.eq("status", status);

  const { data, error } = await builder.limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orders = data ?? [];
  if (!query) return NextResponse.json({ orders });

  const normalized = query.toLowerCase();
  return NextResponse.json({
    orders: orders.filter((order) => {
      const itemText = (order.order_items ?? []).map((item: { item_name?: string; item_number?: string }) => `${item.item_number ?? ""} ${item.item_name ?? ""}`).join(" ");
      return `${order.order_number} ${order.customer_name} ${order.customer_phone} ${itemText}`.toLowerCase().includes(normalized);
    })
  });
}

export async function PATCH(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const body = (await request.json()) as
    | {
        action?: "status";
        orderId?: string;
        orderNumber: string;
        status: OrderStatus;
        estimatedReadyMinutes?: number;
      }
    | {
        action: "edit";
        orderId?: string;
        orderNumber: string;
        customerName: string;
        customerPhone: string;
        customerEmail: string;
        customerNotes?: string | null;
        pickupTimeType?: "asap" | "scheduled";
        scheduledPickupTime?: string | null;
        tipAmount?: number;
        items: Array<{
          id?: string | null;
          menuItemId?: string;
          itemNumber?: string;
          itemName?: string;
          category?: string;
          quantity: number;
          unitPrice: number;
          customization?: Record<string, unknown> | null;
          extraChargeLabel?: string | null;
          extraChargeAmount?: number | null;
        }>;
      };
  if (!body.orderNumber) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

  if (body.action === "edit") {
    const round2 = (value: number) => Number(value.toFixed(2));

    // Normalize each item: clamp money to >= 0, fold the optional extra charge into the per-unit price,
    // and keep the extra-charge label/amount inside the customization JSON for display.
    const safeItems = body.items.map((item) => {
      const base = Math.max(0, Number(item.unitPrice));
      const extraCharge = Math.max(0, Number(item.extraChargeAmount ?? 0) || 0);
      const extraLabel = (item.extraChargeLabel ?? "").toString().trim();
      const effectiveUnitPrice = round2(base + extraCharge);
      const customization: Record<string, unknown> = { ...(item.customization ?? {}) };
      delete customization.extraChargeLabel;
      delete customization.extraChargeAmount;
      if (extraCharge > 0) {
        customization.extraChargeAmount = extraCharge;
        customization.extraChargeLabel = extraLabel || "Extra charge";
      }
      return {
        id: item.id ? String(item.id) : null,
        menuItemId: (item.menuItemId ?? "").toString(),
        itemNumber: (item.itemNumber ?? "").toString(),
        itemName: (item.itemName ?? "").toString(),
        category: (item.category ?? "").toString(),
        quantity: Math.round(Number(item.quantity)),
        unitPrice: effectiveUnitPrice,
        baseUnitPrice: base,
        extraCharge,
        customization
      };
    });

    if (!body.customerName?.trim() || !body.customerPhone?.trim() || !body.customerEmail?.trim()) {
      return NextResponse.json({ error: "Name, phone, and email are required." }, { status: 400 });
    }
    if (!safeItems.length) return NextResponse.json({ error: "An order must have at least one item." }, { status: 400 });
    if (safeItems.some((item) => !Number.isFinite(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ error: "Every item needs a quantity of 1 or more." }, { status: 400 });
    }
    if (safeItems.some((item) => !Number.isFinite(item.baseUnitPrice) || item.baseUnitPrice < 0)) {
      return NextResponse.json({ error: "Item prices cannot be negative." }, { status: 400 });
    }
    if (safeItems.some((item) => !Number.isFinite(item.extraCharge) || item.extraCharge < 0)) {
      return NextResponse.json({ error: "Extra charge amounts cannot be negative." }, { status: 400 });
    }
    // New items (no existing id) must carry full identity so the not-null order_items columns are satisfied.
    if (safeItems.some((item) => !item.id && (!item.menuItemId || !item.itemNumber || !item.itemName || !item.category))) {
      return NextResponse.json({ error: "A new item is missing menu information. Please re-select it." }, { status: 400 });
    }

    const subtotal = round2(safeItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    const tipAmount = round2(Math.max(0, Number(body.tipAmount ?? 0)));
    const now = new Date().toISOString();

    const { data: order, error: orderLookupError } = await resolveOrderRow<{ id: string; discount_amount: number | null; promo_code: string | null }>(
      supabase,
      "id, discount_amount, promo_code",
      body
    );
    if (orderLookupError || !order) return NextResponse.json({ error: orderLookupError?.message ?? "Order not found." }, { status: 404 });

    // Keep the original promo discount, clamped so it can never exceed the new subtotal; recompute tax/fee on the discounted subtotal.
    const discountAmount = round2(Math.min(subtotal, Math.max(0, Number(order.discount_amount ?? 0))));
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const tax = round2(discountedSubtotal * restaurant.taxRate);
    const processingFee = round2(discountedSubtotal * restaurant.processingFeeRate);
    const total = round2(Math.max(0, discountedSubtotal + tax + processingFee + tipAmount));

    const { data: existingItems, error: itemsLookupError } = await supabase.from("order_items").select("id").eq("order_id", order.id);
    if (itemsLookupError) return NextResponse.json({ error: itemsLookupError.message }, { status: 500 });
    const allowedIds = new Set((existingItems ?? []).map((item) => item.id));

    // Reject edits that reference an item id that does not belong to this order.
    if (safeItems.some((item) => item.id && !allowedIds.has(item.id))) {
      return NextResponse.json({ error: "One or more items could not be matched to this order. Please reopen the order and try again." }, { status: 400 });
    }

    // 1) Update existing items (quantity, folded unit price, and customization including any extra charge).
    const updates = safeItems.filter((item) => item.id);
    const updateResults = await Promise.all(
      updates.map((item) =>
        supabase
          .from("order_items")
          .update({ quantity: item.quantity, unit_price: item.unitPrice, customization: item.customization })
          .eq("id", item.id as string)
          .eq("order_id", order.id)
      )
    );
    const updateError = updateResults.find((result) => result.error)?.error;
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // 2) Insert brand-new items added by the admin.
    const inserts = safeItems.filter((item) => !item.id);
    if (inserts.length) {
      const { error: insertError } = await supabase.from("order_items").insert(
        inserts.map((item) => ({
          order_id: order.id,
          menu_item_id: item.menuItemId,
          item_number: item.itemNumber,
          item_name: item.itemName,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          customization: item.customization
        }))
      );
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 3) Delete items the admin removed.
    const keepIds = new Set(updates.map((item) => item.id));
    const removeIds = [...allowedIds].filter((id) => !keepIds.has(id));
    if (removeIds.length) {
      const { error: deleteError } = await supabase.from("order_items").delete().in("id", removeIds).eq("order_id", order.id);
      if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    const { error: orderUpdateError } = await supabase
      .from("orders")
      .update({
        customer_name: body.customerName.trim(),
        customer_phone: body.customerPhone.trim(),
        customer_email: body.customerEmail.trim(),
        customer_notes: body.customerNotes?.trim() || null,
        pickup_time_type: body.pickupTimeType ?? "asap",
        scheduled_pickup_time: body.pickupTimeType === "scheduled" ? body.scheduledPickupTime || null : null,
        subtotal,
        tax,
        processing_fee: processingFee,
        tip_amount: tipAmount,
        discount_amount: discountAmount,
        total,
        updated_at: now
      })
      .eq("id", order.id);
    if (orderUpdateError) return NextResponse.json({ error: orderUpdateError.message }, { status: 500 });

    const { data: updatedOrder } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", order.id)
      .single();

    return NextResponse.json({ ok: true, order: updatedOrder ?? null, totals: { subtotal, discount: discountAmount, tax, processingFee, tip: tipAmount, total } });
  }

  if (!("status" in body) || !body.status) return NextResponse.json({ error: "Missing status." }, { status: 400 });
  if (!editableOrderStatuses.includes(body.status)) return NextResponse.json({ error: "Use status new, accepted, or picked_up." }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, string | number | null> = { status: body.status, updated_at: now };

  // order_number resets daily and is not globally unique (see sql/schema.sql), so every lookup
  // and update below targets a specific row's id — resolved once here — never order_number
  // directly. Updating by order_number alone could silently modify an unrelated order from a
  // previous day (or a still-active future-scheduled order) that happens to share the same number.
  const { data: targetOrder, error: targetLookupError } = await resolveOrderRow<{ id: string; status: string | null }>(supabase, "id, status", body);
  if (targetLookupError) return NextResponse.json({ error: targetLookupError.message }, { status: 500 });
  if (!targetOrder) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const previousStatus: OrderStatus | string | null = targetOrder.status ?? null;

  const minutes = body.estimatedReadyMinutes && body.estimatedReadyMinutes > 0 ? Math.round(body.estimatedReadyMinutes) : null;
  if (body.status === "accepted") {
    update.accepted_at = now;
    if (minutes) {
      update.estimated_ready_minutes = minutes;
      update.estimated_ready_at = readyDate(minutes);
    }
  }
  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", targetOrder.id)
    .select("*, order_items(*)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await updateOrderStatusInGoogleSheets({
    orderNumber: updatedOrder.order_number,
    createdAt: updatedOrder.created_at ? new Date(updatedOrder.created_at) : undefined,
    oldStatus: previousStatus,
    newStatus: body.status,
    updatedAt: new Date(now)
  });

  let acceptedEmailSent = false;
  if (body.status === "accepted" && updatedOrder && updatedOrder.estimated_ready_at && !updatedOrder.accepted_email_sent_at) {
    const emailResult = await sendOrderAcceptedEmail(updatedOrder);
    acceptedEmailSent = emailResult.sent;
    const { error: acceptedEmailUpdateError } = await supabase
      .from("orders")
      .update({
        accepted_email_sent_at: emailResult.sent ? new Date().toISOString() : null,
        accepted_email_error: emailResult.sent ? null : emailResult.error ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", targetOrder.id);
    if (acceptedEmailUpdateError) {
      console.error("[orders] Accepted email status update failed", {
        orderNumber: body.orderNumber,
        message: acceptedEmailUpdateError.message,
        code: acceptedEmailUpdateError.code
      });
    }
  }
  return NextResponse.json({ ok: true, order: updatedOrder, acceptedEmailSent });
}
