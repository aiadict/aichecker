# AI Checker

A Chrome extension + web dashboard that detects AI-generated text, powered by the official [Pangram](https://www.pangram.com) API.

> Full product spec, architecture, database schema, and pricing rationale live in [`docs/product-spec.md`](docs/product-spec.md) and [`docs/architecture.md`](docs/architecture.md). Read those before making structural changes.

## ⚠️ Required before this does anything real

This is scaffolding built against **mocked** Pangram responses. Nothing will call the real API, create a real user, or charge a real card until the following are filled in:

1. **`PANGRAM_API_KEY`** — TODO, to be provided later in development. See `.env.example`. Do not skip wiring this in once received — `packages/pangram-client` is the only place it should ever be read, and it must never end up in `apps/extension`'s bundle.
2. **Supabase project** — create one at supabase.com, run `supabase/migrations`, then `supabase/seed.sql`.
3. **Stripe account** (test mode) — for `apps/web`'s billing routes.
4. **Domain name** — needed for the privacy policy URL (Chrome Web Store listing + Google OAuth verification both require it).
5. **GitHub repo** — this monorepo gets pushed once credentials are provided.

## Layout

```
apps/web/            Next.js marketing site + dashboard + API routes (talks to Pangram, Supabase, Stripe)
apps/extension/       Chrome MV3 extension (talks only to apps/web, never to Pangram directly)
packages/shared-types/  Shared TypeScript types used by both apps
packages/pangram-client/ Server-only Pangram API wrapper (mocked until PANGRAM_API_KEY exists)
supabase/             SQL migrations + seed data (plans, credit economics)
docs/                 Product spec, architecture, privacy/legal checklist
scripts/              Utility scripts (e.g. margin estimator for plan pricing)
```

## Getting started (local dev, mocked mode)

```bash
npm install
npm run dev:web         # http://localhost:3000
npm run dev:extension   # builds to apps/extension/dist — load unpacked in chrome://extensions
```

## Why a monorepo, why this split

The Pangram API key must live server-side only — a Chrome extension's code is fully inspectable by any user (`chrome://extensions` → Inspect), so it can never hold a paid API credential. `apps/web` is the only thing that talks to Pangram; `apps/extension` talks only to `apps/web`. See `docs/architecture.md` for the full data flow.
