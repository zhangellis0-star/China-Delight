import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { printerHost, printerPort } from "@/lib/escpos";
import { escposTicket } from "@/lib/kitchen-ticket";
import { chooseOrderToPrint } from "@/lib/print-order-choice";
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

  // order_number resets daily and is not globally unique (see sql/schema.sql), so more than one
  // order can match. chooseOrderToPrint refuses rather than guess.
  const { data: matches, error } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "Order lookup failed." }, { status: 500 });
  const choice = chooseOrderToPrint(matches ?? []);
  if (!choice) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if ("ambiguous" in choice) {
    return NextResponse.json({ error: `More than one order has number ${orderNumber}. Check the order on screen and write the ticket by hand.` }, { status: 409 });
  }
  const order = choice.order;

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
