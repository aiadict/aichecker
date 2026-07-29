-- Atomic credit consumption. Runs the daily/monthly reset + cap/credit
-- checks + decrement as a single locked transaction (SELECT ... FOR UPDATE)
-- so two concurrent "Check for AI" requests from the same user can't both
-- pass the credits_remaining check before either decrement lands (the
-- classic race condition that would let a free-plan user double-spend).
--
-- Returns one row: (allowed, reason, credits_remaining). `reason` is null
-- on success, or one of: no_credit_balance | daily_cap_reached |
-- insufficient_credits — these map directly to the CreateCheckResponse
-- error union in packages/shared-types.

create or replace function public.consume_credit(p_user_id uuid, p_credits_needed integer)
returns table (allowed boolean, reason text, credits_remaining integer)
as $$
declare
  v_row public.credit_balances%rowtype;
  v_plan public.plans%rowtype;
begin
  -- Defense in depth: if called with an authenticated JWT context (not
  -- just service_role, which has no auth.uid()), only allow self-service.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'consume_credit: cannot act on another user''s balance';
  end if;

  select * into v_row from public.credit_balances where user_id = p_user_id for update;
  if not found then
    return query select false, 'no_credit_balance'::text, 0;
    return;
  end if;

  select * into v_plan from public.plans where id = v_row.plan_id;

  if v_row.period_end <= now() then
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

-- No grant to anon/authenticated — only our server-side service-role client
-- calls this today. Revisit if a future feature needs the client to call
-- it directly (it would already self-scope correctly via the auth.uid() guard).
grant execute on function public.consume_credit(uuid, integer) to service_role;
