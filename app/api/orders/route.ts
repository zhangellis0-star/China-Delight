import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { sendOrderReadyEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderStatus } from "@/types";

function readyDate(minutes?: number) {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ orders: [] });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const query = searchParams.get("q")?.trim();

  let builder = supabase
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });

  if (status && status !== "all") builder = builder.eq("status", status);

  const { data, error } = await builder.limit(100);
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

  const body = (await request.json()) as { orderNumber: string; status: OrderStatus; estimatedReadyMinutes?: number };
  if (!body.orderNumber || !body.status) return NextResponse.json({ error: "Missing order number or status." }, { status: 400 });

  const now = new Date().toISOString();
  const update: Record<string, string | number | null> = { status: body.status, updated_at: now };
  const minutes = body.estimatedReadyMinutes && body.estimatedReadyMinutes > 0 ? Math.round(body.estimatedReadyMinutes) : null;
  if (body.status === "accepted") {
    update.accepted_at = now;
    if (minutes) {
      update.estimated_ready_minutes = minutes;
      update.estimated_ready_at = readyDate(minutes);
    }
  }
  if (body.status === "ready") {
    update.ready_at = now;
  }

  const { data: updatedOrder, error } = await supabase
    .from("orders")
    .update(update)
    .eq("order_number", body.orderNumber)
    .select("*, order_items(item_number, item_name, quantity, unit_price, customization)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let readyEmailSent = false;
  if (body.status === "ready" && updatedOrder && !updatedOrder.ready_email_sent_at) {
    const emailResult = await sendOrderReadyEmail(updatedOrder);
    readyEmailSent = emailResult.sent;
    const { error: emailUpdateError } = await supabase
      .from("orders")
      .update({
        ready_email_sent_at: emailResult.sent ? new Date().toISOString() : null,
        ready_email_error: emailResult.sent ? null : emailResult.error ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("order_number", body.orderNumber);
    if (emailUpdateError) {
      console.error("[orders] Ready email status update failed", {
        orderNumber: body.orderNumber,
        message: emailUpdateError.message,
        code: emailUpdateError.code
      });
    }
  }
  return NextResponse.json({ ok: true, readyEmailSent });
}
