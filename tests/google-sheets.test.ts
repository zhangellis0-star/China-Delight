// Sheet sync against an in-memory spreadsheet. Google calls go to a stand-in that throws on any
// other host, so nothing leaves the machine. "server-only" (a Next.js marker that refuses to load
// outside the server bundle) is swapped for an empty module.
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import Module from "node:module";
import { after, before, beforeEach, test } from "node:test";

const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const resolveFilename = loader._resolveFilename;
const emptyModule = require.resolve("next/dist/compiled/server-only/empty.js");
loader._resolveFilename = (request, ...rest) => (request === "server-only" ? emptyModule : resolveFilename(request, ...rest));

const realFetch = globalThis.fetch;
const env = { ...process.env };
const oldHeaders = ["Created Date/Time", "Order Number", "Customer Name", "Customer Phone", "Customer Email", "Status", ...Array.from({ length: 19 }, (_, i) => `Col ${i + 7}`)];
let grid: string[][] = [];
let sheets: typeof import("@/lib/google-sheets");

function columnIndex(letters: string) {
  return [...letters].reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function parseRange(range: string) {
  const match = /^'Orders'!([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/.exec(range);
  if (!match) throw new Error(`Unexpected range ${range}`);
  const [, c1, r1, c2, r2] = match;
  return { col1: columnIndex(c1), row1: r1 ? Number(r1) - 1 : 0, col2: columnIndex(c2 ?? c1), row2: r2 ? Number(r2) - 1 : r1 && !c2 ? Number(r1) - 1 : Infinity };
}

function write(range: string, values: string[][]) {
  const { col1, row1 } = parseRange(range);
  values.forEach((row, r) => row.forEach((value, c) => {
    grid[row1 + r] ??= [];
    grid[row1 + r][col1 + c] = String(value);
  }));
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

before(async () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "fixture-sheet";
  process.env.GOOGLE_SHEETS_ORDERS_SHEET_NAME = "Orders";
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "fixture@example.invalid";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "oauth2.googleapis.com") return json({ access_token: "fixture-token" });
    if (url.hostname !== "sheets.googleapis.com") throw new Error(`Unexpected network call to ${url.hostname}`);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname.endsWith("/values:batchUpdate")) {
      for (const entry of body.data) write(entry.range, entry.values);
      return json({});
    }
    const range = decodeURIComponent(url.pathname.split("/values/")[1]);
    if (range.endsWith(":append")) {
      grid.push(body.values[0].map(String));
      return json({});
    }
    if (method === "PUT") {
      write(range, body.values);
      return json({});
    }
    const { col1, row1, col2, row2 } = parseRange(range);
    const values = grid.slice(row1, row2 === Infinity ? undefined : row2 + 1).map((row) => row.slice(col1, col2 + 1));
    return json({ values });
  }) as typeof fetch;
  sheets = await import("@/lib/google-sheets");
});

after(() => {
  loader._resolveFilename = resolveFilename;
  globalThis.fetch = realFetch;
  process.env = env;
});

beforeEach(() => {
  grid = [
    [...oldHeaders],
    ["11/20/2026, 5:00:00 PM", "CD-260", "Monday Customer", "", "", "new"],
    ["11/22/2026, 1:00:00 PM", "CD-260", "Sunday Customer", "", "", "new"]
  ];
});

test("an older sheet gets an Order ID header, and new rows carry the order's id", async () => {
  const result = await sheets.appendOrderToGoogleSheets({
    orderId: "id-new",
    orderNumber: "CD-261",
    createdAt: new Date("2026-11-22T18:30:00Z"),
    customer: { name: "New Customer", phone: "1", email: "n@example.invalid", fulfillment: "pickup", paymentMethod: "pay_at_pickup", pickupTimeType: "asap" },
    status: "new",
    paymentMethod: "pay_at_pickup",
    paymentStatus: "unpaid",
    totals: { subtotal: 10, discount: 0, tax: 0.6, processingFee: 0.6, tip: 0, total: 11.2 },
    items: []
  });
  assert.equal(result.synced, true);
  assert.equal(grid[0][25], "Order ID");
  assert.equal(grid[0][24], "Col 25", "existing headers are left alone");
  assert.equal(grid[3][1], "CD-261");
  assert.equal(grid[3][25], "id-new");
});

test("a status update finds its row by id, even when an older day's row shares the number", async () => {
  grid[0][25] = "Order ID";
  grid[1][25] = "id-monday";
  grid[2][25] = "id-sunday";
  // Monday's order was scheduled ahead; updating it must not touch Sunday's row with the same number.
  const result = await sheets.updateOrderStatusInGoogleSheets({ orderId: "id-monday", orderNumber: "CD-260", createdAt: new Date("2026-11-22T12:00:00Z"), newStatus: "picked_up" });
  assert.equal(result.found, true);
  assert.equal(grid[1][5], "picked_up");
  assert.equal(grid[2][5], "new");
});

test("rows written before the id column fall back to number plus order date", async () => {
  const result = await sheets.updateOrderStatusInGoogleSheets({ orderId: "id-monday", orderNumber: "CD-260", createdAt: new Date("2026-11-20T22:00:00Z"), newStatus: "accepted" });
  assert.equal(result.found, true);
  assert.equal(grid[1][5], "accepted");
  assert.equal(grid[2][5], "new");
});

test("no matching row means nothing is changed", async () => {
  const before = JSON.stringify(grid.map((row) => row.slice(0, 25)));
  const result = await sheets.updateOrderStatusInGoogleSheets({ orderId: "id-unknown", orderNumber: "CD-260", createdAt: new Date("2026-11-15T17:00:00Z"), newStatus: "picked_up" });
  assert.equal(result.found, false);
  assert.equal(JSON.stringify(grid.map((row) => row.slice(0, 25))), before);
});
