-- Seeds the three launch plans. These numbers are the ones confirmed with
-- the user (docs/product-spec.md §3) — edit THIS file (or the row directly
-- in prod) to retune pricing/credits, never hardcode them in application code.
--
-- Cost basis: Pangram API = $0.05/1,000 words (realtime) or $0.04/1,000
-- (bulk). 1 credit = 1,000 words. Revisit once a real/negotiated API rate
-- is confirmed — see scripts/estimate-margin.ts.

insert into public.plans (key, name, monthly_credits, daily_cap, price_cents, billing_interval, seats_included, features)
values
  ('free', 'Free', 10, 4, 0, 'month', 1,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false}'::jsonb),
  ('pro', 'Pro', 500, null, 4900, 'month', 1,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false, "priority_support": true}'::jsonb),
  ('business', 'Business', 2000, null, 19900, 'month', 3,
    '{"history": true, "shareable_links": true, "floating_icon": true, "google_docs_widget": false, "feed_scanning": false, "priority_support": true, "seat_pooling": true, "admin_controls": true}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  monthly_credits = excluded.monthly_credits,
  daily_cap = excluded.daily_cap,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  seats_included = excluded.seats_included,
  features = excluded.features;
