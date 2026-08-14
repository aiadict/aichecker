-- Fixes a real bug in consume_trial_credit found via live verification
-- after a post-launch bug report ("anonymous trial always shows Sign in
-- instead of spending a free credit"). A prior static read of this
-- function looked correct — the actual cause is a classic PL/pgSQL trap:
-- `returns table (allowed boolean, credits_remaining integer)` implicitly
-- declares a variable named credits_remaining for that output column,
-- which collides with the real anonymous_trials.credits_remaining table
-- column referenced (unqualified) by `select credits_remaining into
-- v_remaining ... for update` below. Confirmed live: every single call
-- to this RPC, for every device, failed outright with Postgres error
-- 42702 ("column reference \"credits_remaining\" is ambiguous") — not
-- intermittent, not config-related, 100% reproducible. The anonymous
-- trial has never actually worked for a single real user since this
-- function was created. Fix: qualify the table column explicitly.
create or replace function public.consume_trial_credit(p_device_id text, p_credits_needed integer)
returns table (allowed boolean, credits_remaining integer)
as $$
declare
  v_remaining integer;
begin
  insert into public.anonymous_trials (device_id)
  values (p_device_id)
  on conflict (device_id) do nothing;

  select anonymous_trials.credits_remaining into v_remaining
  from public.anonymous_trials
  where device_id = p_device_id
  for update;

  if v_remaining < p_credits_needed then
    return query select false, v_remaining;
    return;
  end if;

  update public.anonymous_trials
  set credits_remaining = v_remaining - p_credits_needed
  where device_id = p_device_id;

  return query select true, (v_remaining - p_credits_needed);
end;
$$ language plpgsql security definer set search_path = public;
