-- Adds the table that limits wrong admin passwords (lib/login-throttle.ts).
-- Safe to run more than once. Run it in the Supabase SQL editor.
-- Until it runs, admin login keeps working with no attempt limit.

create table if not exists public.admin_login_attempts (
  key text primary key,
  failures integer not null default 0,
  window_started_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;
