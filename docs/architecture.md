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
- Real project URLs + keys live only in `apps/web/.env.local` (gitignored, never committed).

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
