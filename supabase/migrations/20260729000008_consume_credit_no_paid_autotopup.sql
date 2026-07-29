-- Fixes a real revenue-leakage gap: consume_credit's monthly reset used to
-- top up ANY plan back to full credits once period_end passed, regardless
-- of whether the renewal actually got paid. For paid plans, credits must
-- only ever be topped up by the Stripe invoice.paid webhook (see
-- apps/web/src/app/api/billing/webhook/route.ts) — that's the only signal
-- that a renewal actually succeeded. A lapsed period_end on a paid plan
-- with no corresponding invoice.paid means the renewal hasn't been
-- confirmed (or has failed / is past_due) — the fix is simply to never
-- auto-refresh anything but the Free plan here. Free has no Stripe
-- subscription behind it, so its rolling monthly window has to be handled
-- by this time-based check; there's nothing else that would do it.
--
-- This alone gives correct dunning enforcement "for free": once a past_due
-- user's last-paid-for credits run out, consume_credit will correctly
-- start returning insufficient_credits/daily_cap_reached instead of
-- silently granting a new batch — no separate enforcement logic needed.

create or replace function public.consume_credit(p_user_id uuid, p_credits_needed integer)
returns table (allowed boolean, reason text, credits_remaining integer)
as $$
declare
  v_row public.credit_balances%rowtype;
  v_plan public.plans%rowtype;
begin
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'consume_credit: cannot act on another user''s balance';
  end if;

  select * into v_row from public.credit_balances where user_id = p_user_id for update;
  if not found then
    return query select false, 'no_credit_balance'::text, 0;
    return;
  end if;

  select * into v_plan from public.plans where id = v_row.plan_id;

  -- Only the Free plan auto-refreshes on a lapsed period here. Paid plans
  -- are topped up exclusively by the invoice.paid webhook.
  if v_row.period_end <= now() and v_plan.key = 'free' then
    v_row.credits_remaining := v_plan.monthly_credits;
    v_row.period_start := now();
    v_row.period_end := now() + interval '1 month';
  end if;

  if v_row.day_reset_at <= now() then
    v_row.checks_today := 0;
    v_row.day_reset_at := date_trunc('day', now()) + interval '1 day';
  end if;

  if v_plan.daily_cap is not null and v_row.checks_today + 1 > v_plan.daily_cap then
    update public.credit_balances set
      credits_remaining = v_row.credits_remaining,
      period_start = v_row.period_start,
      period_end = v_row.period_end,
      checks_today = v_row.checks_today,
      day_reset_at = v_row.day_reset_at
    where user_id = p_user_id;
    return query select false, 'daily_cap_reached'::text, v_row.credits_remaining;
    return;
  end if;

  if v_row.credits_remaining < p_credits_needed then
    update public.credit_balances set
      credits_remaining = v_row.credits_remaining,
      period_start = v_row.period_start,
      period_end = v_row.period_end,
      checks_today = v_row.checks_today,
      day_reset_at = v_row.day_reset_at
    where user_id = p_user_id;
    return query select false, 'insufficient_credits'::text, v_row.credits_remaining;
    return;
  end if;

  update public.credit_balances set
    credits_remaining = v_row.credits_remaining - p_credits_needed,
    checks_today = v_row.checks_today + 1,
    period_start = v_row.period_start,
    period_end = v_row.period_end,
    day_reset_at = v_row.day_reset_at
  where user_id = p_user_id;

  return query select true, null::text, (v_row.credits_remaining - p_credits_needed);
end;
$$ language plpgsql security definer set search_path = public;
