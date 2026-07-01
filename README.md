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
ADMIN_PASSWORD=
CRON_SECRET=
RESEND_API_KEY=
ORDER_FROM_EMAIL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_ORDERS_SHEET_NAME=Orders
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
NEXT_PUBLIC_TAX_RATE=0.0735
NEXT_PUBLIC_PROCESSING_FEE_RATE=0.06
```

Use the same variables in Vercel Project Settings -> Environment Variables. At minimum for production ordering, set `NEXT_PUBLIC_SITE_URL`, Supabase URL/keys, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `CRON_SECRET`, Resend email variables, Telegram variables for new-order notifications, Google Sheets variables if you want live sales sync, and tax/fee rates.

> Online ordering is **pay-at-pickup only** - there is no online card payment. Stripe and Twilio/SMS phone verification were removed; the related env vars are no longer read.

## Pricing (tax + processing fee)

Checkout totals are computed in `lib/pricing.ts` (`calculateCart`) from `lib/restaurant.ts`:

- **Promo discount** = optional code applied at checkout (see Promo Codes below). Applied to the subtotal before tax and fee. The discount can never exceed the subtotal, so the total never goes below `$0`.
- **Tax** = discounted subtotal × `NEXT_PUBLIC_TAX_RATE` (Connecticut prepared meals = `0.0735` = 7.35%).
- **Processing fee** = discounted subtotal × `NEXT_PUBLIC_PROCESSING_FEE_RATE` (`0.06` = 6%).
- **Tip** = optional customer-selected amount at checkout (none selected by default).
- **Total** = discounted subtotal + tax + processing fee + tip.

These rates are read from env vars (never hardcoded). Pay-at-pickup orders save subtotal, promo code, discount, tax, processing fee, tip, and total to Supabase. The breakdown is shown on checkout, confirmation page, admin dashboard, print ticket, order emails, and order status.

## Promo Codes / Discounts / Store Credit

Admins create and manage promo codes from the **Promo Codes** section of the `/admin` dashboard (sidebar/dropdown). Each code has:

- Code (e.g. `WELCOME10`) and description (e.g. `10% off first order`)
- Discount type: **Percentage** (value `10` = 10% off), **Fixed dollar** (value `5` = `$5.00` off), or **Store credit** (value `5` = `$5.00` off)
- Optional minimum order subtotal, expiration date, and max uses
- Active/inactive toggle and a live usage count

Customers enter a code at checkout, press **Apply** (or **Remove code**), and the totals recalculate. Validation happens on `POST /api/promo/validate` and again, authoritatively, when the order is placed (`POST /api/checkout`) so the discount cannot be tampered with. Errors shown: invalid code, inactive code, expired code, minimum-order not met, and usage limit reached.

The discount is applied **before** tax and the processing fee. When an order is saved, `promo_code` and `discount_amount` are stored on the order and `promo_codes.used_count` is incremented once the order saves successfully. If an admin later edits an order's items, the saved discount is kept but clamped so it never exceeds the new subtotal.

Admin promo routes (`GET/POST/PATCH/DELETE /api/admin/promo-codes`) are protected by the existing admin session. A code that has already been used cannot be deleted (disable it instead) to preserve order history. The customer validate route never exposes admin-only fields such as `used_count` or `max_uses`.

**Rerun `sql/schema.sql`** after pulling this change so the live database has the new `promo_codes` table and the `orders.promo_code` / `orders.discount_amount` columns.

## Supabase Setup

Run `sql/schema.sql` in the Supabase SQL editor. The file is idempotent and safe to rerun. The server API uses `SUPABASE_SERVICE_ROLE_KEY` to create orders and read/update the admin dashboard.

It adds (among the base tables) the `orders.processing_fee`, `orders.tip_amount`, estimated-ready-time columns, accepted/ready timestamps, and email sent/error tracking columns. After pulling these changes, **rerun `sql/schema.sql`** (or at minimum the new statements) so the live database has them.

> The schema still defines the `orders.stripe_session_id` column, the `'stripe'` value of the `payment_method` enum, and the `phone_verifications` table. These are **retained for backward compatibility with historical orders** even though Stripe and SMS verification have been removed from the app. Do not drop them without a separate, deliberate migration.

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

- Pay-at-pickup orders send a confirmation email immediately after the order and items are saved to Supabase.
- When admin marks an order ready, the app sends a ready-for-pickup email once and saves `ready_email_sent_at` so repeated clicks do not send duplicates.
- Admin shows badges for confirmation/ready email sent or failed.

Email includes order number, customer name, pickup-only wording, items, lunch choices, combo included items, special instructions, subtotal, tax, processing fee, tip, total, payment method/status, estimated ready time, restaurant phone/address, and the `/order-status` lookup page.

## Telegram Admin Notifications

New-order Telegram alerts are optional and server-side only. Set:

```bash
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

Create the bot with BotFather, send the bot a message from the Telegram account/group that should receive alerts, then use that chat ID. The checkout route sends Telegram only after the Supabase order and order items are saved. If Telegram is not configured or fails, checkout still succeeds and the failure is logged without exposing the bot token.

## Google Sheets Live Sales Sync

New pay-at-pickup orders can be appended to a Google Sheet for live sales tracking. The sync is optional and server-side only. Checkout saves the order and order items to Supabase first, then attempts the Google Sheets append with a short timeout. If the Google Sheets variables are missing, sync is disabled. If the Google Sheets API fails or times out, checkout still succeeds.

Set:

```bash
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_ORDERS_SHEET_NAME=Orders
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=
```

Setup:

1. In Google Cloud, create or choose a project.
2. Enable the Google Sheets API.
3. Create a service account and generate a JSON key.
4. Copy the service account `client_email` into `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
5. Copy the JSON key's `private_key` into `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. Escaped `\n` newlines are supported.
6. Create or choose the tracking spreadsheet.
7. Share the spreadsheet with the service account email as an editor.
8. Copy the spreadsheet ID from the URL into `GOOGLE_SHEETS_SPREADSHEET_ID`.
9. Set `GOOGLE_SHEETS_ORDERS_SHEET_NAME` to the tab name that should receive order rows.
10. Redeploy or restart after changing environment variables.

The app auto-creates the header row when the target tab is empty. Columns are:

`Created Date/Time`, `Order Number`, `Customer Name`, `Customer Phone`, `Customer Email`, `Status`, `Payment Method`, `Payment Status`, `Pickup Type`, `Scheduled Pickup Time`, `Subtotal`, `Discount`, `Tax`, `Processing Fee`, `Tip`, `Total`, `4% Website Fee`, `Promo Code`, `Special Offer / Free Item`, `Item Count`, `Item Summary`, `Customer Notes`, `Test Order?`, `Cancelled?`, `Count Toward Sales?`

`4% Website Fee` is calculated from the final customer total after discounts, tax, processing fee, and tip. Test orders are marked when the order number starts with `TEST`; cancelled orders and test orders are marked as not counting toward sales. Because rows are appended after checkout succeeds, a retry after a transient server/runtime interruption could append a duplicate row; use `Order Number` as the unique reference when reviewing the Sheet.

Manual admin status changes and the 11:59 PM Eastern auto-pickup job update the existing row's `Status` cell by matching `Order Number`. They do not append another row during status sync. If the matching Sheet row cannot be found, the database status change still succeeds and the server logs the skipped Sheet update.

## Phone Number At Checkout

A phone number is required at checkout so the kitchen can reach the customer. There is **no SMS verification** — Twilio/SMS phone verification has been removed. The phone number is saved with the order and printed on the kitchen ticket.

## Store Hours And Lunch Specials

Online ordering is blocked outside China Delight's printed hours:

- Monday-Thursday: 11:00 AM-10:00 PM
- Friday-Saturday: 11:00 AM-10:30 PM
- Sunday: 12:00 PM-10:00 PM

The menu stays visible while closed, but the cart, checkout, and checkout API will not place orders. Checkout shows the next opening time.

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

## Payment (Pay At Pickup)

Online ordering is **pay-at-pickup only**. The checkout API always saves orders with `payment_method = pay_at_pickup` and `payment_status = unpaid`; the customer pays in store when they collect the order. There is no online card payment and no Stripe integration.

`NEXT_PUBLIC_SITE_URL` must still point at the running site (e.g. `http://localhost:3000` locally, your real domain in production) because it builds the `/admin` link included in Telegram new-order notifications.

> **Historical orders:** older orders may have `payment_method = stripe` from when online payment was offered. The admin dashboard, order emails, daily report, and status pages still render those labels so historical data displays correctly. The `orders.stripe_session_id` column and the `'stripe'` enum value remain in the schema for that reason.

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

### Test an order

1. Place an order at checkout (pay-at-pickup only).
2. You are sent to `/confirmation?order=...`; the order appears in Supabase and on `/admin` with `payment_method = pay_at_pickup` and `payment_status = unpaid`.
3. If Telegram is configured, the new-order alert is delivered to the configured chat.

Website orders are pickup only; delivery links go to DoorDash, Uber Eats, or Grubhub.
