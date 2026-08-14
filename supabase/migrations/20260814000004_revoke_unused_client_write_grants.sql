-- Revokes two write grants that were never actually used by any
-- application code, found during a full architecture/security review.
--
-- 1. checks INSERT (authenticated): every real check is written server-side
--    through the service-role admin client (see checks-repo.ts's
--    insertCheck, called from api/checks/route.ts) — no client code
--    anywhere calls supabase.from("checks").insert(...). Left open, this
--    let any signed-in user bypass credit consumption and the Pangram
--    pipeline entirely and insert a fully fabricated row (arbitrary
--    prediction/fractions/full_text) for their own user_id, then flip
--    is_public (already correctly locked to that one column by
--    20260801000003_share_checks.sql) and share it via /history/<slug> as
--    if it were a real, Pangram-produced verdict. The team already reasoned
--    through and fixed this exact class of bug for UPDATE — this closes the
--    same gap for INSERT.
--
-- 2. users UPDATE (authenticated): no client code anywhere calls
--    supabase.from("users").update(...) either — email is always resolved
--    from Supabase Auth directly (see lib/auth.ts's getAuthenticatedUser),
--    never from this mirror column. Unused write surface on principle: a
--    future feature could start trusting public.users.email without
--    realizing it's user-writable today.

revoke insert on public.checks from authenticated;
drop policy if exists "users can insert own checks" on public.checks;

revoke update on public.users from authenticated;
drop policy if exists "users can update own row" on public.users;
