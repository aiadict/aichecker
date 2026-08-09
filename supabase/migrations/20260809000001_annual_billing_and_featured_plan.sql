-- Supports the monthly/annual pricing toggle: each paid plan can now be
-- billed at either interval from the SAME plan row (same monthly_credits
-- entitlement either way — annual only changes payment cadence/price, not
-- what the user gets). price_cents/stripe_price_id keep meaning "the
-- monthly price", unchanged; these two new columns are their annual
-- counterparts. Both null for Free, same as the existing columns already are.
--
-- is_featured drives the "Most popular" badge — previously hardcoded as a
-- `featured: true` flag in the pricing page's now-removed static array
-- (see 2026-08-09 pricing overhaul), now lives in the same place as every
-- other plan-display fact.

alter table public.plans
  add column if not exists price_cents_annual integer,
  add column if not exists stripe_price_id_annual text,
  add column if not exists is_featured boolean not null default false;
