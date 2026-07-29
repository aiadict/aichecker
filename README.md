# AI Checker

A Chrome extension + web dashboard that detects AI-generated text, powered by the official [Pangram](https://www.pangram.com) API.

> Full product spec, architecture, database schema, and pricing rationale live in [`docs/product-spec.md`](docs/product-spec.md) and [`docs/architecture.md`](docs/architecture.md). Read those before making structural changes.

## ⚠️ Required before this does anything real

1. ~~**`PANGRAM_API_KEY`**~~ ✅ Done — real key wired into `packages/pangram-client`, and now fully verified end to end (the Pangram account has prepaid credits as of the Supabase integration work).
2. ~~**Supabase project**~~ ✅ Done — project `aichecker` live (ref `najbzowkupdhlartoyjk`, region `eu-west-1`). Real auth (Supabase Auth, email/password) and DB (migrations + seed) are wired into `/api/checks` and `/api/me` — verified end to end with a real signed-up user: signup bootstrap trigger, atomic credit consumption (incl. daily-cap enforcement), a real Pangram prediction, and history all confirmed against the live database. `apps/web/src/lib/mock-store.ts` is now only used by the `/dashboard` pages (not yet wired to real auth/DB — see docs/architecture.md).
3. **Stripe account** (test mode) — for `apps/web`'s billing routes.
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
