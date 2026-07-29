-- Captures which Pangram model version actually served each request.
--
-- Pangram's pricing page lists a 10x cost difference between "Pangram 3"
-- ($0.05 / 1,000 words) and "Pangram 4" ($0.05 / 100 words), and neither
-- Pangram's REST API docs, migration guide, nor public SDK expose a
-- documented parameter to pin the cheaper model. Until that's confirmed
-- with Pangram directly, this column is our own audit trail — cross-check
-- it against Pangram's account dashboard/billing if the numbers ever look
-- off. See docs/product-spec.md §4 and packages/pangram-client's
-- PangramPredictResult.modelVersion.

alter table public.api_usage_log
  add column if not exists pangram_model_version text;
