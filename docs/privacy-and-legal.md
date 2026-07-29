# AI Checker — Privacy & Legal Checklist

Tracks compliance items that are easy to miss until a Chrome Web Store or OAuth submission
bounces. Not legal advice — have an actual lawyer review the policies before publishing.

## Where policies live

- `/privacy` and `/terms` on the marketing site (`apps/web/src/app/privacy`,
  `apps/web/src/app/terms`) — currently drafted placeholders, **not launch-ready copy**.
- Both are required in two places before anything ships publicly:
  1. The Chrome Web Store listing (privacy policy URL is a mandatory field).
  2. The Google OAuth consent screen (required once requesting user email/profile scopes beyond
     a small unverified-app user cap).

## Chrome Web Store submission checklist

- [ ] Privacy policy URL live at final domain.
- [ ] Single-purpose description matches what the extension actually does.
- [ ] Justify every permission explicitly in the listing:
  - `contextMenus` — powers "Check for AI Content" on selected text.
  - `storage` — caches the signed-in session and user settings locally.
  - `activeTab` / `scripting` — reads the current page's text selection to check it, and injects
    the floating-icon overlay.
  - `host_permissions: <all_urls>` — the single most sensitive permission; justify as "the
    extension needs to work on any site the user is reading, not a fixed list."
- [ ] No remote code execution — MV3 forbids it; confirm the production build has no
  `eval`/remotely-fetched scripts (Vite + `@crxjs/vite-plugin` bundles everything by default).
- [ ] Data-use disclosures accurate: we do read/transmit selected text (to check it) and do not
  sell it or use it for unrelated purposes.
- [ ] Own icon set + store screenshots + promo tile (current icons are placeholders — see
  `apps/extension/public/icons/`).
- [ ] Chrome Web Store developer account exists ($5 one-time fee) — confirm before submitting.
- [ ] Extension name doesn't collide with an existing trademarked listing.

## Google OAuth verification checklist

- [ ] Verified domain ownership in Google Cloud Console.
- [ ] Privacy policy + terms URLs filled into the OAuth consent screen config.
- [ ] Scopes requested kept minimal (email + basic profile only, unless a feature needs more).

## Data handling commitments to make good on

- Submitted text is sent to Pangram Labs (sub-processor) solely to generate the detection
  result — not used to train any model (matches Pangram's own policy commitment).
- Account deletion removes check history within 30 days (matches the commitment already drafted
  into `/privacy`).
- `api_usage_log` (our internal Pangram cost tracking) is never exposed to any client — enforced
  at the RLS layer (`supabase/migrations/20260729000002_rls_policies.sql`), not just in app code.

## Abuse / fraud prevention (protects the credit economics in product-spec.md §4)

- [ ] Free plan: enforce both `monthly_credits` AND `daily_cap` from the `plans` table — stops a
  scripted flow from draining a month's credits in one sitting.
- [ ] Consider email verification before granting free credits.
- [ ] Rate-limit `/api/checks` by IP and by user, independent of the credit system.
- [ ] Alert (Slack/email webhook) if `api_usage_log` cost crosses a daily threshold — this is the
  concrete mechanism behind "make sure we don't lose money on API usage."

## Still open / needs a decision

- [ ] Production domain name.
- [ ] Refund policy specifics (`/terms` currently says "TODO").
- [ ] Whether institutional/FERPA-style commitments are needed if the education segment is
  pursued later (Pangram makes explicit FERPA commitments; we don't target that segment in
  Phase 1, so we haven't either — revisit if that changes).
