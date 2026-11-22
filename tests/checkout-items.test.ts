import assert from "node:assert/strict";
import test from "node:test";
import { menuItems } from "@/data/menu";
import { customerFieldError, priceCheckoutItems } from "@/lib/checkout-items";
import { comboIncludedItems } from "@/lib/order-rules";
import { getItemPrice, hasReviewPrice } from "@/lib/pricing";
import type { CartItem, MenuPriceKey } from "@/types";

const sizes = (item: (typeof menuItems)[number]) => (Object.keys(item.prices) as MenuPriceKey[]).filter((key) => item.prices[key] !== undefined && !hasReviewPrice(item, key));
const twoSize = menuItems.find((item) => item.category !== "Appetizers" && sizes(item).length >= 2)!;
const appetizer = menuItems.find((item) => item.category === "Appetizers" && sizes(item).length >= 1)!;
const combo = menuItems.find((item) => item.category === "Special Combination Platters" && sizes(item).length >= 1)!;
const lunch = menuItems.find((item) => item.category === "Lunch Special" && sizes(item).length >= 1);

function line(item: (typeof menuItems)[number], customization: Record<string, unknown>): CartItem {
  return { cartId: "x", menuItemId: item.id, number: "0", name: "tampered", category: item.category, quantity: 1, unitPrice: 0.01, customization: customization as CartItem["customization"] };
}

test("a real order from the menu card is accepted and priced from the menu", () => {
  const [small, large] = sizes(twoSize);
  const result = priceCheckoutItems([line(twoSize, { size: large, spiceLevel: "Hot", notes: " no peanuts " })]);
  assert.ok(result.ok);
  assert.equal(result.items[0].unitPrice, getItemPrice(twoSize, large));
  assert.notEqual(getItemPrice(twoSize, large), getItemPrice(twoSize, small));
  assert.deepEqual(result.items[0].customization, { size: large, spiceLevel: "Hot", notes: "no peanuts" });
  assert.equal(result.items[0].name, twoSize.name);
});

test("a size the item does not have is refused instead of charged at the cheapest price", () => {
  const [, large] = sizes(twoSize);
  for (const size of [large.toUpperCase(), "galaxy", "", undefined, "toString", "__proto__"]) {
    assert.equal(priceCheckoutItems([line(twoSize, { size })]).ok, false, String(size));
  }
});

test("only the menu's own choices reach the kitchen ticket", () => {
  assert.equal(priceCheckoutItems([line(twoSize, { size: sizes(twoSize)[0], spiceLevel: "Volcanic" })]).ok, false);
  // Lunch specials can be switched off in data/menu.ts; then no lunch item is orderable at all.
  if (lunch) {
    assert.equal(priceCheckoutItems([line(lunch, { size: sizes(lunch)[0], lunchRice: "Lobster Rice" })]).ok, false);
    assert.equal(priceCheckoutItems([line(lunch, { size: sizes(lunch)[0], lunchSide: "Free Entree" })]).ok, false);
    assert.equal(priceCheckoutItems([line(lunch, { size: sizes(lunch)[0], lunchRice: "White Rice", lunchSide: "Egg Roll" })]).ok, true);
  }
  assert.equal(priceCheckoutItems([line(twoSize, { size: sizes(twoSize)[0], notes: "x".repeat(301) })]).ok, false);

  const cleaned = priceCheckoutItems([
    line(combo, { size: sizes(combo)[0], includedItems: ["10 Egg Rolls"], specialOffer: true, extraChargeAmount: -5, rice: "Fried Rice" }),
    line(appetizer, { size: sizes(appetizer)[0], spiceLevel: "Extra Hot", lunchSide: "Egg Roll" })
  ]);
  assert.ok(cleaned.ok);
  assert.deepEqual(cleaned.items[0].customization, { size: sizes(combo)[0], includedItems: comboIncludedItems });
  assert.deepEqual(cleaned.items[1].customization, { size: sizes(appetizer)[0] });
});

test("customer details have length limits", () => {
  const ok = { name: "Jane", phone: "860-555-0100", email: "jane@example.invalid", notes: "" };
  assert.equal(customerFieldError(ok), null);
  assert.match(customerFieldError({ ...ok, name: "x".repeat(81) }) ?? "", /Name/);
  assert.match(customerFieldError({ ...ok, notes: "x".repeat(501) }) ?? "", /notes/);
  assert.notEqual(customerFieldError({ ...ok, phone: "1".repeat(31) }), null);
  assert.notEqual(customerFieldError({ ...ok, name: { first: "Jane" } }), null);
});
