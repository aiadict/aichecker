-- Anonymous trial credits: lets a first-time visitor run a couple of
-- checks before creating an account (better Chrome Web Store conversion —
-- "try it once with zero friction"). Deliberately NOT wired into
-- plans/credit_balances/handle_new_user — once someone actually signs in
-- they land on the normal Free plan exactly as before; this is a
-- self-contained, additive add-on keyed on a client-generated device ID
-- (see apps/extension/src/lib/storage.ts's getOrCreateDeviceId), not a user.
--
-- Known, accepted limitation: a device ID lives in chrome.storage.local, so
-- reinstalling the extension (or a second Chrome profile) resets it. Low
-- volume, self-limiting, same trade-off every localStorage-based trial
-- makes. The real risk is a script minting fresh device IDs directly
-- against the API with no browser involved at all — see the daily spend
-- cap in api/checks/route.ts and the Firewall rule staged alongside this
-- migration for how that's bounded.

create table if not exists public.anonymous_trials (
  device_id text primary key,
  credits_remaining integer not null default 2 check (credits_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.anonymous_trials enable row level security;
-- No policies for anon/authenticated — service-role only, same pattern as
-- api_usage_log (never touched directly by a client, only by our own
-- Next.js server routes via the service-role admin client).

drop trigger if exists set_updated_at on public.anonymous_trials;
create trigger set_updated_at before update on public.anonymous_trials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- consume_trial_credit: atomic decrement, same FOR UPDATE locking pattern as
-- consume_credit, but with no monthly/daily reset logic — trial credits
-- never replenish, that's the whole point.
-- ---------------------------------------------------------------------------
create or replace function public.consume_trial_credit(p_device_id text, p_credits_needed integer)
returns table (allowed boolean, credits_remaining integer)
as $$
declare
  v_remaining integer;
begin
  insert into public.anonymous_trials (device_id)
  values (p_device_id)
  on conflict (device_id) do nothing;

  select credits_remaining into v_remaining
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

grant execute on function public.consume_trial_credit(text, integer) to service_role;

-- ---------------------------------------------------------------------------
-- app_config: tiny key/value table for flags that need to be flippable
-- without a redeploy or a new extension release — e.g. turning the
-- anonymous trial off once the Chrome Web Store listing has enough
-- traction/reviews that it's no longer needed for conversion. Both
-- api/checks and api/trial read this on every request; flipping the row
-- takes effect on the very next request for every already-installed copy
-- of the extension, old or new, since it's the server enforcing it, not
-- the client.
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;
-- Same as above: service-role only, no client policies.

drop trigger if exists set_updated_at on public.app_config;
create trigger set_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

insert into public.app_config (key, value)
values ('anonymous_trial_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- New tables get no GRANTs at all by default (confirmed live in
-- 20260729000006_service_role_grants.sql — "Automatically expose new
-- tables" is off, and BYPASSRLS doesn't imply table-level GRANTs). Match
-- that migration's pattern exactly rather than a narrower verb-specific
-- grant, so this table behaves the same as every other service-role table.
grant all on public.anonymous_trials to service_role;
grant all on public.app_config to service_role;
