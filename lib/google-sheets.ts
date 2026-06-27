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

export type GoogleSheetsStatusSyncInput = {
  orderNumber: string;
  oldStatus?: OrderStatus | string | null;
  newStatus: OrderStatus;
  updatedAt?: Date;
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

function sheetsBatchUpdateUrl(spreadsheetId: string) {
  return `${sheetsApiBase}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`;
}

function sheetRange(sheetName: string, a1Range: string) {
  return `'${sheetName.replace(/'/g, "''")}'!${a1Range}`;
}

function columnLetter(index: number) {
  let value = index + 1;
  let output = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
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
  const isCancelled = false;
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

  // Google Sheets append must be POST .../values/{range}:append — the ":append" suffix is
  // required. A plain POST to /values/{range} is not a valid method and returns 404, which is
  // why no rows were appended even though the header read/update (GET/PUT) succeeded. The
  // ":append" must sit after the encoded range but before the query string.
  const appendUrl = `${sheetsApiBase}/${encodeURIComponent(config.spreadsheetId)}/values/${encodeURIComponent(sheetRange(config.sheetName, "A:Y"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const response = await fetchWithSignal(appendUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [row] })
  }, signal);
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Google Sheets append failed with status ${response.status}${detail ? `: ${detail}` : ""}.`);
  }
  return { synced: true, skipped: false };
}

async function readValues(spreadsheetId: string, range: string, token: string, signal?: AbortSignal) {
  const response = await fetchWithSignal(sheetsUrl(spreadsheetId, range), {
    headers: { Authorization: `Bearer ${token}` }
  }, signal);
  if (!response.ok) throw new Error(`Google Sheets read failed with status ${response.status}.`);
  return (await response.json()) as { values?: string[][] };
}

function headerIndex(headers: string[], candidates: string[], fallback: number) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate.trim().toLowerCase());
    if (index >= 0) return index;
  }
  return fallback;
}

async function updateOrderStatus(input: GoogleSheetsStatusSyncInput, signal?: AbortSignal) {
  const config = envConfig();
  if (!config) return { synced: false, skipped: true, found: false };

  const token = await accessToken(config.clientEmail, config.privateKey, signal);
  await ensureHeaders(config.spreadsheetId, config.sheetName, token, signal);

  const headersData = await readValues(config.spreadsheetId, sheetRange(config.sheetName, "A1:AZ1"), token, signal);
  const headers = headersData.values?.[0] ?? orderHeaders;
  const orderNumberIndex = headerIndex(headers, ["Order Number"], orderHeaders.indexOf("Order Number"));
  const statusIndex = headerIndex(headers, ["Status"], orderHeaders.indexOf("Status"));
  const updatedAtIndex = headerIndex(headers, ["Status Updated At", "Status Updated Date/Time", "Updated At", "Updated Date/Time"], -1);

  const orderNumberColumn = columnLetter(orderNumberIndex);
  const orderNumbersData = await readValues(config.spreadsheetId, sheetRange(config.sheetName, `${orderNumberColumn}2:${orderNumberColumn}`), token, signal);
  const orderNumbers = orderNumbersData.values ?? [];
  const rowOffset = orderNumbers.findIndex((row) => String(row[0] ?? "").trim() === input.orderNumber);
  if (rowOffset < 0) return { synced: false, skipped: true, found: false, statusColumn: columnLetter(statusIndex) };

  const rowNumber = rowOffset + 2;
  const data: Array<{ range: string; values: string[][] }> = [
    {
      range: sheetRange(config.sheetName, `${columnLetter(statusIndex)}${rowNumber}`),
      values: [[input.newStatus]]
    }
  ];
  if (updatedAtIndex >= 0) {
    data.push({
      range: sheetRange(config.sheetName, `${columnLetter(updatedAtIndex)}${rowNumber}`),
      values: [[easternDateTime(input.updatedAt ?? new Date())]]
    });
  }

  const response = await fetchWithSignal(sheetsBatchUpdateUrl(config.spreadsheetId), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "RAW", data })
  }, signal);
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new Error(`Google Sheets status update failed with status ${response.status}${detail ? `: ${detail}` : ""}.`);
  }
  return { synced: true, skipped: false, found: true, rowNumber, statusColumn: columnLetter(statusIndex), updatedAtColumn: updatedAtIndex >= 0 ? columnLetter(updatedAtIndex) : null };
}

export async function appendOrderToGoogleSheets(input: GoogleSheetsOrderSyncInput) {
  const enabled = isEnabled();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEETS_ORDERS_SHEET_NAME?.trim();
  const credentialsPresent = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  );

  // Safe diagnostics only — never log the private key, service-account email, or access token.
  console.log("[google-sheets] sync start", {
    orderNumber: input.orderNumber,
    enabled,
    spreadsheetIdPresent: Boolean(spreadsheetId),
    sheetName: sheetName ?? null,
    credentialsPresent
  });

  if (!enabled) {
    console.log("[google-sheets] sync disabled (GOOGLE_SHEETS_ENABLED is off)", { orderNumber: input.orderNumber });
    return { synced: false, skipped: true };
  }
  if (!spreadsheetId || !sheetName || !credentialsPresent) {
    console.warn("[google-sheets] sync skipped — missing config", {
      orderNumber: input.orderNumber,
      spreadsheetIdPresent: Boolean(spreadsheetId),
      sheetNamePresent: Boolean(sheetName),
      credentialsPresent
    });
    return { synced: false, skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), syncTimeoutMs);
  try {
    const result = await appendOrder(input, controller.signal);
    console.log("[google-sheets] append success", { orderNumber: input.orderNumber, sheetName });
    return result;
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Timed out after ${syncTimeoutMs}ms.`
      : error instanceof Error ? error.message : "Unknown Google Sheets error";
    console.warn("[google-sheets] append failed", { orderNumber: input.orderNumber, sheetName, error: message });
    return { synced: false, skipped: false, error: "Google Sheets sync failed." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function updateOrderStatusInGoogleSheets(input: GoogleSheetsStatusSyncInput) {
  const enabled = isEnabled();
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const sheetName = process.env.GOOGLE_SHEETS_ORDERS_SHEET_NAME?.trim();
  const credentialsPresent = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  );

  console.log("[google-sheets] Google Sheets status sync started", {
    orderNumber: input.orderNumber,
    oldStatus: input.oldStatus ?? null,
    newStatus: input.newStatus,
    enabled,
    spreadsheetIdPresent: Boolean(spreadsheetId),
    sheetName: sheetName ?? null,
    credentialsPresent
  });

  if (!enabled) {
    console.log("[google-sheets] status sync disabled (GOOGLE_SHEETS_ENABLED is off)", { orderNumber: input.orderNumber });
    return { synced: false, skipped: true, found: false };
  }
  if (!spreadsheetId || !sheetName || !credentialsPresent) {
    console.warn("[google-sheets] status sync skipped - missing config", {
      orderNumber: input.orderNumber,
      spreadsheetIdPresent: Boolean(spreadsheetId),
      sheetNamePresent: Boolean(sheetName),
      credentialsPresent
    });
    return { synced: false, skipped: true, found: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), syncTimeoutMs);
  try {
    const result = await updateOrderStatus(input, controller.signal);
    if (!result.found) {
      console.warn("[google-sheets] status sync skipped - matching row not found", {
        orderNumber: input.orderNumber,
        oldStatus: input.oldStatus ?? null,
        newStatus: input.newStatus,
        sheetName,
        statusColumn: result.statusColumn ?? "F"
      });
      return result;
    }
    console.log("[google-sheets] status sync success", {
      orderNumber: input.orderNumber,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus,
      sheetName,
      rowNumber: result.rowNumber,
      statusColumn: result.statusColumn,
      updatedAtColumn: result.updatedAtColumn
    });
    return result;
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `Timed out after ${syncTimeoutMs}ms.`
      : error instanceof Error ? error.message : "Unknown Google Sheets error";
    console.warn("[google-sheets] status sync failed", {
      orderNumber: input.orderNumber,
      oldStatus: input.oldStatus ?? null,
      newStatus: input.newStatus,
      sheetName,
      error: message
    });
    return { synced: false, skipped: false, found: false, error: "Google Sheets status sync failed." };
  } finally {
    clearTimeout(timeout);
  }
}
