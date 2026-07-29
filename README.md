# AI Checker

A Chrome extension + web dashboard that detects AI-generated text, powered by the official [Pangram](https://www.pangram.com) API.

> Full product spec, architecture, database schema, and pricing rationale live in [`docs/product-spec.md`](docs/product-spec.md) and [`docs/architecture.md`](docs/architecture.md). Read those before making structural changes.

## ⚠️ Required before this does anything real

1. ~~**`PANGRAM_API_KEY`**~~ ✅ Done — real key wired into `packages/pangram-client`, and now fully verified end to end (the Pangram account has prepaid credits as of the Supabase integration work).
2. ~~**Supabase project**~~ ✅ Done — project `aichecker` live (ref `najbzowkupdhlartoyjk`, region `eu-west-1`). Real auth (Supabase Auth, email/password) and DB are wired into `/api/checks`, `/api/me`, and the `/dashboard` pages (cookie-based session via `@supabase/ssr`, protected by `middleware.ts`) — all verified end to end with real signed-up users. `lib/mock-store.ts` is gone; nothing reads fake data anymore. Token refresh is also wired up (extension retries once on a 401 using the stored refresh token).
3. ~~**Stripe account**~~ ✅ Done (test mode) — account "werida sandbox". `/api/billing/{checkout,portal,webhook}` built and verified end to end with real Stripe objects + hand-signed webhook events (checkout → invoice.paid → cancellation all confirmed updating the DB correctly). Uses a **restricted** API key (not a full secret key) and explicitly disables Stripe's new Managed Payments product so AI Checker — not Stripe/Link — is the merchant of record customers see. Still needed before a real launch: live-mode keys/products/webhook, and a real subscription/refund policy in `/terms` (currently "TODO").
4. ~~**Domain name**~~ ✅ Done — `werida.io`, contact aliases `hello@werida.io` / `support@werida.io`. `NEXT_PUBLIC_APP_URL` should be `https://werida.io` in production.
5. ~~**GitHub repo**~~ ✅ Done — [github.com/aiadict/aichecker](https://github.com/aiadict/aichecker).

## Layout

```
apps/web/            Next.js marketing site + dashboard + API routes (talks to Pangram, Supabase, Stripe)
apps/extension/       Chrome MV3 extension (talks only to apps/web, never to Pangram directly)
packages/shared-types/  Shared TypeScript types used by both apps
packages/pangram-client/ Server-only Pangram API wrapper (falls back to a mock only if PANGRAM_API_KEY is unset)
supabase/             SQL migrations + seed data (plans, credit economics)
docs/                 Product spec, architecture, privacy/legal checklist
scripts/              Utility scripts (e.g. margin estimator for plan pricing)
```

## Getting started (local dev)

```bash
npm install
npm run dev:web         # http://localhost:3000 — real Pangram + Supabase if apps/web/.env.local is filled in, mocked otherwise
npm run dev:extension   # builds to apps/extension/dist — load unpacked in chrome://extensions
```

To sign in: open `http://localhost:3000/login` (or the extension's Settings tab → Sign in, which opens the same page with `?source=extension` so the session hands off to the extension automatically).

## Why a monorepo, why this split

The Pangram API key must live server-side only — a Chrome extension's code is fully inspectable by any user (`chrome://extensions` → Inspect), so it can never hold a paid API credential. `apps/web` is the only thing that talks to Pangram; `apps/extension` talks only to `apps/web`. See `docs/architecture.md` for the full data flow.
