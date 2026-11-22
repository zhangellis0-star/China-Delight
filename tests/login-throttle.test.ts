// Wrong admin passwords are limited per address. Network calls go to an in-memory stand-in for
// the admin_login_attempts table that throws on any other host, so nothing leaves the machine.
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

const realFetch = globalThis.fetch;
const env = { ...process.env };
let rows = new Map<string, { key: string; failures: number; window_started_at: string }>();
let tableMissing = false;
let POST: (request: Request) => Promise<Response>;

before(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fixture-login-tests.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fixture-service-key";
  process.env.ADMIN_PASSWORD = "fixture-correct-password";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "fixture-login-tests.supabase.co" || url.pathname !== "/rest/v1/admin_login_attempts") {
      throw new Error(`Unexpected network call to ${url.hostname}${url.pathname}`);
    }
    if (tableMissing) return new Response(JSON.stringify({ code: "PGRST205", message: "missing" }), { status: 404, headers: { "content-type": "application/json" } });
    const method = init?.method ?? "GET";
    const key = url.searchParams.get("key")?.replace(/^eq\./, "");
    if (method === "GET") {
      const row = key ? rows.get(key) : undefined;
      return new Response(JSON.stringify(row ? [row] : []), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (method === "POST") {
      const body = JSON.parse(String(init?.body));
      for (const row of [body].flat()) rows.set(row.key, row);
      return new Response(null, { status: 201 });
    }
    if (method === "DELETE") {
      if (key) rows.delete(key);
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected ${method}`);
  }) as typeof fetch;
  ({ POST } = await import("@/app/api/admin/login/route"));
});

after(() => {
  globalThis.fetch = realFetch;
  process.env = env;
});

beforeEach(() => {
  rows = new Map();
  tableMissing = false;
});

function login(password: string, address = "203.0.113.5") {
  return POST(new Request("https://fixture.invalid/api/admin/login", { method: "POST", headers: { "x-forwarded-for": address }, body: JSON.stringify({ password }) }));
}

test("ten wrong passwords lock that address, even against the right password", async () => {
  for (let i = 0; i < 10; i += 1) assert.equal((await login("wrong")).status, 401);
  assert.equal((await login("wrong")).status, 429);
  assert.equal((await login("fixture-correct-password")).status, 429);
  assert.equal((await login("fixture-correct-password", "198.51.100.7")).status, 200, "other addresses are unaffected");
});

test("a correct password clears earlier mistakes, and addresses are stored only as hashes", async () => {
  for (let i = 0; i < 9; i += 1) await login("wrong");
  assert.ok([...rows.keys()].every((key) => /^[0-9a-f]{64}$/.test(key)));
  assert.equal((await login("fixture-correct-password")).status, 200);
  assert.equal(rows.size, 0);
  assert.equal((await login("wrong")).status, 401);
});

test("an old lockout expires after the window", async () => {
  for (let i = 0; i < 10; i += 1) await login("wrong");
  for (const row of rows.values()) row.window_started_at = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  assert.equal((await login("fixture-correct-password")).status, 200);
});

test("if the table hasn't been created yet, login still works", async () => {
  tableMissing = true;
  assert.equal((await login("wrong")).status, 401);
  assert.equal((await login("fixture-correct-password")).status, 200);
});
