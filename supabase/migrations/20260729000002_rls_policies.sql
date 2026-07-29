-- Row Level Security — users can only ever see their own data.
-- plans is public-read (needed to render pricing pages while logged out).
-- api_usage_log has no client-facing policy at all (service-role bypasses RLS).

alter table public.users enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.credit_balances enable row level security;
alter table public.checks enable row level security;
alter table public.check_windows enable row level security;
alter table public.api_usage_log enable row level security;

create policy "users can read own row" on public.users
  for select using (auth.uid() = id);
create policy "users can update own row" on public.users
  for update using (auth.uid() = id);

create policy "plans are public read" on public.plans
  for select using (is_active = true);

create policy "users can read own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "users can read own credit balance" on public.credit_balances
  for select using (auth.uid() = user_id);

create policy "users can read own checks" on public.checks
  for select using (auth.uid() = user_id);
create policy "users can insert own checks" on public.checks
  for insert with check (auth.uid() = user_id);
create policy "anyone can read a publicly shared check" on public.checks
  for select using (is_public = true);

create policy "users can read windows of own checks" on public.check_windows
  for select using (
    exists (
      select 1 from public.checks
      where checks.id = check_windows.check_id
        and (checks.user_id = auth.uid() or checks.is_public = true)
    )
  );

-- No policies on api_usage_log: only the service role (which bypasses RLS)
-- may read/write it. Client requests are always denied by default-deny.
