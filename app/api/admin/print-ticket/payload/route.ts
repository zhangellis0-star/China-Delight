import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { printerHost, printerPort } from "@/lib/escpos";
import { escposTicket } from "@/lib/kitchen-ticket";
import type { PrintOrder } from "@/lib/kitchen-ticket";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const contentType = "application/vnd.china-delight.escpos";

function adminAuthorized() {
  return isValidAdminSession(cookies().get(getAdminCookieName())?.value);
}

async function orderNumberFromRequest(request: Request) {
  if (request.method === "GET") {
    return new URL(request.url).searchParams.get("orderNumber")?.trim() ?? "";
  }
  const body = (await request.json().catch(() => ({}))) as { orderNumber?: string };
  return body.orderNumber?.trim() ?? "";
}

async function payloadResponse(request: Request) {
  if (!adminAuthorized()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderNumber = await orderNumberFromRequest(request);
  if (!orderNumber) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  const { data: order, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_number", orderNumber)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: error?.message ?? "Order not found." }, { status: 404 });
  }

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

export async function GET(request: Request) {
  return payloadResponse(request);
}

export async function POST(request: Request) {
  return payloadResponse(request);
}
