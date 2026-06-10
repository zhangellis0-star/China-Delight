import { NextResponse } from "next/server";
import { isDebugRouteAllowed } from "@/lib/debug-auth";
import { getSupabaseAdmin, getSupabaseConfig, getSupabaseEnvStatus } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function safeError(error: { message: string; details?: string; hint?: string; code?: string } | null) {
  if (!error) return null;
  return {
    message: error.message,
    details: error.details ?? null,
    hint: error.hint ?? null,
    code: error.code ?? null
  };
}

export async function GET() {
  if (!isDebugRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const config = getSupabaseConfig();
  const supabase = getSupabaseAdmin();
  const result = {
    env: getSupabaseEnvStatus(),
    urlExists: Boolean(config.url),
    serviceKeyExists: Boolean(config.serviceKey),
    hostname: config.hostname,
    canCreateClient: Boolean(supabase),
    canConnect: false,
    canQueryOrders: false,
    ordersQueryError: null as ReturnType<typeof safeError>,
    validationError: config.validationError
  };

  if (!supabase) return NextResponse.json(result);

  const { error } = await supabase.from("orders").select("id", { count: "exact", head: true });
  result.canConnect = !error;
  result.canQueryOrders = !error;
  result.ordersQueryError = safeError(error);

  return NextResponse.json(result);
}

export async function POST() {
  if (!isDebugRouteAllowed()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const config = getSupabaseConfig();
  const supabase = getSupabaseAdmin();
  const orderNumber = `DEBUG-${Date.now()}`;

  const result = {
    env: getSupabaseEnvStatus(),
    hostname: config.hostname,
    validationError: config.validationError,
    orderNumber,
    insertedOrder: false,
    insertedItem: false,
    verifiedOrder: false,
    deletedOrder: false,
    error: null as ReturnType<typeof safeError>
  };

  if (!supabase) {
    result.error = { message: config.validationError ?? "Supabase client could not be created.", details: null, hint: null, code: null };
    return NextResponse.json(result, { status: 500 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      customer_name: "Debug Supabase Test",
      customer_phone: "0000000000",
      customer_email: null,
      fulfillment_type: "pickup",
      delivery_address: null,
      customer_notes: "Temporary debug insert; should be deleted automatically.",
      payment_method: "pay_at_pickup",
      pickup_time_type: "asap",
      scheduled_pickup_time: null,
      status: "new",
      subtotal: 1,
      tax: 0,
      total: 1
    })
    .select("id")
    .single();

  if (orderError || !order) {
    result.error = safeError(orderError);
    return NextResponse.json(result, { status: 500 });
  }

  result.insertedOrder = true;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: order.id,
    menu_item_id: "debug-test-item",
    item_number: "DEBUG",
    item_name: "Debug Test Item",
    category: "Debug",
    quantity: 1,
    unit_price: 1,
    customization: { debug: true }
  });

  if (itemError) {
    result.error = safeError(itemError);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(result, { status: 500 });
  }

  result.insertedItem = true;

  const { data: verified, error: verifyError } = await supabase.from("orders").select("id, order_items(id)").eq("id", order.id).single();
  if (verifyError || !verified) {
    result.error = safeError(verifyError);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(result, { status: 500 });
  }

  result.verifiedOrder = true;

  const { error: deleteError } = await supabase.from("orders").delete().eq("id", order.id);
  result.deletedOrder = !deleteError;
  result.error = safeError(deleteError);

  return NextResponse.json(result, { status: deleteError ? 500 : 200 });
}
