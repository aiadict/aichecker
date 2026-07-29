-- Bootstraps public.users + subscriptions + credit_balances the moment
-- someone signs up via Supabase Auth (auth.users), so the app never has to
-- lazily create these rows on first API call. security definer is required
-- because this runs during the INSERT into auth.users, before any
-- authenticated session/RLS context exists for the new user.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_free_plan_id uuid;
  v_free_plan_credits integer;
begin
  select id, monthly_credits into v_free_plan_id, v_free_plan_credits
  from public.plans
  where key = 'free'
  limit 1;

  if v_free_plan_id is null then
    raise exception 'handle_new_user: no plan with key=free found in public.plans';
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
    v_free_plan_credits,
    now(),
    now() + interval '1 month',
    0,
    date_trunc('day', now()) + interval '1 day'
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
