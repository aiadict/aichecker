-- Closes a real, live-verified loophole: deleting an account and signing
-- up again with the SAME email got a brand-new, full 25-credit Free
-- balance every time, since credit_balances has no memory of anything
-- once its owning row is cascade-deleted along with the account (see
-- 20260729000001_init_schema.sql's "on delete cascade" chain). Confirmed
-- live during a full architecture review: created a test account, spent
-- credits, deleted it, re-registered with the same email, got a fresh
-- 25/25 again. Unlimited free-tier credit farming, one email, forever.
--
-- This table deliberately has NO foreign key to auth.users/public.users
-- and is never touched by account deletion, so it's the one thing that
-- survives to remember "this email already claimed its free credits"
-- even after a full, otherwise-complete deletion. Minimal by design
-- (just the email + when) -- this is exactly the "required retention
-- period" already promised in the account deletion confirmation copy,
-- scoped narrowly to fraud/abuse prevention, not full account data.
create table if not exists public.free_credits_claimed (
  email text primary key,
  claimed_at timestamptz not null default now()
);

alter table public.free_credits_claimed enable row level security;
-- No policies for anon/authenticated -- service-role only (touched only
-- by handle_new_user below, which runs as security definer), same
-- pattern as every other internal-bookkeeping table in this schema.

grant all on public.free_credits_claimed to service_role;

-- Extends handle_new_user (20260729000004_user_signup_bootstrap.sql):
-- grants the Free plan's full monthly_credits only the first time an
-- email is ever seen; a repeat signup on a previously-deleted email
-- starts at 0 instead. Deliberately NOT a permanent block -- the
-- existing monthly reset in consume_credit still applies going forward,
-- so a re-registered user resumes the normal once-a-month pace any
-- legitimate Free user gets, they just lose the "instant re-up via
-- delete-and-recreate" shortcut, which is the actual thing being closed.
-- Can never misfire for a genuine first-time signup: an email can only
-- reach this trigger a second time after its original account was
-- deleted, since Supabase enforces unique emails among active accounts.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_free_plan_id uuid;
  v_free_plan_credits integer;
  v_email text := lower(new.email);
  v_already_claimed boolean;
  v_initial_credits integer;
begin
  select id, monthly_credits into v_free_plan_id, v_free_plan_credits
  from public.plans
  where key = 'free'
  limit 1;

  if v_free_plan_id is null then
    raise exception 'handle_new_user: no plan with key=free found in public.plans';
  end if;

  select exists(select 1 from public.free_credits_claimed where email = v_email)
  into v_already_claimed;

  if v_already_claimed then
    v_initial_credits := 0;
  else
    v_initial_credits := v_free_plan_credits;
    insert into public.free_credits_claimed (email) values (v_email);
  end if;

  insert into public.users (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into public.subscriptions (user_id, plan_id, status)
  values (new.id, v_free_plan_id, 'active');

  insert into public.credit_balances (
    user_id, plan_id, credits_remaining, period_start, period_end, checks_today, day_reset_at
  )
  values (
    new.id,
    v_free_plan_id,
    v_initial_credits,
    now(),
    now() + interval '1 month',
    0,
    date_trunc('day', now()) + interval '1 day'
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;
