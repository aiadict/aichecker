-- service_role hits the same wall anon/authenticated did in migration
-- 20260729000003: unchecking "Automatically expose new tables" means NO
-- role gets table-level GRANTs on new tables by default, not even
-- service_role. BYPASSRLS (which service_role has) only skips row-level
-- policies — it does not imply table-level GRANT privileges, those are a
-- separate, orthogonal Postgres permission layer that PostgREST/Data API
-- still enforces for every role, including service_role.
--
-- Confirmed live: apps/web's admin client (service_role key) got
-- "permission denied for table users" on a plain SELECT until this ran.
--
-- service_role is our trusted server-side role (used only in
-- apps/web/src/lib/supabase/admin.ts, never shipped to a client), so full
-- access here is intentional and safe — unlike anon/authenticated, which
-- get narrow, RLS-shaped grants in migration 20260729000003.

grant usage on schema public to service_role;

grant all on public.users to service_role;
grant all on public.plans to service_role;
grant all on public.subscriptions to service_role;
grant all on public.credit_balances to service_role;
grant all on public.checks to service_role;
grant all on public.check_windows to service_role;
grant all on public.api_usage_log to service_role;
