-- AI Checker — initial schema
-- See docs/product-spec.md §5 for the design rationale.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- users: mirrors auth.users (Supabase Auth), one row per app user
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plans: the ONLY place credit amounts / prices live. Change a row here,
-- not code, to retune pricing. See docs/product-spec.md §3 for the numbers
-- and their margin rationale against Pangram's $0.04-0.05/1,000-word cost.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key in ('free', 'pro', 'business')),
  name text not null,
  monthly_credits integer not null check (monthly_credits >= 0),
  daily_cap integer, -- null = no extra daily cap beyond monthly_credits
  price_cents integer not null default 0,
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  stripe_price_id text,
  seats_included integer not null default 1,
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions: current plan assignment per user, mirrors Stripe state
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled', 'trialing')),
  stripe_customer_id text,
  stripe_subscription_id text,
  seats integer not null default 1,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists subscriptions_user_id_active_idx
  on public.subscriptions (user_id)
  where status in ('active', 'trialing');

-- ---------------------------------------------------------------------------
-- credit_balances: the running meter shown as "x/y" in the extension header
-- ---------------------------------------------------------------------------
create table if not exists public.credit_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  credits_remaining integer not null default 0,
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  checks_today integer not null default 0,
  day_reset_at timestamptz not null default (date_trunc('day', now()) + interval '1 day'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists credit_balances_user_id_idx on public.credit_balances (user_id);

-- ---------------------------------------------------------------------------
-- checks: one row per "Check for AI" run (paste box, right-click, or
-- floating-icon flows all land here)
-- ---------------------------------------------------------------------------
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  text_snippet text not null,
  word_count integer not null check (word_count >= 0),
  credits_used integer not null check (credits_used >= 0),
  prediction text, -- e.g. "AI Generated" / "Human Written" / "Mixed"
  prediction_short text, -- e.g. "ai" / "human" / "mixed"
  fraction_ai numeric(5, 4),
  fraction_human numeric(5, 4),
  fraction_ai_assisted numeric(5, 4),
  source_url text,
  is_public boolean not null default false,
  share_slug text unique,
  created_at timestamptz not null default now()
);
create index if not exists checks_user_id_created_at_idx on public.checks (user_id, created_at desc);
create index if not exists checks_share_slug_idx on public.checks (share_slug) where share_slug is not null;

-- ---------------------------------------------------------------------------
-- check_windows: per-span breakdown powering the "AI Highlight" view
-- ---------------------------------------------------------------------------
create table if not exists public.check_windows (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  label text not null, -- e.g. "ai", "human", "ai_assisted"
  ai_assistance_score numeric(5, 4),
  confidence numeric(5, 4),
  start_char integer not null,
  end_char integer not null,
  word_count integer not null
);
create index if not exists check_windows_check_id_idx on public.check_windows (check_id);

-- ---------------------------------------------------------------------------
-- api_usage_log: OUR cost tracking against Pangram, independent of what we
-- charge the user. Never exposed to the client — service-role only. This is
-- the mechanism behind the "don't lose money on API usage" cost-monitoring
-- requirement in docs/product-spec.md §9.
-- ---------------------------------------------------------------------------
create table if not exists public.api_usage_log (
  id uuid primary key default gen_random_uuid(),
  check_id uuid references public.checks (id) on delete set null,
  pangram_credits_billed numeric(10, 4) not null,
  cost_usd_estimate numeric(10, 4) not null,
  created_at timestamptz not null default now()
);
create index if not exists api_usage_log_created_at_idx on public.api_usage_log (created_at desc);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.subscriptions;
create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.credit_balances;
create trigger set_updated_at before update on public.credit_balances
  for each row execute function public.set_updated_at();
