-- Share result: lets a user flip their own check's is_public flag so the
-- existing share_slug link (already generated at insert time, see
-- checks-repo.ts) becomes visible to non-owners via the
-- "anyone can read a publicly shared check" policy from 20260729000002.
--
-- Deliberately a COLUMN-scoped grant (is_public only), not a blanket
-- `grant update on public.checks` — a blanket grant plus this same RLS
-- policy would let a user rewrite their own check's prediction/fractions
-- after the fact and then share the doctored result as if Pangram produced
-- it. Postgres enforces column-level UPDATE grants at the "which columns
-- may appear in SET" level, so is_public is the only column this can ever
-- touch even though the RLS USING/CHECK clause (needing SELECT, already
-- granted) still evaluates the whole row.

create policy "users can update is_public of own checks" on public.checks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant update (is_public) on public.checks to authenticated;
