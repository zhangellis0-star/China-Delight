import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  easternTimeParts,
  isAutoPickupCandidate,
  queryWindowForDateKey,
  resolveAutoPickupDate,
  targetBusinessDate,
  type AutoPickupOrder
} from "@/lib/auto-pickup";

test("Vercel uses one DST-safe daily cron", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.crons, [{ path: "/api/admin/auto-pickup", schedule: "0 5 * * *" }]);
});

test("05:00-05:59 UTC closes the previous day during standard time", () => {
  assert.deepEqual(easternTimeParts(new Date("2026-01-15T05:00:00Z")), {
    date: "2026-01-15",
    hour: 0,
    minute: 0
  });
  assert.equal(targetBusinessDate(new Date("2026-01-15T05:00:00Z")), "2026-01-14");
  assert.equal(targetBusinessDate(new Date("2026-01-15T05:59:59Z")), "2026-01-14");
});

test("05:00-05:59 UTC closes the previous day during daylight time", () => {
  assert.deepEqual(easternTimeParts(new Date("2026-07-15T05:00:00Z")), {
    date: "2026-07-15",
    hour: 1,
    minute: 0
  });
  assert.equal(targetBusinessDate(new Date("2026-07-15T05:00:00Z")), "2026-07-14");
  assert.equal(targetBusinessDate(new Date("2026-07-15T05:59:59Z")), "2026-07-14");
});

test("DST transition dates still close the previous business day", () => {
  assert.equal(targetBusinessDate(new Date("2026-03-08T05:59:59Z")), "2026-03-07");
  assert.equal(targetBusinessDate(new Date("2026-11-01T05:59:59Z")), "2026-10-31");
});

test("manual dates override the automatic target and invalid dates do not", () => {
  const now = new Date("2026-07-15T05:30:00Z");
  assert.equal(resolveAutoPickupDate("2026-07-10", now), "2026-07-10");
  assert.equal(resolveAutoPickupDate("July 10", now), "2026-07-14");
  assert.equal(resolveAutoPickupDate(null, now), "2026-07-14");
});

test("the database query window contains the entire New York business date", () => {
  const window = queryWindowForDateKey("2026-08-28");
  assert.ok(Date.parse(window.start) <= Date.parse("2026-08-28T04:00:00Z"));
  assert.ok(Date.parse(window.end) > Date.parse("2026-08-29T04:00:00Z"));
});

test("only active orders from the target day are candidates", () => {
  const base: AutoPickupOrder = {
    order_number: "1001",
    status: "new",
    created_at: "2026-08-28T16:00:00Z",
    scheduled_pickup_time: null
  };

  assert.equal(isAutoPickupCandidate(base, "2026-08-28"), true);
  assert.equal(isAutoPickupCandidate({ ...base, status: "accepted" }, "2026-08-28"), true);
  assert.equal(isAutoPickupCandidate({ ...base, status: "picked_up" }, "2026-08-28"), false);
  assert.equal(isAutoPickupCandidate({ ...base, status: "cancelled" }, "2026-08-28"), false);
  assert.equal(isAutoPickupCandidate({ ...base, created_at: "2026-08-29T16:00:00Z" }, "2026-08-28"), false);
});

test("future scheduled pickups stay active", () => {
  const order: AutoPickupOrder = {
    order_number: "1002",
    status: "accepted",
    created_at: "2026-08-28T16:00:00Z",
    scheduled_pickup_time: "2026-08-29T16:00:00Z"
  };

  assert.equal(isAutoPickupCandidate(order, "2026-08-28"), false);
  assert.equal(isAutoPickupCandidate({ ...order, scheduled_pickup_time: "2026-08-28T20:00:00Z" }, "2026-08-28"), true);
});
