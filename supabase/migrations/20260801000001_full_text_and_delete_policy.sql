-- Two changes, decided together after weighing storage cost against product
-- usefulness (see docs/product-spec.md discussion): storing full checked
-- text costs a negligible fraction of what we already pay Pangram to
-- analyze it (text storage is ~$0.10-0.30/GB-month; Pangram is
-- $0.04-0.05 per 1,000 words to generate the check in the first place) —
-- and a history you can't read back defeats the point of history. List
-- views (extension History tab, dashboard table) still truncate for
-- display, just at render time instead of at write time.

alter table public.checks rename column text_snippet to full_text;

-- Storing more text raises the bar on actually honoring "delete anytime"
-- from /privacy. There was previously NO delete policy on checks at all —
-- RLS silently denied every delete, including the owner's own, since RLS
-- is default-deny per operation, not just per row.
create policy "users can delete own checks" on public.checks
  for delete using (auth.uid() = user_id);
