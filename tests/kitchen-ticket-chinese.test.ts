import assert from "node:assert/strict";
import test from "node:test";
import { menuItems } from "@/data/menu";
import { escposTicket, type PrintOrder } from "@/lib/kitchen-ticket";
import { rasterizeChineseLine } from "@/lib/cjk-render";

const cjkPattern = /[一-鿿]/;

function baseOrder(overrides: Partial<PrintOrder> = {}): PrintOrder {
  return {
    order_number: "CD-000001-ABC",
    customer_name: "Jane Doe",
    customer_phone: "555-123-4567",
    customer_notes: null,
    payment_method: "pay_at_pickup",
    payment_status: "unpaid",
    pickup_time_type: "asap",
    scheduled_pickup_time: null,
    estimated_ready_at: null,
    created_at: "2026-08-31T18:00:00.000Z",
    status: "new",
    subtotal: 14.7,
    tax: 1.08,
    processing_fee: 0.88,
    tip_amount: 0,
    promo_code: null,
    discount_amount: 0,
    total: 16.66,
    order_items: [],
    ...overrides
  };
}

// GS v 0 (raster bit image) header bytes, as emitted by lib/escpos.ts rasterImageCommand.
const RASTER_HEADER = Buffer.from([0x1d, 0x76, 0x30, 0x00]);

function findRasterOffsets(buffer: Buffer): number[] {
  const offsets: number[] = [];
  let from = 0;
  while (true) {
    const index = buffer.indexOf(RASTER_HEADER, from);
    if (index === -1) break;
    offsets.push(index);
    from = index + 1;
  }
  return offsets;
}

// The ticket buffer mixes binary ESC/POS control bytes with plain ASCII text lines. latin1
// round-trips every byte 1:1 (unlike utf8, which would mangle raw control/image bytes), so
// indexOf on the decoded string reliably finds ASCII substrings at their real byte offset.
function toSearchableString(buffer: Buffer): string {
  return buffer.toString("latin1");
}

test("every menu item has a non-empty Simplified Chinese name", () => {
  assert.ok(menuItems.length > 0, "menuItems should not be empty");
  const missing: string[] = [];
  for (const item of menuItems) {
    if (!item.chineseName || !cjkPattern.test(item.chineseName)) {
      missing.push(`${item.id} (#${item.number} ${item.name})`);
    }
  }
  assert.deepEqual(missing, [], `menu items missing a Chinese name: ${missing.join(", ")}`);
});

test("rasterizeChineseLine produces a non-empty raster image for a real translation", () => {
  const buffer = rasterizeChineseLine("左宗鸡");
  assert.ok(buffer, "expected a raster image buffer");
  assert.ok(buffer!.length > RASTER_HEADER.length, "raster buffer should contain image data, not just the header");
  assert.deepEqual(buffer!.subarray(0, 4), RASTER_HEADER);
});

test("rasterizeChineseLine falls back safely (returns null) when the name is missing", () => {
  assert.equal(rasterizeChineseLine(undefined), null);
  assert.equal(rasterizeChineseLine(null), null);
  assert.equal(rasterizeChineseLine(""), null);
  assert.equal(rasterizeChineseLine("   "), null);
});

test("kitchen ticket prints the Chinese name directly above the English item title", () => {
  const menuItem = menuItems.find((item) => item.id === "general-tsos-chicken");
  assert.ok(menuItem, "fixture depends on the general-tsos-chicken menu item existing");
  assert.ok(menuItem!.chineseName, "fixture item must have a chineseName");

  const order = baseOrder({
    order_items: [
      {
        menu_item_id: "general-tsos-chicken",
        item_number: menuItem!.number,
        item_name: menuItem!.name,
        quantity: 1,
        unit_price: 14.7,
        customization: { size: "order" }
      }
    ]
  });

  const buffer = escposTicket(order);
  const rasterOffsets = findRasterOffsets(buffer);
  assert.equal(rasterOffsets.length, 1, "expected exactly one rasterized Chinese line for the one item");

  const asText = toSearchableString(buffer);
  const englishTitleOffset = asText.indexOf("General tso's chicken");
  assert.ok(englishTitleOffset !== -1, "expected the sentence-cased English item title to be present");
  assert.ok(rasterOffsets[0] < englishTitleOffset, "the Chinese raster image must be printed before (above) the English title");
});

test("an item whose menu_item_id is unknown falls back to English-only, no raster block, no crash", () => {
  const order = baseOrder({
    order_items: [
      {
        menu_item_id: "not-a-real-menu-item-id",
        item_number: "99",
        item_name: "Hand-typed admin item",
        quantity: 1,
        unit_price: 5,
        customization: { size: "order" }
      }
    ]
  });

  const buffer = escposTicket(order);
  assert.equal(findRasterOffsets(buffer).length, 0, "no menu match means no Chinese name means no raster image");
  const asText = toSearchableString(buffer);
  assert.ok(asText.includes("Hand-typed admin item"), "the English name should still print normally");
});

test("an item with no menu_item_id at all (legacy order) falls back to English-only", () => {
  const order = baseOrder({
    order_items: [
      { menu_item_id: null, item_number: "1", item_name: "Egg Roll", quantity: 2, unit_price: 2.45, customization: { size: "order" } }
    ]
  });
  const buffer = escposTicket(order);
  assert.equal(findRasterOffsets(buffer).length, 0);
  assert.ok(toSearchableString(buffer).includes("Egg roll"));
});

test("non-item receipt text (headers, labels, totals) is unaffected by the Chinese-name feature", () => {
  const order = baseOrder({
    customer_notes: "PLEASE RING THE BELL",
    order_items: [
      { menu_item_id: "general-tsos-chicken", item_number: "135", item_name: "General Tso's Chicken", quantity: 1, unit_price: 14.7, customization: { size: "order" } }
    ]
  });
  const buffer = escposTicket(order);
  const asText = toSearchableString(buffer);

  // Fixed structural labels stay exactly as before — never sentence-cased, never rasterized.
  for (const label of ["CHINA DELIGHT", "KITCHEN TICKET", "PICKUP: ASAP", "PAYMENT: PAY AT PICKUP", "NAME: Jane Doe", "PHONE: 555-123-4567", "CUSTOMER NOTES:", "CASH PRICE (5%)", "CARD PRICE"]) {
      assert.ok(asText.includes(label), `expected unchanged receipt text "${label}" to still be present verbatim`);
    }

  // Only one raster image on the ticket (the single item's Chinese name) — headers/labels never
  // get a Chinese line of their own.
  assert.equal(findRasterOffsets(buffer).length, 1);
});
