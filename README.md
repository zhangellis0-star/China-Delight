# China Delight Ordering Website

Custom Next.js App Router ordering site for China Delight in Winsted, CT.

## Where To Edit

- Restaurant info, hours, address, phone, and tax rate: `lib/restaurant.ts`
- DoorDash, Uber Eats, and Grubhub delivery links: `lib/restaurant.ts`
- Menu categories and menu items/prices: `data/menu.ts`
- Store-hours, lunch-hours, combo-includes, and pickup estimate rules: `lib/order-rules.ts`
- Supabase database schema: `sql/schema.sql`
- Environment variable template: `.env.example`

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
ADMIN_PASSWORD=
RESEND_API_KEY=
ORDER_FROM_EMAIL=
NEXT_PUBLIC_TAX_RATE=0.0735
NEXT_PUBLIC_PROCESSING_FEE_RATE=0.06
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

Use the same variables in Vercel Project Settings -> Environment Variables. At minimum for production ordering, set `NEXT_PUBLIC_SITE_URL`, Supabase URL/keys, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, Stripe keys, `STRIPE_WEBHOOK_SECRET`, Resend email variables, tax/fee rates, and Twilio variables when real SMS is desired.

## Pricing (tax + processing fee)

Checkout totals are computed in `lib/pricing.ts` (`calculateCart`) from `lib/restaurant.ts`:

- **Tax** = subtotal × `NEXT_PUBLIC_TAX_RATE` (Connecticut prepared meals = `0.0735` = 7.35%).
- **Processing fee** = subtotal × `NEXT_PUBLIC_PROCESSING_FEE_RATE` (`0.06` = 6%).
- **Tip** = optional customer-selected amount at checkout (none selected by default).
- **Total** = subtotal + tax + processing fee + tip.

These rates are read from env vars (never hardcoded). Both cash and Stripe orders save subtotal, tax, processing fee, tip, and total to Supabase, and Stripe is charged the exact final total (tax, processing fee, and tip are added as their own line items). The breakdown is shown on checkout, confirmation page, admin dashboard, and print ticket.

## Supabase Setup

Run `sql/schema.sql` in the Supabase SQL editor. The file is idempotent and safe to rerun. The server API uses `SUPABASE_SERVICE_ROLE_KEY` to create orders and read/update the admin dashboard.

It adds (among the base tables) the `orders.processing_fee`, `orders.tip_amount`, estimated-ready-time columns, accepted/ready timestamps, email sent/error tracking columns, and a `phone_verifications` table used for SMS phone verification. After pulling these changes, **rerun `sql/schema.sql`** (or at minimum the new statements) so the live database has them.

## Email Confirmations

Email is required at checkout. The app is provider-ready for Resend and uses the server-side helper in `lib/email.ts`.

Set:

```bash
RESEND_API_KEY=
ORDER_FROM_EMAIL="China Delight <orders@yourdomain.com>"
```

If these values are missing in local development, checkout does not crash and orders still place normally. The server logs a safe warning without printing keys.

### Email troubleshooting

Use the safe diagnostics route:

```bash
GET /api/debug/email
```

It returns whether `RESEND_API_KEY` and `ORDER_FROM_EMAIL` are detected, the API key length only, current `NODE_ENV`, and warnings. It never returns the API key.

Send a test email:

```bash
POST /api/debug/email/test
Content-Type: application/json

{
  "to": "customer@example.com",
  "adminPassword": "your ADMIN_PASSWORD when not in development"
}
```

In development, the test route works without a password. Outside development, use an admin session, `adminPassword` in the JSON body, or `x-admin-password` header.

If email is not received:

- Check Vercel Environment Variables for `RESEND_API_KEY` and `ORDER_FROM_EMAIL`.
- Redeploy/restart after changing environment variables.
- Open Resend logs and search for the recipient email.
- Check spam/junk folders.
- Check Supabase `orders.confirmation_email_error` or `orders.ready_email_error`.
- If `ORDER_FROM_EMAIL` uses `onboarding@resend.dev`, Resend may only send to verified/account emails depending on your account limits.
- Use a verified sending domain for production, then set `ORDER_FROM_EMAIL` to something like `China Delight <orders@yourdomain.com>`.

- Cash/pay-at-pickup orders send a confirmation email immediately after the order and items are saved to Supabase.
- Stripe orders send the confirmation email from the Stripe webhook after `checkout.session.completed` marks payment as paid.
- When admin marks an order ready, the app sends a ready-for-pickup email once and saves `ready_email_sent_at` so repeated clicks do not send duplicates.
- Admin shows badges for confirmation/ready email sent or failed.

Email includes order number, customer name, pickup-only wording, items, lunch choices, combo included items, special instructions, subtotal, tax, processing fee, tip, total, payment method/status, estimated ready time, restaurant phone/address, and the `/order-status` lookup page.

## Phone Verification

Phone number is required at checkout. SMS verification is optional for now and remains provider-ready for future use. The optional flow:

1. Customer enters phone and clicks **Send verification code**.
2. `POST /api/phone-verification` (`action: "send"`) generates a 6-digit code, stores it (Supabase `phone_verifications` table, or an in-memory fallback when Supabase is not configured), and sends it.
3. Customer enters the code and clicks **Verify** (`action: "verify"`). Codes expire after 10 minutes.

Messages shown: code sent, invalid code, code expired, phone verified. Customers can place cash or Stripe orders without completing SMS verification as long as they enter a phone number.

**SMS provider:** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` to send real texts via Twilio (`lib/sms.ts`). If they are not set, the app runs in **development mode**: the code is logged and returned to the local browser so you can test, and is **never exposed in production** (`NODE_ENV === "production"`). Admin pages do not require verification.

## Store Hours And Lunch Specials

Online ordering is blocked outside China Delight's printed hours:

- Monday-Thursday: 11:00 AM-10:00 PM
- Friday-Saturday: 11:00 AM-10:30 PM
- Sunday: 12:00 PM-10:00 PM

The menu stays visible while closed, but the cart, checkout, and checkout API will not place cash or Stripe orders. Checkout shows the next opening time.

Lunch specials are available Monday-Saturday, 11:00 AM-3:00 PM only. Lunch special Add to Cart buttons are disabled outside that window. Every lunch item saves:

- Rice choice: Pork Fried Rice by default, or White Rice
- Side choice: Egg Roll by default, Wonton Soup, Egg Drop Soup, or Canned Soda

Combo-size items and Special Combination Platters automatically include Pork Fried Rice and Egg Roll. Customers do not choose those combo sides unless the menu is later changed to require it.

## Delivery Platforms

Direct website ordering is pickup only. China Delight delivery should be ordered through third-party platforms.

Edit the links in `lib/restaurant.ts`:

```ts
deliveryPlatforms: [
  { name: "DoorDash", url: "" },
  { name: "Uber Eats", url: "" },
  { name: "Grubhub", url: "" }
]
```

When `url` is blank, the site shows that platform as "Coming soon." When `url` is filled in, the button opens that platform in a new tab.

## Stripe Setup

Add `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. When a customer selects "Pay online with Stripe" at checkout, the app creates a Stripe Checkout session and redirects them to Stripe. Without Stripe keys, the app still creates a local confirmation number for development.

`NEXT_PUBLIC_SITE_URL` must point at the running site (e.g. `http://localhost:3000` locally, your real domain in production) because it builds the Stripe success/cancel redirect URLs (`/confirmation?order=...` and `/checkout`).

## Stripe Webhook

Payment is confirmed server-side via the webhook at `app/api/stripe/webhook/route.ts` (`POST /api/stripe/webhook`). On `checkout.session.completed` it sets the order's `payment_status` to `paid` in Supabase; expired/failed sessions are marked `failed`. This requires `STRIPE_WEBHOOK_SECRET`.

Local development with the Stripe CLI:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

`stripe listen` prints a signing secret (`whsec_...`). Put it in `.env.local` as `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev` (environment variables are only read at startup).

Production: create a webhook endpoint in the Stripe Dashboard pointing at `https://YOUR_DOMAIN/api/stripe/webhook`, subscribe to `checkout.session.completed` (and optionally `checkout.session.expired` / `checkout.session.async_payment_failed`), and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.

## Customer Order Status

Customers can check status at `/order-status` by entering both their order number and phone number. The lookup only returns an order when both values match, so it does not expose other customers' orders.

## Admin Ready Times

In `/admin`, new orders show a ready-time picker before accepting. The admin can choose 10, 15, 20, 25, 30, 35, 45, or a custom number of minutes. Accepting an order saves `accepted_at`, `estimated_ready_minutes`, and `estimated_ready_at`. Marking an order ready saves `ready_at` and sends the customer a ready-for-pickup email once.

## Add Real Menu Items

Open `data/menu.ts` and edit `rawMenuItems`. The exported `menuItems` list is built from that source by applying split-item rules. Each item supports:

```ts
{
  id: "unique-dish-id",
  number: "135",
  name: "General Tso's Chicken",
  category: "Szechuan & Hunan Dishes",
  spicy: true,
  prices: { order: 13.85 },
  options: { spiceLevel: true, rice: true, addOns: true }
}
```

Use `pint`, `quart`, `combo`, `order`, `large`, or `small` for prices.

If a printed item is two choices joined by "or", add it to `menuItemSplits` instead of leaving it as one customer-facing item. The current split list uses numbers such as `1A` and `1B`.

## Test Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, search for a dish on the order page, add it to cart, checkout, then check `/admin`.

### Test a Stripe payment

1. Make sure `stripe listen` is running (see Stripe Webhook above) and `STRIPE_WEBHOOK_SECRET` is set.
2. Place an order and choose "Pay online with Stripe".
3. On Stripe Checkout use test card `4242 4242 4242 4242`, any future expiry, any CVC and ZIP.
4. You are redirected back to `/confirmation?order=...`; the `stripe listen` terminal shows `checkout.session.completed`, and the order's `payment_status` becomes `paid` in Supabase and on `/admin`.

Cash / pay-at-pickup orders skip Stripe entirely and go straight to the confirmation page. Website orders are pickup only; delivery links go to DoorDash, Uber Eats, or Grubhub.
