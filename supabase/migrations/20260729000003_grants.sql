-- Table-level GRANTs for the anon/authenticated Postgres roles.
--
-- RLS policies (previous migration) restrict which ROWS a role can see or
-- touch, but Postgres requires a base table-level GRANT before RLS is even
-- consulted. We deliberately unchecked "Automatically expose new tables" at
-- project creation (Supabase's own recommendation, to control access
-- manually), so these grants must be explicit and intentional per table —
-- notably api_usage_log gets NONE, so it stays service-role-only even
-- though its RLS is otherwise permissive-by-absence.

grant usage on schema public to anon, authenticated;

grant select on public.plans to anon, authenticated;

grant select, update on public.users to authenticated;

grant select on public.subscriptions to authenticated;

grant select on public.credit_balances to authenticated;

grant select, insert on public.checks to authenticated;
grant select on public.checks to anon; -- publicly shared result links (is_public = true)

grant select on public.check_windows to anon, authenticated;

-- Deliberately no grants on public.api_usage_log for anon/authenticated —
-- only the service_role (used server-side only) may touch it.
