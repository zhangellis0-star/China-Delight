import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addEasternDays, currentAutoPickupCutoff, isAutoPickupCandidate, resolveAutoPickupCutoff, type AutoPickupOrder } from "@/lib/auto-pickup";

test("Vercel cron is a resilience backup only — the real decision comes from live store hours", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/admin/auto-pickup", schedule: "0 5 * * *" }]);
});

test("addEasternDays advances the Eastern date key across a DST transition", () => {
  assert.equal(addEasternDays("2026-08-28", 1), "2026-08-29");
  assert.equal(addEasternDays("2026-03-07", 1), "2026-03-08");
  assert.equal(addEasternDays("2026-11-01", 1), "2026-11-02");
});

test("while the store is open, today is excluded from the cutoff (its orders are still in progress)", () => {
  // Friday 2026-08-28, 3:00 PM ET — well within Friday's 11am-10:30pm hours.
  assert.equal(currentAutoPickupCutoff(new Date("2026-08-28T19:00:00Z")), "2026-08-28");
});

test("the exact same clock time is 'closed' on a Mon-Thu/Sun day but still 'open' on Fri/Sat, because hours vary by day", () => {
  // Thursday 2026-08-27, 10:15 PM ET — Thursday closes at 10:00 PM, so this is after close.
  assert.equal(currentAutoPickupCutoff(new Date("2026-08-28T02:15:00Z")), "2026-08-28");
  // Friday 2026-08-28, 10:15 PM ET — Friday closes at 10:30 PM, so this is still open.
  assert.equal(currentAutoPickupCutoff(new Date("2026-08-29T02:15:00Z")), "2026-08-28");
});

test("with no requested date, resolveAutoPickupCutoff defers entirely to live store hours", () => {
  assert.equal(resolveAutoPickupCutoff(null, new Date("2026-08-28T19:00:00Z")), currentAutoPickupCutoff(new Date("2026-08-28T19:00:00Z")));
  assert.equal(resolveAutoPickupCutoff(null, new Date("2026-08-28T02:15:00Z")), currentAutoPickupCutoff(new Date("2026-08-28T02:15:00Z")));
});

test("a manually requested date closes that day and everything before it (cutoff is the day after)", () => {
  assert.equal(resolveAutoPickupCutoff("2026-07-10"), "2026-07-11");
  assert.equal(resolveAutoPickupCutoff("not-a-date", new Date("2026-07-15T05:30:00Z")), currentAutoPickupCutoff(new Date("2026-07-15T05:30:00Z")));
});

test("only active orders strictly before the cutoff are candidates", () => {
  const base: AutoPickupOrder = {
    order_number: "1001",
    status: "new",
    created_at: "2026-08-28T16:00:00Z",
    scheduled_pickup_time: null
  };
  const cutoff = "2026-08-29"; // closes out 2026-08-28 and earlier

  assert.equal(isAutoPickupCandidate(base, cutoff), true);
  assert.equal(isAutoPickupCandidate({ ...base, status: "accepted" }, cutoff), true);
  assert.equal(isAutoPickupCandidate({ ...base, status: "picked_up" }, cutoff), false);
  assert.equal(isAutoPickupCandidate({ ...base, status: "cancelled" }, cutoff), false);
  // Created on the cutoff date itself (today, still in progress) — not closed yet.
  assert.equal(isAutoPickupCandidate({ ...base, created_at: "2026-08-29T16:00:00Z" }, cutoff), false);
});

test("a cron that missed several days still closes every leftover order, not just yesterday", () => {
  // This is the actual bug fix: the old design only ever matched one exact target date, so a
  // delayed/skipped cron permanently missed anything older. The cutoff sweep catches up on an
  // arbitrarily large backlog the next time it runs.
  const cutoff = "2026-08-29";
  const threeDaysAgo: AutoPickupOrder = { order_number: "2001", status: "new", created_at: "2026-08-25T16:00:00Z", scheduled_pickup_time: null };
  const lastWeek: AutoPickupOrder = { order_number: "2002", status: "accepted", created_at: "2026-08-20T12:00:00Z", scheduled_pickup_time: null };

  assert.equal(isAutoPickupCandidate(threeDaysAgo, cutoff), true);
  assert.equal(isAutoPickupCandidate(lastWeek, cutoff), true);
});

test("future scheduled pickups stay active even once their creation date is past the cutoff", () => {
  const order: AutoPickupOrder = {
    order_number: "1002",
    status: "accepted",
    created_at: "2026-08-28T16:00:00Z",
    scheduled_pickup_time: "2026-08-29T16:00:00Z"
  };
  const cutoff = "2026-08-29";

  assert.equal(isAutoPickupCandidate(order, cutoff), false);
  assert.equal(isAutoPickupCandidate({ ...order, scheduled_pickup_time: "2026-08-28T20:00:00Z" }, cutoff), true);
});

test("before opening and at the midnight cron, an order scheduled for today stays open", () => {
  // Placed Monday 2026-11-23 7:00 PM ET for Tuesday 2026-11-24 12:00 PM ET.
  const order: AutoPickupOrder = { order_number: "CD-260", status: "new", created_at: "2026-11-24T00:00:00Z", scheduled_pickup_time: "2026-11-24T17:00:00Z" };
  // Nightly cron, Tuesday 12:00 AM ET: the store is closed, but Tuesday has not happened yet.
  assert.equal(currentAutoPickupCutoff(new Date("2026-11-24T05:00:00Z")), "2026-11-24");
  assert.equal(isAutoPickupCandidate(order, currentAutoPickupCutoff(new Date("2026-11-24T05:00:00Z"))), false);
  // Dashboard poll, Tuesday 9:00 AM ET, before the 11:00 AM opening.
  assert.equal(isAutoPickupCandidate(order, currentAutoPickupCutoff(new Date("2026-11-24T14:00:00Z"))), false);
  // Tuesday 10:15 PM ET, after the 10:00 PM close: the pickup day is over.
  assert.equal(isAutoPickupCandidate(order, currentAutoPickupCutoff(new Date("2026-11-25T03:15:00Z"))), true);
});

test("the midnight cron still closes the previous day's leftover orders", () => {
  const leftover: AutoPickupOrder = { order_number: "CD-255", status: "accepted", created_at: "2026-11-23T20:00:00Z", scheduled_pickup_time: null };
  assert.equal(isAutoPickupCandidate(leftover, currentAutoPickupCutoff(new Date("2026-11-24T05:00:00Z"))), true);
});
