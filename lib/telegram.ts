import "server-only";

import { customizationText } from "@/lib/order-display";
import { formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import type { CartItem, CartTotals, CheckoutCustomer } from "@/types";

type TelegramOrderNotificationInput = {
  orderNumber: string;
  customer: CheckoutCustomer;
  items: CartItem[];
  totals: CartTotals;
};

type TelegramResult = { sent: boolean; skipped?: boolean; error?: string };

function telegramEnv() {
  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID?.trim() ?? ""
  };
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Telegram notification failed.";
}

function pickupText(customer: CheckoutCustomer) {
  if (customer.pickupTimeType === "scheduled" && customer.scheduledPickupTime) {
    return `Scheduled: ${formatPickupDateTime(customer.scheduledPickupTime)}`;
  }
  return "ASAP";
}

function itemLines(items: CartItem[]) {
  return items
    .map((item) => {
      const details = customizationText(item.customization);
      const notes = item.customization.notes ? `Notes: ${item.customization.notes}` : "";
      return [`${item.quantity}x ${item.number ? `${item.number}. ` : ""}${item.name}`, details, notes]
        .filter(Boolean)
        .join("\n  ");
    })
    .join("\n");
}

function buildOrderMessage({ orderNumber, customer, items, totals }: TelegramOrderNotificationInput) {
  const promoLine =
    totals.discount > 0
      ? `Promo discount${totals.promoCode ? ` (${totals.promoCode})` : ""}: -${formatPrice(totals.discount)}`
      : "Promo discount: None";

  return [
    "🍜 New China Delight Order",
    "",
    `Order: ${orderNumber}`,
    `Customer: ${customer.name}`,
    `Phone: ${customer.phone}`,
    `Email: ${customer.email}`,
    `Pickup: ${pickupText(customer)}`,
    customer.notes ? `Order notes: ${customer.notes}` : "",
    "",
    "Items:",
    itemLines(items),
    "",
    promoLine,
    `Tip: ${formatPrice(totals.tip)}`,
    `Tax: ${formatPrice(totals.tax)}`,
    `Processing fee: ${formatPrice(totals.processingFee)}`,
    `Total: ${formatPrice(totals.total)}`,
    "",
    `Admin: ${siteUrl()}/admin`
  ]
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, 3900);
}

export async function sendNewOrderTelegramNotification(input: TelegramOrderNotificationInput): Promise<TelegramResult> {
  const { botToken, chatId } = telegramEnv();
  if (!botToken || !chatId) {
    return { sent: false, skipped: true, error: "Telegram env vars are not configured." };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildOrderMessage(input),
        disable_web_page_preview: true
      })
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      return { sent: false, error: `Telegram API ${response.status}: ${body}` };
    }

    return { sent: true };
  } catch (error) {
    return { sent: false, error: safeErrorMessage(error) };
  }
}
