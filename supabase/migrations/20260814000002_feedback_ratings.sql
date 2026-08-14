-- Backs the extension's "Rate us" tab: a 5-star widget where 1-3 stars
-- routes to a private feedback form (apps/web/src/app/feedback) and 4-5
-- stars routes straight to the Chrome Web Store listing. One row per
-- rating, correlated by a client-generated id (see RateUsTab.tsx) so the
-- initial bare-rating log and a later written comment upsert onto the
-- SAME row instead of creating two — avoids silently under-counting low
-- ratings (most people never finish a feedback form) relative to high
-- ratings (always logged immediately, no form involved).
--
-- Known, accepted limitation: no rate-limiting on the anonymous insert
-- path in this pass — same trade-off already made for anonymous_trials,
-- low expected volume. A staged Firewall rule matching the one on
-- /api/checks is a reasonable follow-up if that changes.
create table if not exists public.feedback_ratings (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: a direct visit to /feedback with no prior star click (e.g.
  -- a future footer link) is still a valid submission with no rating.
  rating integer check (rating between 1 and 5),
  message text,
  email text,
  user_id uuid references public.users (id) on delete set null,
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback_ratings enable row level security;
-- No policies for anon/authenticated — service-role only, same pattern
-- as anonymous_trials/api_usage_log: never touched directly by a client,
-- only by apps/web's own API route via the service-role admin client.

drop trigger if exists set_updated_at on public.feedback_ratings;
create trigger set_updated_at before update on public.feedback_ratings
  for each row execute function public.set_updated_at();

-- New tables get no GRANTs at all by default (see
-- 20260729000006_service_role_grants.sql) — match every other
-- service-role table's explicit grant rather than relying on that.
grant all on public.feedback_ratings to service_role;
