// The public status lookup must only show an order when number, phone and email all match, and
// must never echo contact details back. Network calls go to an in-memory stand-in that throws on
// any other host, so nothing leaves the machine.
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

const realFetch = globalThis.fetch;
const env = { ...process.env };
let lookups = 0;
let POST: (request: Request) => Promise<Response>;

const rows = [
  { order_number: "CD-251", customer_phone: "(860) 555-0100", customer_email: "Other@Example.invalid", status: "new", total: 40, created_at: "2026-11-22T17:00:00Z", order_items: [] },
  { order_number: "CD-251", customer_phone: "860-555-0199", customer_email: "jane@example.invalid", status: "accepted", total: 12.5, created_at: "2026-11-21T17:00:00Z", order_items: [] }
];

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-status-tests.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "fixture-status-tests.supabase.co" || url.pathname !== "/rest/v1/orders") {
      throw new Error(`Unexpected network call to ${url.hostname}`);
    }
    lookups += 1;
    return new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  ({ POST } = await import("@/app/api/order-status/route"));
});

after(() => {
  globalThis.fetch = realFetch;
  process.env = env;
});

beforeEach(() => {
  lookups = 0;
});

function lookup(body: unknown) {
  return POST(new Request("https://fixture.invalid/api/order-status", { method: "POST", body: JSON.stringify(body) }));
}

test("number and phone alone are not enough", async () => {
  const response = await lookup({ orderNumber: "CD-251", phone: "8605550199" });
  assert.equal(response.status, 400);
  assert.equal(lookups, 0);
});

test("a matching phone with someone else's email shows nothing", async () => {
  const response = await lookup({ orderNumber: "CD-251", phone: "8605550199", email: "other@example.invalid" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).order, undefined);
});

test("all three matching shows that order only, without contact details", async () => {
  const response = await lookup({ orderNumber: "CD-251", phone: "860 555 0199", email: " JANE@example.invalid " });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const { order } = await response.json();
  assert.equal(order.total, 12.5);
  assert.doesNotMatch(JSON.stringify(order), /555|example\.invalid|customer/i);
});
