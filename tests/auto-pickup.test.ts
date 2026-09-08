import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addEasternDays, isAutoPickupCandidate, resolveAutoPickupCutoff, type AutoPickupOrder } from "@/lib/auto-pickup";

test("Vercel uses one daily cron (Hobby plan limit — see lib/auto-pickup.ts for why exact fire time no longer matters)", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/admin/auto-pickup", schedule: "0 5 * * *" }]);
});

test("addEasternDays advances the Eastern date key across a DST transition", () => {
  assert.equal(addEasternDays("2026-08-28", 1), "2026-08-29");
  assert.equal(addEasternDays("2026-03-07", 1), "2026-03-08");
  assert.equal(addEasternDays("2026-11-01", 1), "2026-11-02");
});

test("with no requested date, the cutoff is always today (whatever time the cron actually fires)", () => {
  assert.equal(resolveAutoPickupCutoff(null, new Date("2026-08-28T05:00:00Z")), "2026-08-28");
  // Even if the platform delays the cron by hours, "today" in Eastern time is still the correct
  // cutoff — there is no fragile hour-of-day guess to get wrong anymore.
  assert.equal(resolveAutoPickupCutoff(null, new Date("2026-08-28T14:00:00Z")), "2026-08-28");
  assert.equal(resolveAutoPickupCutoff(null, new Date("2026-08-28T23:59:00Z")), "2026-08-28");
});

test("a manually requested date closes that day and everything before it (cutoff is the day after)", () => {
  assert.equal(resolveAutoPickupCutoff("2026-07-10"), "2026-07-11");
  assert.equal(resolveAutoPickupCutoff("not-a-date", new Date("2026-07-15T05:30:00Z")), "2026-07-15");
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
  // delayed/skipped cron permanently missed anything older. The new cutoff sweep catches up on
  // an arbitrarily large backlog the next time it runs.
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
