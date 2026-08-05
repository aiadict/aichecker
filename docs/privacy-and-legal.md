# AI Checker — Privacy & Legal Checklist

Tracks compliance items that are easy to miss until a Chrome Web Store submission bounces. Not
legal advice — have an actual lawyer review the policies before publishing.

## Domain & contact addresses (confirmed)

- **Production domain:** `werida.io` (already purchased). `NEXT_PUBLIC_APP_URL` is set to
  `https://werida.io` in the Vercel production environment.
- **Contact emails:** `hello@werida.io` (general/marketing) and `support@werida.io` (support,
  privacy/data requests, account issues) — both are live aliases. `/privacy` and `/terms` link to
  `support@werida.io`.

## Where policies live

- `/privacy` and `/terms` on the marketing site (`apps/web/src/app/privacy`,
  `apps/web/src/app/terms`) — **launch-ready copy, not placeholders.** Both cover what the
  product actually does: plans/credits/billing, cancellation and refunds, dunning behavior, data
  handling, and account deletion.
- Both are required in the Chrome Web Store listing (privacy policy URL is a mandatory field).
- **No Google OAuth is implemented** — auth is Supabase email/password only (see
  `apps/web/src/app/login/page.tsx`). The OAuth consent-screen verification checklist that used
  to live in this doc doesn't apply; removed rather than left as stale open items. Revisit only if
  Google sign-in is actually added later.

## Chrome Web Store submission checklist

- [x] Privacy policy URL live at `https://werida.io/privacy`.
- [x] Real icon set (`apps/extension/public/icons/`) — no longer placeholders.
- [ ] Single-purpose description matches what the extension actually does — re-check the copy in
  `apps/extension/manifest.config.ts` against the final feature set before submitting.
- [ ] Justify every permission explicitly in the listing (current set, after trimming
  `activeTab`/`scripting` — neither was actually used anywhere in the code):
  - `contextMenus` — powers "Check for AI Content" on selected text.
  - `storage` — caches the signed-in session and user settings locally.
  - `host_permissions: <all_urls>` — the single most sensitive permission; justify as "the
    extension needs to work on any site the user is reading, not a fixed list."
- [x] No remote code execution — MV3 forbids it; the production build has no `eval` or
  remotely-fetched scripts (Vite + `@crxjs/vite-plugin` bundles everything).
- [ ] Data-use disclosures accurate in the CWS **Privacy Practices** dashboard tab (separate from
  the privacy policy itself): we do read/transmit selected text (to check it) and do not sell it
  or use it for unrelated purposes.
- [x] Small promo tile (440×280) — `store-assets/chrome-web-store/small-tile-440x280.png`. Same
  icon glyph as the real extension icon, flat brand-blue background, "Check for AI" label.
- [ ] Store screenshots (1280×800) — still not created.
- [x] Chrome Web Store developer account exists — using the existing personal account
  (`majchrowski.d@gmail.com`, $5 fee already paid), not a new werida.io-branded one. The login
  email is never shown publicly; set the listing's **Developer name** field to "AI Checker" (or
  "Werida") at submission time for the professional-facing name instead.
- [ ] Extension name doesn't collide with an existing trademarked listing — checked live: no exact
  "AI Checker" match on the CWS today ("AI Check" and "AI Content Checker" are close neighbors,
  not exact matches). Low risk, not a hard blocker, but worth a final check right before
  submission in case that's changed.

## Data handling commitments to make good on

- Submitted text is sent to Pangram Labs (sub-processor) solely to generate the detection
  result — not used to train any model (matches Pangram's own policy commitment).
- Account deletion removes check history and account data (matches the commitment in `/privacy`
  and `/terms`) — **now actually implemented**: `/dashboard/account` lets a user export their data
  as JSON or delete their account outright (`apps/web/src/app/api/account/delete/route.ts`),
  which cascades to every owned row via the existing `on delete cascade` foreign keys. Deletion is
  blocked while an active paid subscription exists (points the user to Manage Billing first) —
  `STRIPE_SECRET_KEY` is a restricted key with **read-only** access to Subscriptions, so this
  route genuinely can't cancel one on the user's behalf.
- `api_usage_log` (our internal Pangram cost tracking) is never exposed to any client — enforced
  at the RLS layer (`supabase/migrations/20260729000002_rls_policies.sql`), not just in app code.

## Abuse / fraud prevention (protects the credit economics in product-spec.md §4)

- [x] Free plan: `monthly_credits` AND `daily_cap` both enforced atomically in the
  `consume_credit` Postgres function — stops a scripted flow from draining a month's credits in
  one sitting.
- [x] Rate limiting on `POST /api/checks`, independent of the credit system — a Vercel Firewall
  custom rule (20 requests/60s per IP), currently staged in **log-only** mode pending review of
  real traffic before enforcing (see Vercel dashboard → Firewall → Traffic, or `vercel firewall
  diff`). Not yet published to production — that's a deliberate call for the account owner to
  make after checking the rule doesn't catch legitimate use.
- [ ] Consider email verification before granting free credits (Supabase's default confirm-email
  flow exists but isn't currently required before a new signup gets its first credit balance).
- [ ] Alert (Slack/email webhook) if `api_usage_log` cost crosses a daily threshold — this is the
  concrete mechanism behind "make sure we don't lose money on API usage." Still not built.

## Still open / needs a decision

- [x] ~~Production domain name.~~ Resolved: `werida.io`.
- [x] ~~Refund policy specifics.~~ Resolved: fully written into `/terms`'s "Cancelling and
  refunds" section.
- [ ] **Stripe: still test-mode** (`STRIPE_SECRET_KEY` starts with `rk_test_`) and
  `STRIPE_WEBHOOK_SECRET` isn't set in Vercel production at all — deliberately deferred by the
  account owner until other items are done. Until both are fixed, a real payment on werida.io
  would be charged by Stripe but never actually activate the plan in our database.
- [ ] Error monitoring (Sentry or similar) — not set up. Failures are only visible via Vercel/
  console logs today.
- [ ] Whether institutional/FERPA-style commitments are needed if the education segment is
  pursued later (Pangram makes explicit FERPA commitments; we don't target that segment yet, so
  we haven't either — revisit if that changes).
