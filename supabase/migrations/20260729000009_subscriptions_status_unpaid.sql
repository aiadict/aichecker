-- Stripe subscriptions can reach 'unpaid' (retries exhausted, account
-- configured to mark unpaid rather than auto-cancel) in addition to the
-- statuses already allowed. Widening the check constraint so
-- customer.subscription.updated can sync it faithfully instead of erroring.

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active', 'past_due', 'canceled', 'trialing', 'unpaid'));
