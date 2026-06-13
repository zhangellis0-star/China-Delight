import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { escposTicket } from "@/lib/kitchen-ticket";
import type { PrintOrder } from "@/lib/kitchen-ticket";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { printerLabel, sendToPrinter } from "@/lib/escpos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { orderNumber?: string };
  const orderNumber = body.orderNumber?.trim();
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

  try {
    await sendToPrinter(escposTicket(order as PrintOrder));
    return NextResponse.json({ ok: true, printerLabel });
  } catch (printError) {
    const message = printError instanceof Error ? printError.message : "Unknown printer error";
    console.error("[print-ticket] Kitchen print failed", { orderNumber, message });
    return NextResponse.json({ error: `${printerLabel} failed: ${message}` }, { status: 502 });
  }
}
