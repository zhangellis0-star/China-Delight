import "server-only";
import { createSign } from "crypto";
import { customizationText } from "@/lib/order-display";
import type { CartItem, CartTotals, CheckoutCustomer, OrderStatus, PaymentMethod, PaymentStatus } from "@/types";

const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
const tokenUrl = "https://oauth2.googleapis.com/token";
const sheetsApiBase = "https://sheets.googleapis.com/v4/spreadsheets";
const syncTimeoutMs = 3500;
const websiteFeeRate = 0.04;

const orderHeaders = [
  "Created Date/Time",
  "Order Number",
  "Customer Name",
  "Customer Phone",
  "Customer Email",
  "Status",
  "Payment Method",
  "Payment Status",
  "Pickup Type",
  "Scheduled Pickup Time",
  "Subtotal",
  "Discount",
  "Tax",
  "Processing Fee",
  "Tip",
  "Total",
  "4% Website Fee",
  "Promo Code",
  "Special Offer / Free Item",
  "Item Count",
  "Item Summary",
  "Customer Notes",
  "Test Order?",
  "Cancelled?",
  "Count Toward Sales?"
];

export type GoogleSheetsOrderSyncInput = {
  orderNumber: string;
  createdAt: Date;
  customer: CheckoutCustomer;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totals: CartTotals & { promoCode?: string | null };
  items: CartItem[];
  specialOfferLabel?: string | null;
};

function isEnabled() {
  const value = process.env.GOOGLE_SHEETS_ENABLED;
  return !value || !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function envConfig() {
  if (!isEnabled()) return null;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEETS_ORDERS_SHEET_NAME?.trim();
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!spreadsheetId || !sheetName || !clientEmail || !privateKey) return null;
  return { spreadsheetId, sheetName, clientEmail, privateKey };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function serviceAccountJwt(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: sheetsScope,
    aud: tokenUrl,
    exp: now + 3600,
    iat: now
  }));
  const unsigned = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function fetchWithSignal(url: string, init: RequestInit = {}, signal?: AbortSignal) {
  return fetch(url, { ...init, signal });
}

async function accessToken(clientEmail: string, privateKey: string, signal?: AbortSignal) {
  const response = await fetchWithSignal(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountJwt(clientEmail, privateKey)
    })
  }, signal);
  if (!response.ok) throw new Error(`Google auth failed with status ${response.status}.`);
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google auth response did not include an access token.");
  return data.access_token;
}

function sheetsUrl(spreadsheetId: string, range: string, suffix = "") {
  return `${sheetsApiBase}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}${suffix}`;
}

function sheetRange(sheetName: string, a1Range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${a1Range}`;
}

function easternDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function yesNo(value: boolean) {
  return value ? "yes" : "no";
}

function money(value: number) {
  return Number(value || 0).toFixed(2);
}

function itemSummary(items: CartItem[]) {
  return items
    .map((item) => {
      const details = customizationText(item.customization);
      return `${item.quantity}x #${item.number} ${item.name}${details ? ` (${details})` : ""}`;
    })
    .join("; ");
}

function specialOfferSummary(items: CartItem[], explicitLabel?: string | null) {
  const freeItems = items
    .filter((item) => item.customization.specialOffer)
    .map((item) => `${item.quantity}x #${item.number} ${item.name}`);
  const labels = [explicitLabel, ...freeItems].filter((value): value is string => Boolean(value));
  return Array.from(new Set(labels)).join("; ");
}

async function ensureHeaders(spreadsheetId: string, sheetName: string, token: string, signal?: AbortSignal) {
  const headersRange = sheetRange(sheetName, "A1:Y1");
  const current = await fetchWithSignal(sheetsUrl(spreadsheetId, headersRange), {
    headers: { Authorization: `Bearer ${token}` }
  }, signal);
  if (!current.ok) throw new Error(`Google Sheets header read failed with status ${current.status}.`);
  const data = (await current.json()) as { values?: string[][] };
  if (data.values?.[0]?.length) return;
  const response = await fetchWithSignal(sheetsUrl(spreadsheetId, headersRange, "?valueInputOption=RAW"), {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [orderHeaders] })
  }, signal);
  if (!response.ok) throw new Error(`Google Sheets header write failed with status ${response.status}.`);
}

async function appendOrder(input: GoogleSheetsOrderSyncInput, signal?: AbortSignal) {
  const config = envConfig();
  if (!config) return { synced: false, skipped: true };

  const token = await accessToken(config.clientEmail, config.privateKey, signal);
  await ensureHeaders(config.spreadsheetId, config.sheetName, token, signal);

  const isTestOrder = input.orderNumber.toUpperCase().startsWith("TEST");
  const isCancelled = input.status === "cancelled";
  const total = Number(input.totals.total || 0);
  const row = [
    easternDateTime(input.createdAt),
    input.orderNumber,
    input.customer.name,
    input.customer.phone,
    input.customer.email,
    input.status,
    input.paymentMethod,
    input.paymentStatus,
    input.customer.pickupTimeType,
    input.customer.scheduledPickupTime ?? "",
    money(input.totals.subtotal),
    money(input.totals.discount),
    money(input.totals.tax),
    money(input.totals.processingFee),
    money(input.totals.tip),
    money(total),
    money(total * websiteFeeRate),
    input.totals.promoCode ?? "",
    specialOfferSummary(input.items, input.specialOfferLabel),
    input.items.reduce((sum, item) => sum + item.quantity, 0),
    itemSummary(input.items),
    input.customer.notes ?? "",
    yesNo(isTestOrder),
    yesNo(isCancelled),
    yesNo(!isTestOrder && !isCancelled)
  ];

  const response = await fetchWithSignal(sheetsUrl(config.spreadsheetId, sheetRange(config.sheetName, "A:Y"), "?valueInputOption=RAW&insertDataOption=INSERT_ROWS"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] })
  }, signal);
  if (!response.ok) throw new Error(`Google Sheets append failed with status ${response.status}.`);
  return { synced: true, skipped: false };
}

export async function appendOrderToGoogleSheets(input: GoogleSheetsOrderSyncInput) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), syncTimeoutMs);
  try {
    return await appendOrder(input, controller.signal);
  } catch (error) {
    console.warn("[google-sheets] order sync failed", {
      orderNumber: input.orderNumber,
      error: error instanceof Error && error.name === "AbortError" ? `Timed out after ${syncTimeoutMs}ms.` : error instanceof Error ? error.message : "Unknown Google Sheets error"
    });
    return { synced: false, skipped: false, error: "Google Sheets sync failed." };
  } finally {
    clearTimeout(timeout);
  }
}
