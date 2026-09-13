-- Switches which AI-detection vendor actually serves /api/checks, without a
-- redeploy - same app_config pattern already used for
-- anonymous_trial_enabled (20260808000001_anonymous_trial_credits.sql).
-- Live-tested comparison (see docs/architecture.md): TruthScan's
-- WebSocket sentence-level channel correctly localized mixed human/AI
-- text where Pangram 3 confidently mislabeled a real human excerpt as
-- 100% AI-generated, at roughly half Pangram 3's per-word price. Pangram
-- is kept fully wired up (packages/pangram-client untouched) as the
-- rollback path if TruthScan misbehaves on real traffic - flip this one
-- row back to 'pangram' to revert instantly, no code change needed.
insert into public.app_config (key, value)
values ('detection_provider', '"truthscan"'::jsonb)
on conflict (key) do nothing;

-- Records which vendor actually served each check - was implicitly always
-- "pangram" before this column existed. Needed now that /api/checks can
-- call either provider, both for cost auditing and for telling old rows
-- (all Pangram, by definition) apart from new ones.
alter table public.api_usage_log
  add column if not exists provider text not null default 'pangram';
