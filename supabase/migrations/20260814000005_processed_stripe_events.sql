-- Idempotency guard for the Stripe webhook (api/billing/webhook/route.ts).
-- Found during a full architecture review: every handler today is
-- naturally idempotent (absolute UPDATE ... SET, never an INSERT or
-- increment), so a duplicate delivery is currently harmless by
-- convention rather than by design — Stripe's webhooks are at-least-once,
-- and a manual "Resend" from the Stripe dashboard replays a real
-- historical event too. This table makes that safety explicit and
-- future-proof: if a handler ever needs to INSERT or increment instead of
-- SET, a duplicate delivery won't silently double-apply it.
--
-- Purely additive — no existing table touched, no change to how Stripe is
-- called or configured, no change to any handler's logic.
create table if not exists public.processed_stripe_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.processed_stripe_events enable row level security;
-- No policies for anon/authenticated — service-role only, same pattern as
-- api_usage_log/anonymous_trials/feedback_ratings: only ever touched by
-- the webhook route's own service-role admin client.

grant all on public.processed_stripe_events to service_role;
