-- Backs the redesigned /feedback form's multi-select reason checkboxes
-- ("Results seemed inaccurate", "The extension didn't work", etc.) —
-- stored as a real array rather than folded into the free-text `message`
-- column, since this is our own backend and there's no reason to degrade
-- structured data into text just because the original form didn't have
-- structured input yet.
alter table public.feedback_ratings
  add column if not exists reasons text[],
  add column if not exists app_version text;
