import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderStatus } from "@/types";

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

  const body = (await request.json()) as { orderNumber: string; status: OrderStatus };
  if (!body.orderNumber || !body.status) return NextResponse.json({ error: "Missing order number or status." }, { status: 400 });

  const { error } = await supabase.from("orders").update({ status: body.status, updated_at: new Date().toISOString() }).eq("order_number", body.orderNumber);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
