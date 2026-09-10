-- Backs the extension's uninstall survey: chrome.runtime.setUninstallURL
-- (apps/extension/src/background/index.ts) opens apps/web's /uninstall in
-- a new tab the moment a user removes the extension, matching Chrome's own
-- documented use case for that API ("clean up server-side data, do
-- analytics, or implement surveys"). A separate table from
-- feedback_ratings rather than folding this in - there's no star rating
-- dimension here, and by the time this page loads the extension is
-- already gone, so there's no signed-in extension session/device
-- correlation the way feedback_ratings gets from the extension's own
-- direct call - just a device_id carried through the URL itself, best-
-- effort (setUninstallURL's target is a static string set in advance,
-- capped at 255 chars by Chrome, so it can only carry what was already
-- known at the time it was last set - see background/index.ts).
create table if not exists public.uninstall_feedback (
  id uuid primary key default gen_random_uuid(),
  reason text,
  device_id text,
  created_at timestamptz not null default now()
);

alter table public.uninstall_feedback enable row level security;
-- No policies for anon/authenticated - service-role only, same pattern as
-- feedback_ratings: never touched directly by a client, only by apps/web's
-- own API route via the service-role admin client.

grant all on public.uninstall_feedback to service_role;
