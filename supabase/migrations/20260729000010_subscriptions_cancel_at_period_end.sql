-- Tracks whether a subscription is scheduled to end at the current period's
-- close (set when a user cancels via the Customer Portal, which uses
-- cancel-at-period-end mode - see docs/architecture.md). Lets the dashboard
-- tell the user plainly "you keep your plan until <date>" instead of that
-- fact only being true and invisible in Stripe.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
