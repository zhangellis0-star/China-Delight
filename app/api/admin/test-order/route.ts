import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { menuItems } from "@/data/menu";
import { getAdminCookieName, isValidAdminSession } from "@/lib/admin-auth";
import { calculateCart, defaultSize, getItemPrice } from "@/lib/pricing";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { CartCustomization } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Test orders are clearly marked so staff never confuse them with real customer orders:
//  - the order number is prefixed "TEST-"
//  - the customer name is prefixed "TEST ORDER"
//  - a marker line is added to the order notes
// They are stored in the normal tables so they print through the exact same kitchen flow.
const TEST_NAME = "TEST ORDER - Kitchen Check";
const TEST_PHONE = "(860) 555-0199";
const TEST_EMAIL = "test@chinadelightct.com";
const TEST_NOTE = "TEST ORDER - do not cook. Created from admin for printer/admin testing.";

function pick(id: string) {
  return menuItems.find((item) => item.id === id);
}

function testOrderNumber() {
  return `TEST-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export async function POST() {
  if (!isValidAdminSession(cookies().get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 400 });

  // A small, realistic spread that exercises modifiers and item notes on the ticket.
  const sources: Array<{ id: string; quantity: number; customization: CartCustomization }> = [
    { id: "combo-general-tsos-chicken", quantity: 1, customization: { size: "combo", spiceLevel: "Hot", notes: "Extra crispy please" } },
    { id: "chicken-broccoli", quantity: 2, customization: { size: "quart", spiceLevel: "Mild" } },
    { id: "crab-rangoon", quantity: 1, customization: { size: "order" } }
  ];

  const items = sources
    .map((source) => {
      const menuItem = pick(source.id) ?? menuItems[0];
      const size = source.customization.size ?? defaultSize(menuItem);
      const unitPrice = getItemPrice(menuItem, size);
      return {
        menu_item_id: menuItem.id,
        item_number: menuItem.number,
        item_name: menuItem.name,
        category: menuItem.category,
        quantity: source.quantity,
        unit_price: Number(unitPrice.toFixed(2)),
        customization: source.customization as Record<string, unknown>
      };
    })
    .filter((item) => item.unit_price > 0);

  if (!items.length) return NextResponse.json({ error: "No priced menu items available for a test order." }, { status: 500 });

  const cartItems = items.map((item) => ({
    cartId: item.menu_item_id,
    menuItemId: item.menu_item_id,
    number: item.item_number,
    name: item.item_name,
    category: item.category,
    quantity: item.quantity,
    unitPrice: item.unit_price,
    customization: item.customization as CartCustomization
  }));
  const totals = calculateCart(cartItems, 0, 0);
  const orderNumber = testOrderNumber();

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_name: TEST_NAME,
      customer_phone: TEST_PHONE,
      customer_email: TEST_EMAIL,
      fulfillment_type: "pickup",
      customer_notes: TEST_NOTE,
      payment_method: "pay_at_pickup",
      pickup_time_type: "asap",
      status: "new",
      payment_status: "unpaid",
      subtotal: totals.subtotal,
      tax: totals.tax,
      processing_fee: totals.processingFee,
      tip_amount: 0,
      discount_amount: 0,
      total: totals.total
    })
    .select("id")
    .single();

  if (error || !order) {
    console.error("[test-order] insert failed", { orderNumber, message: error?.message, code: error?.code });
    return NextResponse.json({ error: error?.message ?? "Could not create test order." }, { status: 500 });
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      item_number: item.item_number,
      item_name: item.item_name,
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customization: item.customization
    }))
  );

  if (itemsError) {
    // Clean up the orphaned header so the dashboard never shows an empty order.
    await supabase.from("orders").delete().eq("id", order.id);
    console.error("[test-order] items insert failed", { orderNumber, message: itemsError.message, code: itemsError.code });
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, orderNumber });
}
