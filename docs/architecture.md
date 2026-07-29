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

## Data flow: a "Check for AI" action

1. User pastes text, selects text (floating icon), or right-clicks (context menu) in
   `apps/extension`.
2. Extension sends `{ text, sourceUrl }` to `POST /api/checks` on `apps/web`, with the cached
   Supabase session token as a Bearer header.
3. API route (`apps/web/src/app/api/checks/route.ts`, currently backed by an in-memory mock
   store — see TODOs inline):
   - Verifies auth.
   - Looks up the user's plan + `credit_balances` row.
   - Rejects with `insufficient_credits` / `daily_cap_reached` if the user is over their limit.
   - Calls `PangramClient.predict()` (mocked until `PANGRAM_API_KEY` is set).
   - Records `credits_used = ceil(word_count / 1000)`, inserts into `checks` (+`check_windows`),
     decrements `credit_balances`, and logs real cost into `api_usage_log` (service-role only —
     this is how we watch for the "losing money on API usage" risk).
4. Response returned to the extension; also visible in the web dashboard's History
   (`/dashboard/history`) and via the check's public share link (`/history/[slug]`) if the user
   opts to share it.

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
