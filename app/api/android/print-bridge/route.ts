import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { printerHost, printerPort } from "@/lib/escpos";
import { escposTicket } from "@/lib/kitchen-ticket";
import type { PrintOrder } from "@/lib/kitchen-ticket";
import { customizationText } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const activeStatuses = ["new", "accepted", "preparing", "ready"];
const contentType = "application/vnd.china-delight.escpos";

type RequestBody =
  | { code?: string; action?: "orders" }
  | { code?: string; action?: "payload"; orderNumber?: string };

type BridgeOrder = PrintOrder & {
  payment_method?: string | null;
  payment_status?: string | null;
  pickup_time_type?: string | null;
  scheduled_pickup_time?: string | null;
};

function configuredCode() {
  return process.env.ANDROID_PRINT_BRIDGE_CODE?.trim() ?? "";
}

function codeMatches(value?: string) {
  const expected = configuredCode();
  const received = value?.trim() ?? "";
  if (!expected || !received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function itemSummary(order: BridgeOrder) {
  return (order.order_items ?? [])
    .map((item) => {
      const details = customizationText(item.customization ?? undefined);
      const number = item.item_number ? `#${item.item_number} ` : "";
      return `${item.quantity}x ${number}${item.item_name}${details ? ` (${details})` : ""}`;
    })
    .join("; ");
}

function pickupLabel(order: BridgeOrder) {
  if (order.pickup_time_type === "scheduled" && order.scheduled_pickup_time) {
    return formatPickupDateTime(order.scheduled_pickup_time);
  }
  return "ASAP";
}

function paymentLabel(order: BridgeOrder) {
  const method = order.payment_method === "stripe" ? "Online" : "Pay at pickup";
  return order.payment_status ? `${method} / ${order.payment_status}` : method;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  if (!configuredCode()) return NextResponse.json({ error: "ANDROID_PRINT_BRIDGE_CODE is not configured." }, { status: 503 });
  if (!codeMatches(body.code)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  if (body.action === "orders") {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, customer_phone, status, payment_method, payment_status, pickup_time_type, scheduled_pickup_time, total, created_at, order_items(item_number, item_name, quantity, customization)")
      .in("status", activeStatuses)
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const orders = ((data ?? []) as BridgeOrder[]).map((order) => ({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      status: order.status,
      payment: paymentLabel(order),
      pickupType: order.pickup_time_type ?? "asap",
      pickupTime: pickupLabel(order),
      total: Number(order.total ?? 0),
      itemSummary: itemSummary(order)
    }));

    return NextResponse.json({ success: true, orders });
  }

  if (body.action === "payload") {
    const orderNumber = body.orderNumber?.trim();
    if (!orderNumber) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

    const { data: order, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("order_number", orderNumber)
      .single();

    if (error || !order) return NextResponse.json({ error: error?.message ?? "Order not found." }, { status: 404 });

    const payload = escposTicket(order as PrintOrder);
    return NextResponse.json({
      success: true,
      orderNumber,
      printerHost,
      printerPort,
      contentType,
      escposBase64: payload.toString("base64")
    });
  }

  return NextResponse.json({ error: "Use action orders or payload." }, { status: 400 });
}
