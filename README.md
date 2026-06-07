# China Delight Ordering Website

Custom Next.js App Router ordering site for China Delight in Winsted, CT.

## Where To Edit

- Restaurant info, hours, address, phone, and tax rate: `lib/restaurant.ts`
- Menu categories and menu items/prices: `data/menu.ts`
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
NEXT_PUBLIC_TAX_RATE=0.0635
```

## Supabase Setup

Run `sql/schema.sql` in the Supabase SQL editor. The server API uses `SUPABASE_SERVICE_ROLE_KEY` to create orders and read/update the admin dashboard.

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

## Add Real Menu Items

Open `data/menu.ts` and replace or edit the `menuItems` array. Each item supports:

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

Cash / pay-at-pickup orders skip Stripe entirely and go straight to the confirmation page.
