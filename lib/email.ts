import { customizationText } from "@/lib/order-display";
import { CONFIRMATION_PENDING_EMAIL_NOTE, estimatedPickupWindow, formatPickupDateTime } from "@/lib/order-rules";
import { formatPrice } from "@/lib/pricing";
import { restaurant } from "@/lib/restaurant";
import type { PaymentMethod, PaymentStatus, PickupTimeType } from "@/types";

type EmailOrder = {
  order_number: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  payment_method?: PaymentMethod | null;
  payment_status?: PaymentStatus | null;
  pickup_time_type?: PickupTimeType | null;
  scheduled_pickup_time?: string | null;
  estimated_ready_minutes?: number | null;
  estimated_ready_at?: string | null;
  subtotal: number;
  tax: number;
  processing_fee?: number | null;
  tip_amount?: number | null;
  total: number;
  order_items: Array<{
    item_number: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    customization?: Record<string, unknown> | null;
  }>;
};

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailResult = { sent: boolean; skipped?: boolean; error?: string };

function emailEnv() {
  return {
    apiKey: process.env.RESEND_API_KEY?.trim() ?? "",
    from: process.env.ORDER_FROM_EMAIL?.trim() ?? ""
  };
}

export function getEmailDiagnostics() {
  const { apiKey, from } = emailEnv();
  const normalizedFrom = from.toLowerCase();
  const warnings = [];
  if (!apiKey) warnings.push("RESEND_API_KEY is missing.");
  if (!from) warnings.push("ORDER_FROM_EMAIL is missing.");
  if (normalizedFrom.includes("onboarding@resend.dev")) {
    warnings.push("Resend onboarding@resend.dev may only send to verified/account emails. Use a verified domain for production.");
  }
  return {
    hasResendApiKey: Boolean(apiKey),
    resendApiKeyLength: apiKey.length,
    hasOrderFromEmail: Boolean(from),
    orderFromEmail: from || null,
    canCreateEmailClient: Boolean(apiKey && from),
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    warnings
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function pickupText(order: EmailOrder) {
  return order.pickup_time_type === "scheduled" && order.scheduled_pickup_time ? formatPickupDateTime(order.scheduled_pickup_time) : "ASAP";
}

export function readyTimeText(order: Pick<EmailOrder, "estimated_ready_at" | "estimated_ready_minutes" | "order_items">) {
  if (order.estimated_ready_at) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(order.estimated_ready_at));
  }
  if (order.estimated_ready_minutes) return `${order.estimated_ready_minutes} minutes`;
  return estimatedPickupWindow(order.order_items);
}

function paymentText(order: EmailOrder) {
  if (order.payment_method === "stripe") {
    if (order.payment_status === "paid") return "Stripe - paid";
    if (order.payment_status === "failed") return "Stripe - payment failed";
    return "Stripe - payment processing";
  }
  return "Pay at pickup / cash";
}

function orderRows(order: EmailOrder) {
  return order.order_items
    .map((item) => {
      const custom = customizationText(item.customization ?? undefined);
      const customLine = custom ? `\n   ${custom}` : "";
      const notes = item.customization?.notes ? `\n   Special instructions: ${String(item.customization.notes)}` : "";
      return `${item.quantity} x #${item.item_number} ${item.item_name} - ${formatPrice(item.unit_price * item.quantity)}${customLine}${notes}`;
    })
    .join("\n");
}

function orderRowsHtml(order: EmailOrder) {
  return order.order_items
    .map((item) => {
      const custom = customizationText(item.customization ?? undefined);
      const notes = item.customization?.notes ? `<br><strong>Special instructions:</strong> ${escapeHtml(String(item.customization.notes))}` : "";
      return `<li><strong>${item.quantity} x #${escapeHtml(item.item_number)} ${escapeHtml(item.item_name)}</strong> - ${formatPrice(item.unit_price * item.quantity)}${
        custom ? `<br>${escapeHtml(custom)}` : ""
      }${notes}</li>`;
    })
    .join("");
}

async function sendEmail(input: SendEmailInput): Promise<EmailResult> {
  const { apiKey, from } = emailEnv();
  if (!apiKey || !from) {
    console.warn("[email] Resend is not configured; skipping email", {
      hasApiKey: Boolean(apiKey),
      hasFromEmail: Boolean(from),
      toDomain: input.to.split("@")[1] ?? "unknown"
    });
    return { sent: false, skipped: true, error: "Email provider is not configured." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    });
    if (!response.ok) {
      const message = (await response.text()).slice(0, 500);
      console.error("[email] Resend send failed", {
        status: response.status,
        message,
        toDomain: input.to.split("@")[1] ?? "unknown"
      });
      return { sent: false, error: `Resend ${response.status}: ${message || response.statusText}`.slice(0, 600) };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error.";
    console.error("[email] Email send failed", { message, toDomain: input.to.split("@")[1] ?? "unknown" });
    return { sent: false, error: message };
  }
}

export async function sendTestEmail(to: string) {
  return sendEmail({
    to,
    subject: "China Delight test email",
    text: "If you received this, Resend is working.",
    html: "<p>If you received this, Resend is working.</p>"
  });
}

export async function sendOrderConfirmationEmail(order: EmailOrder) {
  if (!order.customer_email) return { sent: false, skipped: true, error: "Order has no customer email." };
  const lookupUrl = `${siteUrl()}/order-status`;
  const text = `China Delight order confirmation

Order number: ${order.order_number}
Customer: ${order.customer_name}
Pickup: pickup only
Pickup time: ${pickupText(order)}
${order.estimated_ready_at ? `Estimated ready: ${readyTimeText(order)}` : CONFIRMATION_PENDING_EMAIL_NOTE}
Payment: ${paymentText(order)}

Items:
${orderRows(order)}

Subtotal: ${formatPrice(order.subtotal)}
Tax: ${formatPrice(order.tax)}
Processing fee: ${formatPrice(order.processing_fee ?? 0)}
Tip: ${formatPrice(order.tip_amount ?? 0)}
Total: ${formatPrice(order.total)}

Check order status: ${lookupUrl}
Restaurant phone: ${restaurant.phone}
Address: ${restaurant.address}
Call us if you need to change your order.`;

  const html = `<div style="font-family:Arial,sans-serif;color:#1c1917;line-height:1.5">
    <h1>China Delight order confirmation</h1>
    <p><strong>Order number:</strong> ${escapeHtml(order.order_number)}</p>
    <p><strong>Customer:</strong> ${escapeHtml(order.customer_name)}</p>
    <p><strong>Pickup:</strong> pickup only</p>
    <p><strong>Pickup time:</strong> ${escapeHtml(pickupText(order))}</p>
    ${order.estimated_ready_at ? `<p><strong>Estimated ready:</strong> ${escapeHtml(readyTimeText(order))}</p>` : `<p>${escapeHtml(CONFIRMATION_PENDING_EMAIL_NOTE)}</p>`}
    <p><strong>Payment:</strong> ${escapeHtml(paymentText(order))}</p>
    <h2>Items</h2>
    <ul>${orderRowsHtml(order)}</ul>
    <p>Subtotal: ${formatPrice(order.subtotal)}<br>Tax: ${formatPrice(order.tax)}<br>Processing fee: ${formatPrice(order.processing_fee ?? 0)}<br>Tip: ${formatPrice(order.tip_amount ?? 0)}</p>
    <p style="font-size:20px"><strong>Total: ${formatPrice(order.total)}</strong></p>
    <p><a href="${lookupUrl}">Check your order status</a></p>
    <p><strong>${escapeHtml(restaurant.phone)}</strong><br>${escapeHtml(restaurant.address)}</p>
    <p>Call us if you need to change your order.</p>
  </div>`;

  return sendEmail({
    to: order.customer_email,
    subject: `China Delight order ${order.order_number}`,
    html,
    text
  });
}

export async function sendOrderAcceptedEmail(order: EmailOrder) {
  if (!order.customer_email) return { sent: false, skipped: true, error: "Order has no customer email." };
  const ready = readyTimeText(order);
  const lookupUrl = `${siteUrl()}/order-status`;
  const text = `Your China Delight order is confirmed.

Order number: ${order.order_number}
Pickup time: ${pickupText(order)}
Estimated ready: ${ready}

Check order status: ${lookupUrl}
Pickup at: ${restaurant.address}
Phone: ${restaurant.phone}`;

  const html = `<div style="font-family:Arial,sans-serif;color:#1c1917;line-height:1.5">
    <h1>Your China Delight order is confirmed.</h1>
    <p><strong>Order number:</strong> ${escapeHtml(order.order_number)}</p>
    <p><strong>Pickup time:</strong> ${escapeHtml(pickupText(order))}</p>
    <p><strong>Estimated ready:</strong> ${escapeHtml(ready)}</p>
    <p><a href="${lookupUrl}">Check your order status</a></p>
    <p><strong>${escapeHtml(restaurant.phone)}</strong><br>${escapeHtml(restaurant.address)}</p>
  </div>`;

  return sendEmail({
    to: order.customer_email,
    subject: `China Delight order ${order.order_number} confirmed`,
    html,
    text
  });
}

export async function sendOrderReadyEmail(order: EmailOrder) {
  if (!order.customer_email) return { sent: false, skipped: true, error: "Order has no customer email." };
  const text = `Your China Delight order is ready for pickup.

Order number: ${order.order_number}
Pickup at: ${restaurant.address}
Phone: ${restaurant.phone}

Please come to the counter and give your order number.`;

  const html = `<div style="font-family:Arial,sans-serif;color:#1c1917;line-height:1.5">
    <h1>Your China Delight order is ready for pickup.</h1>
    <p><strong>Order number:</strong> ${escapeHtml(order.order_number)}</p>
    <p><strong>Pickup at:</strong> ${escapeHtml(restaurant.address)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(restaurant.phone)}</p>
    <p>Please come to the counter and give your order number.</p>
  </div>`;

  return sendEmail({
    to: order.customer_email,
    subject: `China Delight order ${order.order_number} is ready`,
    html,
    text
  });
}
