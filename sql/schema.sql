-- Run this file in the Supabase SQL editor before accepting real orders.
-- Edit menu data in data/menu.ts first; this schema stores completed customer orders.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'order_status') then
    if not exists (select 1 from pg_enum where enumlabel = 'accepted' and enumtypid = 'order_status'::regtype) then
      alter type order_status add value 'accepted' after 'new';
    end if;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'fulfillment_type') then
    create type fulfillment_type as enum ('pickup', 'delivery');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('stripe', 'pay_at_pickup');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pickup_time_type') then
    create type pickup_time_type as enum ('asap', 'scheduled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('unpaid', 'paid', 'failed', 'refunded');
  end if;
end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  fulfillment_type fulfillment_type not null default 'pickup',
  delivery_address text,
  customer_notes text,
  payment_method payment_method not null default 'pay_at_pickup',
  pickup_time_type pickup_time_type not null default 'asap',
  scheduled_pickup_time timestamptz,
  status order_status not null default 'new',
  payment_status payment_status not null default 'unpaid',
  subtotal numeric(10, 2) not null,
  tax numeric(10, 2) not null,
  processing_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  stripe_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists payment_method payment_method not null default 'pay_at_pickup';
alter table public.orders add column if not exists pickup_time_type pickup_time_type not null default 'asap';
alter table public.orders add column if not exists scheduled_pickup_time timestamptz;
alter table public.orders add column if not exists payment_status payment_status not null default 'unpaid';
alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists processing_fee numeric(10, 2) not null default 0;
alter table public.orders alter column customer_email drop not null;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id text not null,
  item_number text not null,
  item_name text not null,
  category text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  customization jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_order_number_idx on public.orders(order_number);
create index if not exists orders_customer_phone_idx on public.orders(customer_phone);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_item_name_idx on public.order_items using gin (to_tsvector('english', item_name));

-- Temporary store for SMS phone-verification codes. Rows expire after 10 minutes (enforced in app code).
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  attempts integer not null default 0,
  verified boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists phone_verifications_phone_idx on public.phone_verifications(phone);
create index if not exists phone_verifications_expires_at_idx on public.phone_verifications(expires_at);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.phone_verifications enable row level security;

-- The app uses the service role key on the server for admin reads/writes.
-- Public browser clients do not receive direct table access by default.
