import assert from "node:assert/strict";
import test from "node:test";
import { chooseOrderToPrint } from "@/lib/print-order-choice";

const now = new Date("2026-11-24T18:00:00Z"); // Tuesday 1:00 PM ET
const today = { id: "today", status: "new", created_at: "2026-11-24T17:30:00Z" };
const scheduledEarlier = { id: "scheduled", status: "new", created_at: "2026-11-20T20:00:00Z" };
const pastDone = { id: "past", status: "picked_up", created_at: "2026-11-20T20:00:00Z" };
const todayDone = { ...today, status: "picked_up" };

test("the only open order with the number is printed", () => {
  assert.deepEqual(chooseOrderToPrint([today, pastDone], now), { order: today });
  assert.deepEqual(chooseOrderToPrint([pastDone, scheduledEarlier], now), { order: scheduledEarlier });
});

test("two open orders sharing a number are refused rather than guessed", () => {
  assert.deepEqual(chooseOrderToPrint([today, scheduledEarlier], now), { ambiguous: true });
});

test("reprints prefer today's order and refuse an older guess", () => {
  assert.deepEqual(chooseOrderToPrint([todayDone, pastDone], now), { order: todayDone });
  assert.deepEqual(chooseOrderToPrint([pastDone], now), { order: pastDone });
  assert.deepEqual(chooseOrderToPrint([pastDone, { ...pastDone, id: "older" }], now), { ambiguous: true });
  assert.equal(chooseOrderToPrint([], now), null);
});

test("the order the admin page asked for is printed even when the number is shared", () => {
  assert.deepEqual(chooseOrderToPrint([today, scheduledEarlier], now, "scheduled"), { order: scheduledEarlier });
  assert.deepEqual(chooseOrderToPrint([today, scheduledEarlier], now, "today"), { order: today });
  assert.deepEqual(chooseOrderToPrint([pastDone, { ...pastDone, id: "older" }], now, "older"), { order: { ...pastDone, id: "older" } });
});

test("a requested order that doesn't have the number falls back to the normal rules", () => {
  assert.deepEqual(chooseOrderToPrint([today, scheduledEarlier], now, "someone-else"), { ambiguous: true });
  assert.deepEqual(chooseOrderToPrint([today, pastDone], now, "someone-else"), { order: today });
});
