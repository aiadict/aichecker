# AI Checker — Architecture

## Stack

Next.js (marketing site + dashboard + API routes) on Vercel, Supabase (Postgres + Auth +
Storage), Stripe for billing, Chrome MV3 extension (Vite + React + `@crxjs/vite-plugin`).

## Monorepo layout

```
apps/
  web/                  Next.js app: marketing, dashboard, auth, API routes, /privacy, /terms
  extension/            Chrome MV3 extension — talks only to apps/web, never to Pangram directly
packages/
  shared-types/         Shared TS types (Plan, CheckResult, User, API request/response contracts)
  pangram-client/       Server-only Pangram API wrapper — imported by apps/web ONLY
supabase/
  migrations/           SQL schema (see below)
  seed.sql              Seeds the free/pro/business plan rows
docs/                   This file + product-spec.md + privacy-and-legal.md
scripts/
  estimate-margin.ts    Recomputes plan margin against the current Pangram $/credit
```

## The one hard security rule

**The Pangram API key must never exist anywhere a browser extension bundle can be inspected.**
MV3 extension code is fully readable by any user via `chrome://extensions` → "Inspect". So:

- `packages/pangram-client` is imported **only** from `apps/web`'s server-side code (API
  routes). It reads `PANGRAM_API_KEY` from `process.env`, never from a request or client bundle.
- `apps/extension` never imports `@ai-checker/pangram-client`. It only ever calls our own
  backend (`apps/web`'s `/api/*` routes), authenticated with a Supabase session token cached in
  `chrome.storage.local`.

## Auth flow: extension sign-in

The extension never implements its own OAuth/password UI. Instead:

1. Extension's Settings tab "Sign in" opens `apps/web`'s `/login?source=extension` in a new tab.
2. `/login` (`apps/web/src/app/login/page.tsx`) is a client component that calls Supabase Auth
   directly (email/password today; the same handoff works for any provider added later) using
   the browser client (`lib/supabase/client.ts`, public anon/publishable key — safe to ship).
3. On success, if `source=extension`, the page does `window.postMessage({ type:
   "ai-checker/auth-success", accessToken, refreshToken }, origin)` **on itself** — not a
   redirect, not localStorage.
4. `apps/extension`'s content script (`src/content/index.ts`) is injected on `<all_urls>`
   already; when its own `window.location.origin` matches our web app's origin, it adds a
   `message` listener for exactly this event and relays it to the background worker via
   `chrome.runtime.sendMessage`, which persists it (`lib/storage.ts`'s `setAuthSession`).
   Content scripts run in an "isolated world" and can't read the page's `localStorage`, but they
   do share the DOM/window, so same-window `postMessage` crosses that boundary cleanly.
5. Every subsequent extension → `apps/web` API call sends the stored `accessToken` as
   `Authorization: Bearer <token>`; `apps/web/src/lib/auth.ts`'s `getAuthenticatedUser` verifies
   it against Supabase Auth (`supabase.auth.getUser(token)`) on every request.

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
   - Calls `PangramClient.predict()`.
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

## Database schema (Supabase Postgres)

See `supabase/migrations/20260729000001_init_schema.sql` for the authoritative DDL. Summary:

```
users               mirrors auth.users — id, email, display_name
plans               THE pricing/credit config table — key, monthly_credits, daily_cap,
                     price_cents, stripe_price_id, features jsonb. Edit rows here to retune
                     pricing; never hardcode credit amounts in application code.
subscriptions       user's current plan + Stripe subscription state
credit_balances     the running "x/y" meter shown in the extension header
checks              one row per check (text snippet, verdict, fractions, source_url,
                     share_slug, is_public)
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

## Live environment

- **Supabase project:** `aichecker` (ref `najbzowkupdhlartoyjk`, region `eu-west-1`). Migrations
  and seed applied via the Supabase CLI (`supabase db push`) against the project's **Transaction
  pooler** connection string — the direct-connection host (`db.<ref>.supabase.co`) is IPv6-only
  on new projects and unreachable from most local networks; the shared pooler
  (`aws-0-<region>.pooler.supabase.com:6543`) is IPv4 by default and free.
- Real project URL + keys live only in `apps/web/.env.local` (gitignored, never committed).

## Extension internals

- **Manifest V3**, permissions: `contextMenus`, `storage`, `activeTab`, `scripting`,
  `host_permissions: <all_urls>` — each needs an explicit justification string in the Chrome Web
  Store listing (see `docs/privacy-and-legal.md`).
- **Content script** (`src/content/index.ts`): listens for `selectionchange`; on a selection
  ≥20 chars, renders a shadow-DOM button near the selection. Clicking it messages the background
  worker rather than trying to open the popup directly — `chrome.action.openPopup()` from a
  content script context is unreliable across Chrome versions.
- **Background service worker** (`src/background/index.ts`): owns the `contextMenus` entry and
  is the only place that calls `chrome.action.openPopup()` (reliable there, since it runs in
  direct response to a user-gesture event — the menu click or the forwarded message).
- **Popup** (`src/popup/`): React app, three tabs (Check for AI / History / Settings), reads any
  pending selection out of `chrome.storage.session` on mount.

## Why this shape (vs. alternatives considered)

- Supabase over a bespoke Postgres+Auth stack: bundles Postgres, Auth (incl. Google OAuth), and
  Storage in one place with generous RLS support — avoids building auth from scratch for an MVP.
- Next.js API routes over a separate Express service: one deploy target (Vercel), one repo to
  reason about, and the same framework serves the marketing site, dashboard, and API.
- In-page shadow-DOM overlay over `chrome.action.openPopup()` for the floating icon: the native
  popup API is gated to direct user-gesture contexts the content script doesn't reliably have;
  the overlay approach (same pattern Grammarly uses) sidesteps that entirely.
