// The confirmation lookup must never return an order for a bare display number. Network calls go
// to an in-memory stand-in that throws on any other host, so nothing leaves the machine.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, test } from "node:test";

const realFetch = globalThis.fetch;
const env = { ...process.env };
let lookups: URL[] = [];
let GET: (request: Request, context: { params: { orderNumber: string } }) => Promise<Response>;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-confirmation-tests.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "fixture-confirmation-tests.supabase.co" || url.pathname !== "/rest/v1/orders") {
      throw new Error(`Unexpected network call to ${url.hostname}`);
    }
    lookups.push(url);
    return new Response(JSON.stringify({ order_number: "CD-251", customer_name: "Right Customer", order_items: [] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  ({ GET } = await import("@/app/api/order-confirmation/[orderNumber]/route"));
});

after(() => {
  globalThis.fetch = realFetch;
  process.env = env;
});

beforeEach(() => {
  lookups = [];
});

function confirmation(path: string) {
  const url = new URL(`https://fixture.invalid/api/order-confirmation/${path}`);
  return GET(new Request(url), { params: { orderNumber: decodeURIComponent(url.pathname.split("/").pop()!) } });
}

test("an order number alone never unlocks a confirmation", async () => {
  for (const path of ["CD-251", "CD-251?ref=", "CD-251?ref=not-a-uuid", "CD-251?ref=1%27%20or%201=1"]) {
    const response = await confirmation(path);
    assert.equal((await response.json()).order, null, path);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(lookups.length, 0, "no database read without a well-formed reference");
});

test("the lookup must match both the private reference and the number, and omits contact details", async () => {
  const ref = randomUUID();
  const response = await confirmation(`CD-251?ref=${ref}`);
  assert.equal((await response.json()).order.customer_name, "Right Customer");
  assert.equal(lookups.length, 1);
  const query = lookups[0].searchParams;
  assert.equal(query.get("id"), `eq.${ref}`);
  assert.equal(query.get("order_number"), "eq.CD-251");
  assert.doesNotMatch(query.get("select") ?? "", /customer_phone|customer_email|customer_notes/);
});
