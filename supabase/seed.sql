-- Seeds the three launch plans. These numbers are the ones confirmed with
-- the user (docs/product-spec.md §3) — edit THIS file (or the row directly
-- in prod) to retune pricing/credits, never hardcode them in application code.
--
-- Cost basis: Pangram API = $0.05/1,000 words (realtime) or $0.04/1,000
-- (bulk). 1 credit = 1,000 words. Revisit once a real/negotiated API rate
-- is confirmed — see scripts/estimate-margin.ts.
--
-- stripe_price_id / stripe_price_id_annual values below are TEST MODE
-- price IDs (Stripe account "werida sandbox", products "AI Checker
-- Premium"/"AI Checker Professional" — renamed 2026-08-09 from "Pro"/
-- "Business", same product objects). Swap these for live-mode price IDs
-- before any real launch — test-mode and live-mode objects are entirely
-- separate in Stripe, sharing no IDs.

-- Free plan bumped 10 -> 25 credits/month and daily_cap turned off
-- (null, same as Premium/Professional) as of 2026-08-09 — first-iteration
-- decision to keep signup friction as low as possible for early Chrome Web
-- Store growth, no paywall pressure until someone actually runs out this
-- month. The daily cap is a data flip, not a removed feature: consume_credit()
-- (see 20260729000005_consume_credit_fn.sql) already no-ops its daily-cap
-- check whenever daily_cap is null, and every UI surface that shows a
-- "N left today" / "N checks/day" line already only renders when
-- dailyCap is non-null — so this single value flip is enough to both
-- disable enforcement and hide the UI, and setting it back to a number
-- later re-enables both with no code changes on either side.
--
-- Pro -> Premium and Business -> Professional (2026-08-09): renamed and
-- repriced. `key` stays 'pro'/'business' — that identifier is load-bearing
-- in checkout/webhook code and the PlanKey type; only `name` (the display
-- column) and the numbers changed. monthly_credits now line up with the
-- word counts shown on the pricing page (1 credit = 1,000 words):
-- Premium 300 credits = 300,000 words, Professional 500 credits =
-- 500,000 words. Both gained a monthly/annual toggle — price_cents /
-- stripe_price_id are always the MONTHLY price; price_cents_annual /
-- stripe_price_id_annual are the annual price, billed as one yearly
-- charge (not 12x the monthly price — annual is discounted ~10%).
insert into public.plans (
  key, name, monthly_credits, daily_cap, price_cents, price_cents_annual,
  billing_interval, seats_included, stripe_price_id, stripe_price_id_annual,
  is_featured, features
)
values
  ('free', 'Free', 25, null, 0, null, 'month', 1, null, null, false,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false}'::jsonb),
  ('pro', 'Premium', 300, null, 1999, 21588, 'month', 1,
    'price_1U2Xt7RouUhCdZVMx6GM1j2v', 'price_1U2XtERouUhCdZVM2gqWpLE1', true,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false, "priority_support": true}'::jsonb),
  ('business', 'Professional', 500, null, 3299, 35988, 'month', 3,
    'price_1U2XtIRouUhCdZVM8VNKEtDP', 'price_1U2XtLRouUhCdZVMpsvI7FUX', false,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false, "priority_support": true, "seat_pooling": true, "admin_controls": true}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  monthly_credits = excluded.monthly_credits,
  daily_cap = excluded.daily_cap,
  price_cents = excluded.price_cents,
  price_cents_annual = excluded.price_cents_annual,
  billing_interval = excluded.billing_interval,
  seats_included = excluded.seats_included,
  stripe_price_id = excluded.stripe_price_id,
  stripe_price_id_annual = excluded.stripe_price_id_annual,
  is_featured = excluded.is_featured,
  features = excluded.features;
