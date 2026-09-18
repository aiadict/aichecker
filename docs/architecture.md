# AI Checker — Architecture

## Stack

Next.js (marketing site + dashboard + API routes) on Vercel, Supabase (Postgres + Auth +
Storage), Stripe for billing, Chrome MV3 extension (Vite + React + `@crxjs/vite-plugin`).

## Monorepo layout

```
apps/
  web/                  Next.js app: marketing, dashboard, auth, API routes, /privacy, /terms
  extension/            Chrome MV3 extension — talks only to apps/web, never to a detection API directly
packages/
  shared-types/         Shared TS types (Plan, CheckResult, User, API request/response contracts)
  pangram-client/       Server-only Pangram API wrapper — imported by apps/web ONLY
  truthscan-client/     Server-only TruthScan API wrapper — imported by apps/web ONLY; primary
                         detection provider as of 2026-09-13, see "AI-detection provider" below
supabase/
  migrations/           SQL schema (see below)
  seed.sql              Seeds the free/pro/business plan rows
docs/                   This file + product-spec.md + privacy-and-legal.md
scripts/
  estimate-margin.ts    Recomputes plan margin against the current Pangram $/credit
```

## The one hard security rule

**No AI-detection API key may ever exist anywhere a browser extension bundle can be inspected.**
MV3 extension code is fully readable by any user via `chrome://extensions` → "Inspect". So:

- `packages/pangram-client` and `packages/truthscan-client` are imported **only** from
  `apps/web`'s server-side code (API routes). They read `PANGRAM_API_KEY` and
  `TRUTHSCAN_API_KEY`/`TRUTHSCAN_ORG_ID` from `process.env`, never from a request or client bundle.
- `apps/extension` never imports either client package. It only ever calls our own backend
  (`apps/web`'s `/api/*` routes), authenticated with a Supabase session token cached in
  `chrome.storage.local`.

## Auth flow: extension sign-in

The extension never implements its own OAuth/password UI. Instead:

1. Extension's Settings tab "Sign in" opens `apps/web`'s `/login?source=extension` in a new tab.
2. `/login` (`apps/web/src/app/login/page.tsx`) is a client component that calls Supabase Auth
   directly — email/password, or "Continue with Google" (added 2026-09-08, Supabase's `google`
   provider, Google Cloud project `ai-checker-werida`) — using the browser client
   (`lib/supabase/client.ts`, public anon/publishable key — safe to ship). Same handoff either
   way; a third provider added later needs zero new plumbing here.
3. On success (email/password: same page load; Google: after the OAuth redirect chain lands back
   on `/auth/confirm?next=...`, which exchanges the code server-side and redirects onward), if
   `source=extension`, the relevant page calls `postExtensionAuthSuccess`
   (`apps/web/src/lib/extension-handoff.ts`) — `window.postMessage({ type:
   "ai-checker/auth-success", accessToken, refreshToken }, origin)` **on itself**, resent every
   250ms for ~2s rather than once. Not a redirect, not localStorage.
   - Email/password sign-in does this directly in `/login`'s `handleSubmit`.
   - Google (and email-confirmation-based sign-up) land on `/extension-connected` first — a
     dedicated page whose only job is running this same handoff using the session `/auth/confirm`
     already established via `Set-Cookie`, since `/auth/confirm` itself is a pure server redirect
     with no client JS to send anything.
   - The resend-for-2s behavior (not a single send) exists because of a real, live-confirmed race:
     `apps/extension`'s content script registers its `postMessage` listener at `run_at:
     "document_idle"` (`manifest.config.ts`), scheduled independently of the page's own React
     hydration. `/login`'s handoff only fires after a user types credentials and clicks Submit —
     several seconds of natural margin. `/extension-connected`'s fires on mount, straight off an
     OAuth redirect chain, with none — confirmed live: the page reached its own "connected" success
     state (proving the session + a single postMessage did fire) while the extension stayed signed
     out, because the message went out before the content script had finished injecting. Resending
     is safe (the background handler just re-stores the same tokens) and needs no ack/handshake.
4. `apps/extension`'s content script (`src/content/index.tsx`) is injected on `<all_urls>`
   already; when its own `window.location.origin` matches our web app's origin, it adds a
   `message` listener for exactly this event and relays it to the background worker via
   `chrome.runtime.sendMessage`, which persists it (`lib/storage.ts`'s `setAuthSession`).
   Content scripts run in an "isolated world" and can't read the page's `localStorage`, but they
   do share the DOM/window, so same-window `postMessage` crosses that boundary cleanly.
5. Every subsequent extension → `apps/web` API call sends the stored `accessToken` as
   `Authorization: Bearer <token>`; `apps/web/src/lib/auth.ts`'s `getAuthenticatedUser` verifies
   it against Supabase Auth (`supabase.auth.getUser(token)`) on every request.

**Adding Google sign-in required zero `apps/extension` changes** — confirmed, not just
anticipated: the postMessage listener is origin-gated, not provider- or path-gated, and
`/extension-connected` already existed (built for the email-confirmation case) with the exact
contract Google's redirect-based flow also needed. The only real bug surfaced was the timing race
in point 3 above, fixed entirely in `apps/web`.

**Token refresh (done):** `apps/extension/src/lib/api.ts`'s `authedFetch` retries once on a 401 —
it calls Supabase's `token?grant_type=refresh_token` endpoint directly (no SDK needed, keeps the
extension bundle small) using the stored `refreshToken`, persists the new session, and retries
the original request. If the refresh token itself is invalid, it clears the session
(`setAuthSession(null)`) so the UI falls back to "Not signed in" rather than looping. This is why
`POST /api/checks`'s unauthorized case returns a real `401` status (not just `ok:false` in a 200)
— the extension keys off the status code to trigger this, uniformly with `GET /api/checks` and
`GET /api/me`.

## Auth flow: web dashboard

Separate from the extension's Bearer-token flow, but the same underlying Supabase Auth users:

- `lib/supabase/client.ts` uses `@supabase/ssr`'s `createBrowserClient`, which persists the
  session in cookies (not localStorage) — that's what lets the server side see it too. `/login`
  uses this client for both the extension handoff (reads the returned session object directly,
  independent of how it's persisted) and normal dashboard sign-in (redirects to `/dashboard`).
- `apps/web/src/middleware.ts` runs on every `/dashboard/*` request: refreshes the session cookie
  via `@supabase/ssr`'s `createServerClient` (Server Components can't set cookies themselves, so
  without this a session nearing expiry would go stale), and redirects to `/login` if there's no
  user. Confirmed live: an unauthenticated request to `/dashboard` gets a `307` to `/login`.
- `lib/supabase/server.ts`'s `createSupabaseServerClient()` is the cookie-scoped, RLS-respecting
  client used by the `/dashboard` Server Components and by the public `/history/[slug]` page.
  The share page deliberately does **not** use the admin client or an application-level
  `is_public` check — it relies entirely on RLS (`checks`' policies allow the owner via
  `auth.uid() = user_id`, or anyone when `is_public = true`). Confirmed live: an anonymous
  request to a freshly-created (private) check's share link 404s; flipping `is_public` to `true`
  makes the same link visible to the same anonymous request, no code path change.

### Password reset: cross-device fix (2026-09-17)

**Bug**: "Forgot password" worked end-to-end only when the reset email was opened in the *same*
browser that requested it — opened on a different device/browser (the common real case: email
on a phone, password typed on a desktop), the user landed back on `/login` with "This password
reset link couldn't be verified…" (`apps/web/src/app/login/page.tsx`'s `confirmation_failed`
handling, added in an earlier pass to at least explain the failure, not fix it).

**Root cause, confirmed via the live Supabase project config** (`GET
/v1/projects/{ref}/config/auth`'s `mailer_templates_*_content` fields), not assumed: the signup
**confirmation** email template was already a custom, on-brand one, and already linked with
`{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup` — verified server-side via
`supabase.auth.verifyOtp({ type, token_hash })` in `apps/web/src/app/auth/confirm/route.ts`,
which needs no state from the requesting browser, so it already worked cross-device. The
**recovery** (password reset) template, by contrast, was still the plain Supabase *default*
template, linking with `{{ .ConfirmationURL }}` — which GoTrue renders as a PKCE `?code=...`
link because the browser client (`lib/supabase/client.ts`, `@supabase/ssr`'s `createBrowserClient`)
defaults to `flowType: 'pkce'`. A PKCE code can only be exchanged
(`exchangeCodeForSession`) by the same browser holding the matching `code_verifier` — that's the
entire cross-device failure, by PKCE's design, not a flaw in `/auth/confirm` itself (that route
already had the `token_hash && type` → `verifyOtp` branch sitting right next to the `code` →
`exchangeCodeForSession` one; recovery just never hit the branch that already worked).

**Fix**: the recovery email template (Supabase Dashboard → Authentication → Email Templates →
Reset Password) was updated to the same pattern as confirmation —
`href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery"` — and restyled to match
confirmation's branded HTML (same logo SVG, `#3d6fe0` accent, card layout). **Zero app code
changed** — `auth/confirm/route.ts`, `reset-password/page.tsx`, and `login/page.tsx`'s
`handleForgotPassword` already fully supported this link shape; the recovery template had simply
never been migrated to it. This is a Supabase project config change, not a deploy.

**The one real tradeoff, accepted deliberately**: PKCE's code-exchange bound redemption to the
requesting browser specifically as an anti-hijacking property (mere possession of a leaked link
wasn't enough without also holding that browser's local `code_verifier`). Recovery now trades
that away for the standard "whoever holds the (single-use, 1-hour-expiry) link can redeem it"
model — the same model virtually every product's password-reset email has always used, and the
same one our own signup confirmation already used. Judged worth it since the alternative
actively broke the very common legitimate case (open the email on a phone, reset on a desktop).

**Verified live, real cross-device test** (2026-09-17): requested a reset from one device,
opened the email and completed the reset from a *different* device — worked. Same-device path
still works unaffected.

**Not fixed, deliberately**: `mailer_templates_magic_link_content` has the identical
`{{ .ConfirmationURL }}` pattern and would have the same bug, but magic-link sign-in isn't used
anywhere in the app (no `signInWithOtp` call exists) — dead template content, no live impact,
left alone.

## Data flow: a "Check for AI" action

**Verified end-to-end live** (2026-07-29): real signup → bootstrap trigger → real Pangram
prediction → real atomic credit deduction → real DB rows, including daily-cap enforcement
kicking in exactly at the 5th check of the day despite monthly credits remaining. Test user and
all its data were deleted afterward (`on delete cascade` from `auth.users` down through
`subscriptions`/`credit_balances`/`checks`).

1. User pastes text, selects text (floating icon), or right-clicks (context menu) in
   `apps/extension`.
2. Extension sends `{ text, sourceUrl }` to `POST /api/checks` on `apps/web`, with the stored
   Supabase access token as a Bearer header.
3. API route (`apps/web/src/app/api/checks/route.ts`):
   - Verifies auth via `getAuthenticatedUser` — returns `unauthorized` if missing/invalid.
   - Calls `getDetectionProvider()` to pick `PangramClient` or `TruthScanClient`, then that
     client's `.predict()` — see "AI-detection provider" below for why there are two.
   - Calls the `consume_credit` Postgres function (`supabase/migrations/..._consume_credit_fn.sql`)
     via RPC — atomically resets expired daily/monthly counters, checks `daily_cap` and
     `credits_remaining`, and decrements, all under a row lock (`SELECT ... FOR UPDATE`) so two
     concurrent requests can't double-spend. Maps its `reason` to `daily_cap_reached` /
     `insufficient_credits`.
   - Inserts into `checks` (+ `check_windows`) and `api_usage_log` via `lib/checks-repo.ts` and
     the service-role client directly (already-verified user, trusted server context).
4. Response returned to the extension; also queryable via `GET /api/checks` (used by the
   extension's History tab) and `GET /api/me` (credits header). The `/dashboard` pages now read
   these same real tables too (via the RLS-scoped SSR client, not the admin client) —
   `lib/mock-store.ts` has been deleted, nothing references it anymore.

## AI-detection provider: TruthScan primary, Pangram kept as instant rollback (2026-09-13)

Switched `/api/checks`' primary detection vendor from Pangram to TruthScan, without removing
Pangram — both `packages/pangram-client` and `packages/truthscan-client` implement the same
`predict(text)` contract, and `getDetectionProvider()` (`apps/web/src/lib/detection-provider.ts`)
picks between them by reading `app_config.detection_provider` (`"pangram" | "truthscan"`) on every
request — same flip-without-a-redeploy pattern as `anonymous_trial_enabled`. Currently set to
`"truthscan"`. Flipping it back to `"pangram"` is the rollback path if TruthScan misbehaves on
real traffic; that's the entire reason Pangram's integration wasn't deleted.

**Why switch at all** — live-tested, not assumed: submitted identical controlled mixed-authorship
text (genuine AI-written paragraphs + real, verbatim public-domain human text — Jane Austen,
Lincoln's Gettysburg Address, Dickens — at known character boundaries) to both. Pangram 3.3.2
returned a single window covering the entire ~200-word mixed document, confidently (High
confidence) labeling real Jane Austen text as "100% AI-Generated" — a genuine miss, not a vague
call. This matches Pangram's own model card for 3.2 ("no change from 3.2" in 3.3): "shorter
segments of human text interspersed with AI text may be classified as AI assisted, but Pangram
will not be able to distinguish the human and AI parts at the word- or sentence-level" — accurate
to ~50 words. At longer length (~750 words, above the documented 450-word threshold where 3.3.1's
segmentation algorithm changes), Pangram partially recovered (3 windows, correct majority
classification) but still misattributed the same famous opening sentence and overestimated the AI
fraction by ~10 points. Pangram 4 fixes this (tokenwise CRF decoder, sentence-level output,
"substantially improves heterogeneous-mixed text recall" per its own model card) but costs 10x
Pangram 3's rate ($0.50 vs $0.05/1,000 words) — wholesale switching to it would flip Premium/
Professional plan margins from thin-positive to catastrophically negative (see cost math below).

TruthScan's WebSocket sentence-level channel (not its plain REST `/detect`, which returns only a
single document-level score with no positional data at all) correctly localized every mixed-text
boundary tested — including the exact case Pangram 3 missed — at $0.01-0.03/1,000 words depending
on plan tier, cheaper than even Pangram 3. Confirmed live that the sentence-level channel carries
no separate charge over the plain endpoint (two identical texts submitted once each way both
deducted identical "scan" amounts in TruthScan's own billing ledger — direct evidence, not
inference). Confirmed live that a Vercel Node.js function can hold this WebSocket connection open
long enough to receive all streamed sentence results: ~1.3-1.5s total round trip for realistic
document lengths (opened a real preview deployment, drove it with `vercel curl`) — no timeout or
egress issues, `runtime = "nodejs"` is all that's needed (already the default everywhere else in
this codebase).

**What `TruthScanClient.predict()` does differently from Pangram's wrapper**: TruthScan's
`/detect` score is deliberately not used at all. Instead, the per-sentence `document_chunk` scores
(continuous 0-1) are thresholded into our own `ai`/`mixed`/`human` labels (provisional cutoffs:
`≥0.7` AI, `≤0.3` human, `SCORE_AI_THRESHOLD`/`SCORE_HUMAN_THRESHOLD` in
`packages/truthscan-client/src/index.ts` — tuned against a small hand-built test set, not
vendor-guaranteed, revisit once real traffic gives a bigger sample), and `fractionAi`/
`fractionAiAssisted`/`fractionHuman` are computed ourselves as word-count-weighted proportions
across those buckets — not TruthScan's own cruder three-way Human/AI/Paraphrase label, which has
no "Mixed" category at all. Per-sentence `confidence` is likewise derived (distance from the 0.5
midpoint), since TruthScan doesn't return a separate confidence field the way Pangram does.

**Zero `apps/extension` changes** — `CheckWindow`/`CheckResult` (`packages/shared-types`) already
fully describe TruthScan's output; `ResultCard.tsx`, `buildHighlightSegments`, `synthesizeInsight`,
and the DB schema are all provider-agnostic already. This was a backend-only swap; no new Chrome
Web Store submission needed for it.

**Known, accepted limitations, not fixed by this switch:** both vendors independently stumbled on
the exact same unusually formal/rhetorical sentence (the Gettysburg Address's opening) — a shared
blind spot across providers on that style of prose, not a TruthScan-specific defect. Non-English
content is untested (TruthScan's model name `xlm_ud_detector` suggests multilingual support, but
this hasn't been verified against the extension's 52 locales). TruthScan's real production rate
limits at this app's actual traffic volume are untested. Pricing verified against the public
per-word developer tier and an actual trial account's real billing ledger, not a signed contract —
get a written quote for the tier actually used before treating margin math as final. Its dashboard
had "Zero Data Retention" off by default; turned on before any real user text was sent through it.

## Database schema (Supabase Postgres)

See `supabase/migrations/20260729000001_init_schema.sql` for the authoritative DDL. Summary:

```
users               mirrors auth.users — id, email, display_name
plans               THE pricing/credit config table — key, monthly_credits, daily_cap,
                     price_cents, stripe_price_id, features jsonb. Edit rows here to retune
                     pricing; never hardcode credit amounts in application code.
subscriptions       user's current plan + Stripe subscription state
credit_balances     the running "x/y" meter shown in the extension header
checks              one row per check (full_text, verdict, fractions, source_url,
                     share_slug, is_public). full_text is exactly that — the
                     complete submitted text, not a truncated preview; see
                     "History & result display" below for why.
check_windows       per-span AI/human breakdown, powers the "AI Highlight" view
api_usage_log       OUR cost tracking against Pangram — service-role only, never exposed
                     to the client. Independent of what we charge the user.
```

RLS (`20260729000002_rls_policies.sql`): users can only read/write their own rows; `plans` is
public-read; `api_usage_log` has no client policy at all (service-role bypasses RLS by design).

**GRANTs are separate from RLS and easy to forget** (`20260729000003_grants.sql`): we unchecked
"Automatically expose new tables" when creating the Supabase project (their own recommendation,
for manual access control), which means Postgres never gives the `anon`/`authenticated` roles a
base table-level GRANT on new tables — RLS policies are only consulted *after* that GRANT exists.
Confirmed live: querying `plans` returned `permission denied` until the GRANT migration ran, even
though the public-read RLS policy was already in place. **Any future table needs both** an RLS
policy (which rows) **and** an explicit `GRANT` in a migration (whether the role can touch the
table at all) — `api_usage_log` intentionally gets neither beyond service-role.

**This applies to `service_role` too** (`20260729000006_service_role_grants.sql`) — `BYPASSRLS`
only skips row-level policies, it does not imply table-level GRANTs. Confirmed live: `apps/web`'s
admin client got `permission denied for table users` on a plain SELECT until this ran. `service_role`
gets full access on every table (it's our trusted server-only role — the narrow, RLS-shaped
grants in migration 3 are specifically for `anon`/`authenticated`).

Two more migrations add behavior, not just access:
- `20260729000004_user_signup_bootstrap.sql` — `security definer` trigger on `auth.users` insert
  that creates the matching `public.users` + `subscriptions` (free plan) + `credit_balances`
  rows automatically, so the app never lazily creates them on first API call.
- `20260729000005_consume_credit_fn.sql` — see "Data flow" below.

**Same GRANT gotcha, third time** (`20260801000002_grant_delete_checks.sql`): adding the "users
can delete own checks" RLS policy (`20260801000001_...sql`) wasn't enough on its own — confirmed
live, both an anonymous delete attempt *and* the actual owner's delete attempt got `permission
denied for table checks`, because `authenticated` had never been granted `DELETE` on `checks` at
all (the original grants migration only gave it `SELECT, INSERT`). Pattern holds: every new
*operation* on a table (not just every new table) needs its own explicit `GRANT`, RLS policy
alone is never sufficient. `anon` deliberately gets no `DELETE` grant — only signed-in owners can
delete their own checks.

## History & result display (2026-08-01 UX pass)

Prompted by a screenshot-by-screenshot comparison against Pangram's own extension (12 screenshots
in `content/aichecker_vs_pangram_screenshots/`), which surfaced one genuine bug and several
missing-parity items. Full comparison writeup and phased plan are in the conversation history;
this section covers what actually shipped in Phase 1.

- **Bug: the AI percentage could flatly contradict the verdict text.** Pangram returns three
  fractions — `fraction_ai`, `fraction_ai_assisted`, `fraction_human` — but the UI only ever
  displayed `fractionAi` as "the percentage." A document that's 0% *fully* AI-generated but 100%
  *AI-assisted* would show "**0%** ... We believe this document is moderately AI-assisted" — two
  contradictory claims in the same card. Fixed in both `apps/extension`'s `CheckForAiTab` and
  `apps/web`'s `/history/[slug]`: the headline percentage is now `fractionAi + fractionAiAssisted`
  ("AI involvement"), with a three-segment AI/Assisted/Human breakdown bar underneath (colors
  reused from the existing `.verdict.ai/.human/.mixed` palette). Verified live against a real
  Pangram result (100% AI, "fully AI-generated") — headline and verdict text agree now by
  construction, not by coincidence.
- **`checks.full_text` (renamed from `text_snippet`) now stores the complete submitted text**,
  not a 200-character truncation applied at write time. Decided after actually comparing costs:
  even a heavy user's monthly text storage costs a small fraction of a cent, versus the
  $0.04-0.05/1,000 words already being paid to Pangram to generate the check in the first place —
  storage was never the expensive part. List views (extension History tab, dashboard table)
  still show short previews, but by truncating *at render time* now, not write time — the full
  text is always in the database for the detail page. Verified live: submitted 591 characters,
  confirmed `full_text` in the database and in the API response were both exactly 591, not 200.
- **Per-check delete**, added as a direct consequence of storing more text — honoring the
  "delete anytime" promise in `/privacy` means something now. `DeleteCheckButton` (client
  component, `/history/[slug]`) calls the RLS-scoped browser Supabase client directly, matching
  the existing `SignOutButton`/`ManageBillingButton` pattern rather than adding a new API route.
  Only rendered for the check's owner. Verified live: anonymous delete attempt denied, owner's
  delete succeeded and the row was confirmed gone (404 on revisit).
- Everything deferred out of Phase 1 (share result, clickable history rows, a richer compact
  result card, highlighted spans, and the floating-window redesign) shipped in the very next pass
  — see "Everything deferred from Phase 1" below.

## Everything deferred from Phase 1 (2026-08-01, same-day follow-up)

- **Share result.** `checks.is_public` is now user-toggleable via a **column-scoped** grant —
  `grant update (is_public) on public.checks to authenticated` plus a matching RLS policy
  (`supabase/migrations/20260801000003_share_checks.sql`) — deliberately not a blanket `UPDATE`
  grant. A blanket grant plus that same RLS policy would let a user rewrite their own check's
  `prediction`/fractions and then share the doctored result as if Pangram produced it; Postgres
  enforces column-level `UPDATE` grants at the "which columns may appear in `SET`" level, so
  `is_public` is the only column this can ever touch. Two call sites: `ShareResultButton`
  (`apps/web/src/app/history/[slug]/components/`) updates straight through the RLS-scoped browser
  client, matching `DeleteCheckButton`'s pattern; the extension has no Supabase session of its own,
  so it goes through a new `POST /api/checks/[id]/share` route instead, which does the same update
  server-side with an explicit `.eq("user_id", user.id)` ownership check (the admin client bypasses
  RLS, so ownership can't be left to policy there). Verified live: a check is a 404 on its
  `/history/<slug>` link before sharing, 200 with full content after; the RLS-scoped client can
  flip `is_public` but a same-client attempt to also set `prediction` in the same call is rejected
  with "permission denied for table checks."
- **Clickable history rows.** Extension's `HistoryTab` rows now `window.open` the row's
  `/history/<shareSlug>` link. The dashboard's `<tr>` can't itself be a `<Link>` (invalid HTML — a
  `<tr>`'s only valid children are cells), so a small client component, `ClickableRow`, wraps the
  cells and calls `router.push` on click instead; the badge-only `Link` it replaced is gone.
- **Richer compact result.** `ResultCard` (new: `apps/extension/src/components/ResultCard.tsx`) is
  now shared between the popup's "Check for AI" tab and the on-page panel (see below) — an info
  icon (title-attribute tooltip) explains the detection methodology, a synthesized one-line insight
  ("AI involvement is concentrated in the later part of this text" / "...appears scattered
  throughout...") is computed from window position data, plus "View full analysis" and "Share
  result" actions.
- **The insight line** is `synthesizeInsight(windows: CheckWindow[])`, added to
  `packages/shared-types` alongside the types themselves rather than duplicated per-app — the
  package is consumed as raw TS source (`main`/`types` both point at `src/index.ts`), so both
  bundlers compile it directly; it's not a types-only package by convention, just by content so
  far. Returns `null` (renders nothing) when there's nothing positional worth saying: fewer than 2
  windows, every window sharing one label, or the AI/mixed windows spanning more than 60% of the
  text's character range (a "scattered" verdict is returned then, instead of picking one region
  index-average would falsely suggest is nowhere near the text's actual AI content). Verified with
  synthetic multi-window data (unit-style, not something the real Pangram API reliably produces on
  demand): concentrated-early, concentrated-late, uniform → null, and both-ends → "scattered" all
  behave as designed.
- **Highlighted text spans.** `buildHighlightSegments(fullText, windows)`, same package, splits
  `full_text` into ordered `{text, label}` segments at window boundaries — gap-aware, since windows
  don't always cover the text contiguously; an uncovered stretch gets `label: null` (rendered
  plain) rather than being misclassified as human. `/history/[slug]` renders `ai`/`mixed` segments
  as `<mark class="hl-ai">`/`<mark class="hl-mixed">` and leaves `human`/`null` segments as plain
  text — matching Pangram's own "highlight only what's flagged" behavior rather than color-coding
  the entire page. `check_windows` is fetched with the same RLS policy already used for the fraction
  data (owner-or-public read), no new policy needed. Verified live against a real Pangram result:
  response HTML contained `<mark class="hl-ai">` wrapping the flagged span and the full checked
  text was present and unmodified around it.
- **Floating-window redesign.** The native-popup flows (right-click "Check for AI Content" and the
  floating-icon-on-selection click) previously called `chrome.action.openPopup()`, which Chrome
  auto-closes the instant focus leaves it — the moment the user clicks back into the page to do
  anything with the result, e.g. to select more text or scroll. Replaced with an on-page panel
  (`apps/extension/src/content/ResultPanel.tsx`), a React tree mounted into its own shadow-DOM host
  in the content script, positioned near the original selection when one exists (context-menu
  clicks don't always leave a live selection to anchor to; falls back to a fixed bottom-right
  position) and dismissed only by its own close button. Two architectural changes this required:
  - **Network calls are relayed through the background service worker, not called directly in the
    content script.** A content script's own `fetch`/`XHR` is subject to the host page's CSP; the
    service worker isn't. `background/index.ts` now handles `ai-checker/run-check` and
    `ai-checker/share-check` messages by calling `lib/api.ts`'s `createCheck`/`shareCheck` and
    relaying the response back — the popup, being an actual extension page rather than a content
    script, still calls them directly.
  - **The right-click context menu handler no longer touches the popup at all.** It used to
    `setPendingSelection` + `chrome.action.openPopup()`; it now does
    `chrome.tabs.sendMessage(tab.id, { type: "ai-checker/check-selection", ... })`, and the content
    script itself runs the check and shows the panel. The now-unused `pendingSelection`
    read/write pair (`setPendingSelection`/`consumePendingSelection` in `lib/storage.ts`, and the
    popup's `App.tsx` prefill-on-mount effect) was removed rather than left as dead code — nothing
    sets it anymore, since both flows that used to feed it now go straight to the on-page panel
    instead of the popup.
  - `ResultCard`'s CSS (`.result-card`, `.verdict`, `.breakdown-bar`, `.link-button`, etc.) is
    duplicated as a plain CSS string injected into the panel's own shadow root — shadow DOM
    intentionally blocks the popup's stylesheet from reaching in, so the same class names need
    their own copy of the rules here, kept in sync by hand.

## Visual identity (2026-08-02 rebrand)

Moved off the original orange (`#ea580c`) — user feedback was that it read too close to
Pangram's own branding. Went through a full round-trip with the user (a ChatGPT-authored
navy/teal recommendation was explicitly rejected as "too templated — everyone's AI tool looks
like that now"; landed on a lighter, blue-only palette instead) before implementing. Deliberately
scoped to visuals only — no product renaming (stays "AI Checker," `werida.io` is just the
domain), no logic/workflow changes.

- **Palette**: `--brand: #3d6fe0` / `--brand-dark: #2c56c4` / `--brand-soft: #e8eefc`, `--fg:
  #1a2233`, `--muted: #64748b`, `--border: #e2e8f0`, background pure white throughout — same
  token names in `apps/web/src/app/globals.css` and `apps/extension/src/popup/styles.css`, kept
  in sync by hand as before. **Verdict colors (ai/human/mixed) are explicitly unchanged** —
  user's call: those are semantic, not brand, and were fine as-is.
- **Icon**: a magnifying glass over two lines of varying length (representing text), white on a
  `#3d6fe0` rounded-square chip — user's own concept after rejecting three abstract alternatives
  (a split-circle mark, a checkmark, and minimal text-bars) as "not what I had in mind," then
  five weight/color variants of this one. Source lives at
  `apps/extension/design/icon-source.svg` (32×32, plain rect/circle/line — no complex path
  data, so it stays crisp at 16px) — kept outside `public/` so it isn't picked up by Vite's
  wholesale `public/` → `dist/` copy and doesn't end up shipped inside the packaged extension;
  rasterized to `icon16/48/128.png` via `rsvg-convert` (`brew install librsvg`, no npm dependency
  needed for a one-off raster). Same source copied verbatim to `apps/web/src/app/icon.svg` —
  Next's automatic favicon convention picks it up with zero config; there was no favicon at all
  before this.
- **Typography**: Geist. Web uses the `geist` npm package's `GeistSans` export directly (not
  `next/font/google`) applied via `className` on `<html>` in `layout.tsx`. Extension popup
  self-hosts the single variable-weight woff2 (`node_modules/geist/dist/fonts/geist-sans/
  Geist-Variable.woff2`, ~68KB, covers every weight 100–900) copied to
  `apps/extension/public/fonts/` and loaded via `@font-face` — deliberately not a Google Fonts
  CDN link, so the popup renders instantly offline with no extra network request or CSP
  surface. **The on-page floating panel (`content/index.tsx`'s `PANEL_CSS`) deliberately stays
  on the system font stack** — loading a custom webfont into arbitrary third-party pages via the
  panel's shadow root would need `web_accessible_resources` plumbing for a panel that's only
  visible briefly; not worth it.
- **Layout**: `apps/web`'s `.container` widened from 880px to 1080px, a couple of border-radii
  nudged from 8px to 10px for consistency with `.card`'s existing 12px — light touch only, per
  explicit instruction not to introduce "big unused whitespace." The extension popup's own
  spacing/density is untouched — colors and font only there, no layout changes, since it's
  already tight by necessity (fixed 380px width).
- Verified live: rebuilt both apps cleanly (typecheck + build), confirmed `--brand: #3d6fe0` and
  the Geist `className` in the actually-served HTML/CSS from a local `next dev` run, and visually
  inspected the rasterized icon16.png/128.png directly — the magnifier+lines composition reads
  clearly at both sizes.

## Pre-CWS-review pass (2026-08-02)

A full ecosystem audit ahead of Chrome Web Store submission, plus two workflow changes requested
alongside it.

- **Account Settings** (`/dashboard/account`) now actually exists — `/terms` and `/privacy` had
  promised account deletion and data export "from Account Settings" since the original privacy
  copy was written, but the page was never built. Export streams every check as JSON straight
  through the RLS-scoped browser client; deletion calls a new admin-authenticated route
  (`/api/account/delete`) that deletes the `auth.users` row, cascading to everything owned via the
  FKs already in place. Deletion is **blocked** while an active paid subscription exists — points
  the user to Manage Billing instead of cancelling it on their behalf, because
  `STRIPE_SECRET_KEY` is a restricted key with read-only access to Subscriptions (see the Billing
  section below); the route has no way to call `subscriptions.cancel()` even if it wanted to.
  Verified live: free-plan self-delete cascades correctly, paid-plan attempt gets a clean 409.
- **`activeTab` and `scripting` permissions removed** from the manifest — neither was referenced
  anywhere in the code (the content script is registered declaratively, not injected via
  `chrome.scripting.*`, and nothing reads tab data beyond what `host_permissions`/the
  context-menu callback already hand over for free). Fewer permissions, faster review, a less
  alarming install prompt.
- **Rate limiting**: a Vercel Firewall custom rule on `POST /api/checks` (20 req/60s per IP),
  staged in log-only mode — per Vercel's own staged-rollout guidance, not published to production
  yet. The account owner needs to review real traffic in the Firewall dashboard before switching
  the rule's action from `log` to actually enforcing.
- **Confirmed live** (not just flagged) that Supabase Auth's Site URL was still
  `http://localhost:3000` in production — generated a real signup-confirmation link via the admin
  API (`auth.admin.generateLink`) and read its `redirect_to`. Needs a dashboard fix (Authentication
  → URL Configuration) that the service-role key has no access to make.
- **Pin nudge**: a dismissible banner in the popup (`PinNudge.tsx`) suggesting the user pin the
  extension — Chrome has no API for an extension to pin itself, this is purely instructional.
  Uses `chrome.action.getUserSettings().isOnToolbar` (MV3, Chrome 91+) to only show while it's
  actually still unpinned, rather than a dumb "show once" flag that would nag a user who already
  pinned it or go silent for one who later unpinned it.
- **Both the floating icon and the right-click "Check for AI Content" menu now open the popup
  with the selection prefilled**, instead of running the check silently and showing the on-page
  panel — a full reversal of the floating-panel redesign above, one entry point at a time (the
  floating icon changed first per explicit request; right-click followed once it became clear the
  same "a result just appears in History, with no visible step in between" complaint applied to
  it too). Re-introduces the `pendingSelection` handoff
  (`setPendingSelection`/`consumePendingSelection` in `lib/storage.ts`) that was deleted when the
  panel redesign shipped. Both flows converge on the same `openPopupWithSelection()` helper in
  `background/index.ts` — the floating icon reaches it via an `ai-checker/open-popup-with-selection`
  message (content scripts can't call `chrome.action.openPopup()` directly), while the
  context-menu handler calls it directly, since it's already running in the background.
  **The entire on-page panel is gone** — `content/ResultPanel.tsx` deleted, the panel-hosting
  code stripped from `content/index.tsx`, and the now-unreferenced `ai-checker/run-check`/
  `ai-checker/share-check` background message handlers removed along with it (the popup already
  calls `createCheck`/`shareCheck` directly, being an extension page rather than a content
  script — no CSP to route around). Net effect, confirmed in the build output: the content
  script's bundle shrank considerably and no longer needs `ResultCard` exposed via
  `web_accessible_resources` at all, since that component is now popup-only.

## Billing (Stripe)

- **One Stripe Product per plan** ("AI Checker Pro", "AI Checker Business"), each with one
  monthly Price — per Stripe's own guidance, never put multiple tiers' prices on a single
  Product (every Checkout/invoice line item shows the Product name, so shared tiers would be
  indistinguishable to the customer). `plans.stripe_price_id` maps our plan to Stripe's price.
- **`apps/web/src/lib/stripe.ts`** wraps a single server-only Stripe client. `STRIPE_SECRET_KEY`
  is a **restricted key** (`rk_test_...`), not a full secret key — scoped to only Checkout
  Sessions (write), Customers (write), Subscriptions (read), Customer Portal (write),
  Products/Prices (read). Confirmed live: the RAK correctly succeeds on Checkout Session
  creation and correctly gets `more_permissions_required` on out-of-scope calls (e.g. reading
  account balance, creating a subscription directly) — the restriction is real, not just
  configured and untested.
- **Managed Payments** (Stripe's newer merchant-of-record product, on by default for new
  accounts) is explicitly disabled — `managed_payments: { enabled: false }` — on every Checkout
  Session. Left on, Stripe's "Link" becomes the merchant the customer sees on checkout, receipts,
  and their statement, not AI Checker; disabling it keeps AI Checker as the seller of record,
  matching what's already written into `/terms` and `/privacy`. This flag isn't in this SDK
  version's TS types yet, hence the `as Record<string, unknown>` cast in
  `api/billing/checkout/route.ts`.
- **`POST /api/billing/checkout`**: creates a subscription-mode Checkout Session for a plan,
  reusing the caller's existing `stripe_customer_id` if they have one. Never passes
  `payment_method_types` (Stripe's own anti-pattern warning — it locks out payment methods that
  would otherwise be dynamically offered).
- **`POST /api/billing/portal`**: creates a Customer Portal session so users manage/cancel
  their own subscription without any custom UI. Confirmed live via the Portal's default
  configuration (`bpc_1TybisRouUhCdZVMuTSswHOG`, auto-created by Stripe the first time it was
  used): `subscription_cancel.mode = "at_period_end"` (matches `/terms` — canceling keeps access
  through the current period, doesn't cut it off immediately), but
  `subscription_update.enabled = false` — **customers can't self-serve upgrade/downgrade via the
  Portal today, only cancel.** Changing plans currently only happens through `/pricing`'s
  Checkout flow. Revisit the Portal configuration (`stripe billing_portal configurations`) if
  self-serve plan switching is wanted later.
- **`POST /api/billing/webhook`**: verifies the Stripe-Signature header before doing anything
  (confirmed live: missing or invalid signatures get a `400`, not processed). `invoice.paid` is
  the single source of truth for "what plan is this user actually on" — it covers the initial
  purchase and every renewal (and *would* cover Portal-driven plan changes too, once
  `subscription_update` is enabled — Stripe generates a proration invoice for those the same
  way). Every plan-affecting event updates **both** `subscriptions.plan_id` and
  `credit_balances.plan_id` (+ resets `credits_remaining` to the new plan's `monthly_credits`) —
  these two tables are otherwise independent, and `consume_credit`'s limits come from
  `credit_balances.plan_id`, not `subscriptions.plan_id`.
  - **Dunning (done):** `invoice.payment_failed` marks the subscription `past_due` without
    touching `plan_id` or credits — existing credits keep working (a grace period), but no fresh
    batch arrives until a retry succeeds. This only works because of a companion fix in
    `consume_credit` (`..._consume_credit_no_paid_autotopup.sql`): the function's time-based
    monthly reset now only applies to the Free plan. Before that fix, a paid user whose renewal
    failed would still get a full fresh batch of credits the moment their old period ended,
    regardless of payment status — worth remembering if `consume_credit` is ever touched again.
    `customer.subscription.updated` separately keeps `subscriptions.status` synced for any status
    Stripe reports (recovery back to `active`, `unpaid`, etc.), ignoring statuses outside
    `active/past_due/canceled/trialing/unpaid` (e.g. `incomplete`, `paused`) rather than risking
    a check-constraint violation on an update we didn't anticipate.
- **Verified live** (2026-07-29, in two passes) with real Stripe objects (a real customer, a
  real subscription against the real Pro price, a real invoice) and hand-signed webhook events
  (HMAC-SHA256 per Stripe's documented scheme, using the real signing secret) POSTed to the
  running endpoint:
  - First pass, via an actual browser completing Stripe's hosted Checkout with a test card:
    confirmed the full real flow (not just synthetic events) — real customer, real subscription,
    Pro plan, 500 credits, all correct in the database afterward.
  - `checkout.session.completed` correctly linked `stripe_customer_id`/`stripe_subscription_id`;
    `invoice.paid` correctly set `plan_id` to Pro and topped credits up to 500 with the right
    `current_period_end`; `customer.subscription.deleted` correctly downgraded both tables back
    to Free (10 credits).
  - Dunning pass: manually lapsed a Pro user's `period_end` with 50 credits remaining, fired
    `invoice.payment_failed` — confirmed `status` became `past_due` while `credit_balances` was
    left untouched (still 50, still lapsed). Then called `consume_credit` directly and confirmed
    it decremented normally (50→49) **without** resetting to a fresh 500 — proving the
    `consume_credit_no_paid_autotopup` fix actually closes the gap, not just in theory. As a
    regression check, did the same lapsed-period setup on the Free plan and confirmed it *does*
    still auto-refresh (2→10 credits, then −1). Also confirmed `customer.subscription.updated`
    syncs a recovery to `active`, and safely ignores/logs an unrecognized status (`incomplete`)
    rather than erroring.
  - All test objects (Stripe customers/subscriptions, Supabase users) deleted afterward.
  - **Cancellation keeps what was paid for:** a common subscription expectation, verified live
    rather than assumed. Took a real Pro subscription (used down to 495/500 credits, simulating
    real usage), then called the actual Stripe API `subscriptions.update(cancel_at_period_end:
    true)` — the same call the Customer Portal's Cancel button makes. The real
    `customer.subscription.updated` event that fired left `status` at `active` and `plan_id`,
    `credits_remaining` completely untouched; a further `consume_credit` call right after
    confirmed the account still worked normally (494 remaining). Only once the simulated
    period-end `customer.subscription.deleted` event fired did the downgrade to Free actually
    happen. `subscriptions.cancel_at_period_end` (new column,
    `20260729000010_subscriptions_cancel_at_period_end.sql`) is synced from this same event so
    the dashboard can tell the user plainly "you keep this plan until `<date>`" instead of that
    fact only being true and invisible in Stripe — confirmed live that a real cancel-at-period-end
    call correctly sets it to `true` in the database.
- **Local webhook testing:** `stripe listen --forward-to localhost:<port>/api/billing/webhook`
  prints a `whsec_...` signing secret — different from production's, which comes from a real
  webhook endpoint registered against `https://werida.io/api/billing/webhook` once deployed.

## Live environment

- **Supabase project:** `aichecker` (ref `najbzowkupdhlartoyjk`, region `eu-west-1`). Migrations
  and seed applied via the Supabase CLI (`supabase db push`) against the project's **Transaction
  pooler** connection string — the direct-connection host (`db.<ref>.supabase.co`) is IPv6-only
  on new projects and unreachable from most local networks; the shared pooler
  (`aws-0-<region>.pooler.supabase.com:6543`) is IPv4 by default and free.
- **Stripe account:** "werida sandbox" (`acct_1TyZuTRouUhCdZVM`), test mode. CLI authenticated via
  device-pairing (`stripe login --non-interactive` / `--complete`), 90-day token expiry.
- **Vercel project:** `aichecker`, under the `dmajchro-serwispilot` team (an existing team from a
  prior, unrelated product — confirmed there's no code/data mixing, projects are fully isolated;
  only the Team name leaks into default `*.vercel.app` URLs, which is cosmetic and moot once a
  custom domain is attached). Live at **https://werida.io** (+ `www.werida.io`).
- Real project URLs + keys live only in `apps/web/.env.local` (gitignored, never committed).

## Deployment (Vercel)

- **Root Directory is `apps/web`, and this is load-bearing.** Deploying via `vercel` from inside
  `apps/web` (rather than the repo root) uploads only that subfolder — our npm workspace links
  (`@ai-checker/pangram-client`, `@ai-checker/shared-types`) then resolve to nothing, since npm
  tries to fetch them from the real registry and 404s. Confirmed live: this exact failure
  happened on the first deploy attempt. Fixed by setting the Vercel project's `rootDirectory` to
  `apps/web` (via the REST API, `PATCH /v9/projects/{id}`) and always running `vercel` /
  `vercel --prod` from the **repo root**, not `apps/web` — Vercel installs at the workspace root
  (seeing the full monorepo) and only scopes the build itself to Root Directory.
- **Git integration**: connected to `aiadict/aichecker` on GitHub, production branch `main`.
  Pushes to `main` now deploy to production automatically; other branches get preview
  deployments. This was a deliberate choice, confirmed with the user, since it means every future
  `git push` to `main` goes live with no separate confirmation step.
- **Domain (`werida.io`) was already handling real email** (Hostinger-hosted, MX/SPF/DMARC/DKIM
  records for `hello@`/`support@werida.io`) before we touched DNS — the connection process was
  scoped to avoid any risk to that:
  - Did **not** switch nameservers to Vercel's (`ns1/ns2.vercel-dns.com`) — that would hand over
    all DNS management, including the email records, to Vercel.
  - Only changed one existing record: the apex `A` record, from Hostinger's placeholder IP to
    Vercel's (`76.76.21.21`). Left the existing `CNAME www → werida.io` alone — once the apex
    pointed at Vercel, `www` followed it automatically (confirmed live: `vercel domains verify
    www.werida.io` reported `status: ok` off that same pre-existing record, no DNS change needed
    for `www` at all beyond adding the domain to the Vercel project so a certificate got issued
    for it).
  - Confirmed live, after the DNS change: `dig +short A werida.io` → `76.76.21.21`,
    `vercel domains verify werida.io` → `status: ok`, and both `https://werida.io` and
    `https://www.werida.io` serving `200` once each domain's certificate finished provisioning
    (a short async delay after verification — not instant, don't assume failure if `curl` gets a
    TLS error in the first minute after adding a domain).
- **Environment variables** are set per-environment via `vercel env add <NAME> <production|preview> --value <v> --yes`
  (needs Vercel CLI ≥58; 54.x silently failed on the non-interactive Preview form specifically —
  confirmed live, upgrading fixed it with no other change). `NEXT_PUBLIC_APP_URL` was set to the
  Vercel-assigned URL first (before a domain existed to point it at), then updated to
  `https://werida.io` and production redeployed once the domain was live — Stripe Checkout/Portal
  redirect URLs depend on this being correct.
- **Deployment Protection (Vercel SSO)** is on by default for this team, which makes preview URLs
  return `302` to `vercel.com/sso-api` for anyone without dashboard access — expected, not a bug.
  `vercel curl <url>` proxies through an authenticated bypass token for verifying preview
  deployments from the CLI.

## Extension internals

- **Manifest V3**, permissions: `contextMenus`, `storage`, `sidePanel`, `host_permissions:
  <all_urls>` — each needs an explicit justification string in the Chrome Web Store listing (see
  `docs/privacy-and-legal.md`). `activeTab`/`scripting` were dropped as unused (2026-08-05).
- **Content script** (`src/content/index.tsx`): listens for `selectionchange`; on a selection
  ≥20 chars, renders a shadow-DOM button near the selection. Clicking it messages the background
  worker rather than trying to open the side panel directly — `chrome.sidePanel.open()` isn't
  callable from a content script context.
- **Background service worker** (`src/background/index.ts`): owns the `contextMenus` entry and
  is the only place that calls `chrome.sidePanel.open()` (reliable there, since it runs in direct
  response to a user-gesture event — the menu click or the forwarded message).
- **UI** (`src/panel/`): React app, side panel (not a popup — see the 2026-08-07 section below),
  three tabs (Check for AI / History / Settings) switched via an icon bar, reads any pending
  selection out of `chrome.storage.session` on mount.

## Side panel migration (2026-08-07)

Replaced the toolbar popup (`chrome.action.default_popup`, closed on blur) with Chrome's **Side
Panel API** — a persistent panel docked to the browser edge that stays open across navigation and
doesn't close when the user clicks back into the page. User's own call after seeing Copyleaks'
extension use one; scoped and mocked up (a static HTML/CSS comparison of the default and Settings
states) before touching real code.

- **`src/popup/` renamed to `src/panel/`** — mechanical rename, "popup" was actively wrong once
  there wasn't one.
- **Manifest**: `action: {}` (deliberately no `default_popup` — setting one wins over side panel
  behavior for the toolbar-icon click, silently, so its absence is load-bearing, not
  incidental), new `side_panel: { default_path: "src/panel/index.html" }`, `sidePanel` added to
  `permissions`.
- **`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`**, called once in
  `onInstalled` (same place `contextMenus.create` already lived) — makes the toolbar icon open
  the panel with no separate click listener needed.
- **Every entry point now opens the side panel**, confirmed as the explicit intent, not a
  default: toolbar-icon click (native, via the behavior setting above), the floating icon, and
  the right-click "Check for AI Content" menu (both via a renamed
  `ai-checker/open-panel-with-selection` message into a single `openSidePanelWithSelection()`
  helper in `background/index.ts` — same `chrome.sidePanel.open({ windowId })` call either way,
  the floating icon just has to reach it via a message since content scripts can't call it
  directly).
- **Chrome renders its own header above our content** — extension icon, name, a native pin
  icon, and (Chrome 141+) a native close control — confirmed against the official API reference,
  not assumed. This directly removed scope rather than adding it:
  - `Header.tsx` no longer renders a logo/name row, just the credits line — duplicating what
    Chrome already shows would've been redundant.
  - The custom `PinNudge.tsx` banner (built one session earlier, before this migration was
    on the table) was deleted outright along with its `chrome.storage` keys — it existed to
    solve toolbar-icon discoverability for a popup; the side panel's pin control is native and
    always visible, so there's no discovery problem left to nudge about.
  - No custom "×" close button was built either, for the same reason — Chrome's native one
    already covers it.
- **Bottom nav**: the three text tabs became a 4-icon bar (Check / History / Contact / Settings).
  Contact opens `${API_BASE_URL}/support` in a new tab — that page doesn't exist yet, deliberately
  deferred. A 5th "Rate us" icon was scoped but is **not** included yet — its destination is a
  Chrome Web Store review URL, which only exists once the extension has a real listing ID from
  actually being published; there's nothing to link to yet.
  - Settings now fully replaces the textbox/button/result area rather than living alongside it
    (confirmed explicitly) — clicking the now-grayed-out Check icon is what navigates back,
    same toggle mechanism the old text tabs used, just icon-driven.
- **`ResultCard` gained an optional `onClose`** — a "×" the user can click to dismiss a result
  without needing to run a new check to clear it, wired in `CheckForAiTab.tsx` via
  `setResponse(null)`. `ResultPanel.tsx`'s own copy of this component died with it back in the
  on-page-panel removal, so `ResultCard` has exactly one caller now.
- **CSS**: dropped the popup's fixed `width: 380px` for `min-width: 280px` — a side panel is
  user-resizable, unlike a fixed-size popup, so the layout needs to be fluid rather than assuming
  one width.
- **Not verified by us**: whether the toolbar click / floating icon / right-click flows actually
  open the panel correctly, and whether Chrome's native header renders the way the API reference
  described, both need a live Chrome test — there's no way to drive the browser's side panel UI
  from here to confirm it directly.

## Why this shape (vs. alternatives considered)

- Supabase over a bespoke Postgres+Auth stack: bundles Postgres, Auth (incl. Google OAuth), and
  Storage in one place with generous RLS support — avoids building auth from scratch for an MVP.
- Next.js API routes over a separate Express service: one deploy target (Vercel), one repo to
  reason about, and the same framework serves the marketing site, dashboard, and API.
- In-page shadow-DOM overlay over `chrome.action.openPopup()` for the floating icon: the native
  popup API is gated to direct user-gesture contexts the content script doesn't reliably have;
  the overlay approach (same pattern Grammarly uses) sidesteps that entirely.

## Free plan: daily cap disabled, monthly credits 10 -> 25 (2026-08-09)

First-iteration growth decision: keep signup as low-friction as possible for early Chrome Web
Store traction, no daily-limit pressure and a more generous monthly allowance, revisit once
there's a real user base. Both changes are pure data — `supabase/seed.sql`'s free plan row now
has `monthly_credits = 25, daily_cap = null` (matches how Pro/Business have always had
`daily_cap = null`), applied live via a direct `plans` table update, no migration needed since
the schema/columns already existed.

No code changed anywhere for this. `consume_credit()` (see
`20260729000005_consume_credit_fn.sql`) already skips its daily-cap check whenever
`daily_cap is null` — that's not new logic, Pro/Business have relied on it since launch. Every UI
surface that shows a daily count (`Header.tsx`'s "N left today", the dashboard's "N checks/day")
was already written to only render when `dailyCap` is non-null, for the same reason. Flipping the
one value both stopped enforcement and hid the UI in one move; setting `daily_cap` back to a
number later re-enables both, again with no code changes.

Existing users' `credit_balances.credits_remaining` isn't backfilled — someone mid-cycle keeps
whatever balance they already had (now displayed against the new "/25" denominator) until their
next monthly reset actually tops them up to 25, same as any other live `monthly_credits` change
always has.

## Chrome Web Store release status

- **v1.0.0** — approved and published (archived at `apps/extension/releases/v1.0.0/`).
- **v1.1.0** — packaged and shipped (`apps/extension/releases/v1.1.0/`); superseded by v1.2.0
  before it was otherwise noted here.
- **v1.2.0** — packaged from a clean build (confidence badge + collapsible highlighted text,
  History tab sign-in prompt, `/resultsupport` link) and **submitted to the Chrome Web Store for
  review on 2026-09-13**. Per the dashboard's own confirmation dialog: status is checked on the
  developer dashboard home page, and items staged to publish later expire 30 days after passing
  review. Archive at `apps/extension/releases/v1.2.0/ai-checker-extension-v1.2.0.zip`.
  **The Chrome Web Store listing's own "What's new" / description field was never updated for
  this version** — the submission on 2026-09-13 went out without release notes.
- **v1.2.1** — packaged (`apps/extension/releases/v1.2.1/ai-checker-extension-v1.2.1.zip`, 128
  files, no secrets/junk in the bundle, `manifest.json` confirmed reading `1.2.1`, no new
  permissions needed) and **submitted to the Chrome Web Store for review on 2026-09-18**.
  Changes in this release, in order:
  1. Trial-exhausted message in `CheckForAiTab.tsx` ("You've used your 2 free checks - sign in
     to keep going.") was easy to miss — plain `.muted` gray text, the only signal after the
     Check-for-AI button silently goes back to its resting state. Now its own bold, warning-red
     `.trial-exhausted-notice` class (same red already used for `badge.ai` /
     `confidence-badge.low`).
  2. `SettingsTab.tsx` redesigned to match the rest of the panel's card-based visual language
     (bordered/rounded `.settings-card`s, a filled `.settings-card-account` card, a real
     `.credits-badge` pill, a proper `.switch` toggle instead of a bare checkbox) instead of its
     old plain stacked-rows layout — same underlying data and copy throughout, no hardcoded
     values. Extracted `lib/useAccountStatus.ts` out of `Header.tsx` so both it and the new
     Account card's credits badge read from one shared fetch instead of two independent (and
     driftable) copies of the same logic.
  3. "Open web checker" (`PanelSectionHeader.tsx`) now opens the real, hosted `werida.io/check`
     instead of the extension's own internal `?standalone=1` page — see "Hosted web checker at
     /check" below for the full story. This also removed the standalone-mode code it made dead:
     `isStandalone` in `App.tsx`, `.panel-root.standalone`/`.standalone-brand*` CSS, and the
     `standalone` prop previously threaded through
     `Header`/`CheckForAiTab`/`PanelSectionHeader`/`ResultCard`. Verified live: a loaded unpacked
     copy's "Open web checker" opens `https://werida.io/check` in a new tab.
  4. Resize-hint banner repositioned (directly under "Check for AI" instead of below the
     star-rating prompt) with new copy ("Need more space?" / "Drag the panel's left edge to
     make it wider.") and a clearer icon (arrows splayed off a vertical bar, gently animated
     side-to-side, `prefers-reduced-motion`-respecting) — the old version was easy to skim past
     entirely.

**"What's new" / listing description: deliberately left unchanged for this submission** — the
user's own explicit call (2026-09-18): the existing description is working, and editing it
wasn't worth the risk of touching something that's fine as-is. Applies retroactively to v1.2.0's
missing notes too — not an oversight to fix next time, a decision. This section (the numbered
list above, and v1.2.0's own entry) is the durable record of what actually shipped in each
version instead.

## UI conventions: sticky, scroll-spied section nav (2026-09-17)

**Standard component for in-page navigation on long single-page content: `apps/web/src/app/components/SectionNav.tsx`.**
Renders a pill-style nav (same visual language as the old static `support-jumpnav` links) that
goes `position: sticky` under the site header once scrolled to, and highlights whichever
section is currently in view as the reader scrolls — no page reload, no separate route per
section. In use on `/support` and `/resultsupport`.

Modeled on a reference help-page the user liked (`AI_Checker_Understanding_Results.html`,
supplied 2026-09-17) for the sticky + scroll-spy *behavior* specifically — the visual style
(pill nav, brand colors) stayed ours rather than adopting that page's tab-underline look, to
keep it consistent with the rest of the site.

**Usage**: pass `sections={[{ id, label }, ...]}` matching `id`s already present on the
page's own `.card` elements (or any element with that `id`) — the component does the sticky
positioning and active-section tracking, the page just needs the anchors to exist. `.card`'s
`scroll-margin-top` is set globally (84px) so an anchor jump clears the sticky bar; this is a
harmless no-op on pages that don't use `SectionNav`.

**Decision: this is the one nav pattern for this kind of page.** The next time a long,
section-heavy help/reference page needs in-page navigation, reuse `SectionNav` rather than
building a new one-off — don't hand-roll another static jump-nav or a different sticky
implementation.

## Hosted web checker at /check (2026-09-18)

**What it is**: a real, hosted `werida.io/check` page (`apps/web/src/app/check/page.tsx`)
replicating the extension's "paste text, check it, see the result" flow — usable directly on
the web, no extension required. Planned via a full plan-mode pass (two research agents mapping
the extension's panel and the web app's routes/nav/auth, one design agent stress-testing the
approach) before any code was written — see the git history around this date for the full
rationale if it's ever needed again.

**Why it exists**: the extension's "Open web checker" link (`PanelSectionHeader.tsx`) used to
just open the extension's own bundled page in a full tab
(`chrome-extension://<id>/src/panel/index.html?standalone=1`) — not a real website page at all.
There was no web-hosted checking experience anywhere on werida.io; `/dashboard`/`/dashboard/history`
were (and remain) read-only views of past checks, both literally telling the user to go use the
extension.

**Zero backend changes.** `/check` calls the exact same `POST /api/checks` /
`POST /api/parse-file` the extension always has — both already fully supported an anonymous
path (`X-Device-Id` → `anonymous_trials`/`consume_trial_credit`) and already sent
`Access-Control-Allow-Origin: *` (`next.config.js`), specifically because auth here is a Bearer
token verified per-request (`getAuthenticatedUser` in `lib/auth.ts`), not an origin/cookie trust
model — a plain werida.io page calling these is exactly as legitimate a caller as the extension
always has been.

**New pieces**:
- `apps/web/src/lib/device-id.ts` — a `localStorage`-based `getOrCreateDeviceId()`, the web
  equivalent of the extension's `chrome.storage.local`-based one
  (`apps/extension/src/lib/storage.ts`). `chrome.storage` is extension-sandboxed and
  unreachable from a normal page, so this is necessarily a **separate anonymous-trial pool**
  from the extension's own — a visitor using both gets two independent 2-credit trials, not a
  shared one. Accepted platform limitation, not a bug to chase.
- `apps/web/src/app/check/page.tsx` — the form itself (textarea, word/credit counter, file
  upload w/ drag-drop, submit, loading/error/trial-exhausted states), a web-native port of
  `apps/extension/src/panel/tabs/CheckForAiTab.tsx`'s logic. Grabs the current cookie-based
  Supabase session client-side (`getSupabaseBrowserClient().auth.getSession()`) and forwards
  `session.access_token` as a manual `Authorization: Bearer` header on a plain `fetch()` — this
  is *new* usage of that existing client primitive, not a literal copy of an existing pattern
  elsewhere (e.g. `reset-password/page.tsx` only ever calls SDK methods directly, never attaches
  a Bearer header to a raw fetch itself).
- `apps/web/src/app/history/[slug]/components/CheckResultView.tsx` — the verdict/%/confidence
  badge/breakdown-bar/legend/insight/`PositionalBar`/highlighted-text block, extracted out of
  `/history/[slug]/page.tsx` (which had it all inlined) into a pure presentational component
  taking `CheckResult`'s own fields directly. Used by both `/history/[slug]` (DB-row-backed) and
  `/check` (the `CheckResult` object `/api/checks` already returns directly, no row-mapping
  needed) — same result rendering wherever a check is viewed, one implementation instead of two.

**Navigation**: `Check` added to `SiteNav.tsx` (first, before Pricing) — the "Add to Chrome"
CTA is untouched, extension install stays the primary funnel goal, `/check` is additive. Homepage
gained a secondary "Or try it now in your browser →" link under the existing hero CTA (also
untouched). `/dashboard` gained a "Run a new check" link (previously had *no* way to start a new
check at all); both `/dashboard` and `/dashboard/history`'s empty-states now mention it too.
Also fixed while in `page.tsx`: the homepage's "Free plan includes 10 checks a month" line was
stale (the actual free-plan allowance became 25,000 words/25 credits back in the 2026-08-09
pass) — corrected to match.

**Product framing, stated plainly, not glossed over**: yes, this lets someone check text with
zero install. But the extension's differentiated value was never the checking UI — it's the
in-page trigger (select text anywhere, right-click, the floating icon), which a paste-and-submit
web form structurally cannot replicate. `/check` is a complementary top-of-funnel surface: try
real detection quality with no friction, then convert to the extension for the frictionless
in-page flow.

**Sequencing — deliberately staged, not big-bang**: this pass shipped `/check` itself plus the
`CheckResultView` extraction and nav additions first — the extension's `PanelSectionHeader.tsx`
was deliberately left untouched until `/check` had been confirmed solid in production. Once
that held up (real anonymous checks, file upload, mobile, the History nav link, the sign-in
nudge/link fixes above), a follow-up pass (2026-09-18) repointed "Open web checker" at
`werida.io/check` and removed the standalone-mode code that repoint made dead (`isStandalone`
in `App.tsx`, `.panel-root.standalone`/`.standalone-brand*` CSS, the `standalone` prop
previously threaded through `Header`/`CheckForAiTab`/`PanelSectionHeader`/`ResultCard`) — see
the Chrome Web Store release status section's v1.2.1 entry. Kept as two separate changes
rather than one big-bang, so a problem in either was independently isolatable.

**Abuse-surface note**: `/check` doesn't expose anything technically new (see "zero backend
changes" above), but it does turn "reachable via curl if you know the shape" into "one click
from the homepage," meaningfully raising realistic traffic against the existing shared
`DAILY_ANON_CREDIT_CAP = 200` credits/day (`apps/web/src/lib/anonymous-trial.ts`). Worth
watching `api_usage_log`'s anonymous spend in the weeks after launch and raising/splitting that
cap if `/check` traffic starts crowding out the extension's own anonymous users.

**Verified live** (2026-09-18, real preview deployment, real anonymous device): ran an actual
check with no session — trial correctly decremented 2 → 1, result rendered correctly via
`CheckResultView` (verdict/breakdown/highlighted text all present and styled correctly), file
upload (`.txt`) correctly populated the textarea, mobile viewport (390px) rendered cleanly with
no overflow. **Not independently re-verified live**: `/history/[slug]`'s post-extraction
rendering specifically — every existing check in the database is private, and flipping one
public (or creating/deleting a throwaway test account) to check it live was blocked by this
environment's own safety guard against mutating production auth/data without explicit sign-off.
Confidence here instead comes from: the extraction changed no logic, only moved existing,
already-proven JSX into a component with matching prop types (`tsc`+`next build` both clean),
and `/check` renders the literal same `CheckResultView` component with the same prop shape,
proven live above. Worth a human spot-check of any real `/history/[slug]` link next time one's
handy.
