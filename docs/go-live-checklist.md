# Go-Live Checklist — Stripe & Production

Everything Stripe-related today runs in **test mode** against the "werida sandbox" account
(`acct_1TyZuTRouUhCdZVM`). This tracks exactly what has to change to accept real payments — don't
do any of this until the user says so; real credentials get provided when the rest of production
(domain deployment, live-mode account activation) is actually ready.

## 1. Activate live mode on the Stripe account

Stripe requires business details (legal entity, bank account for payouts, tax info) before
live-mode charges are allowed at all. This has to happen in the Dashboard — no CLI/API shortcut.

- [ ] Complete business profile + bank account under **Settings → Account details**
- [ ] Confirm live mode is actually enabled (Dashboard shows a "Test mode" toggle — it must be
      off, and Stripe must have approved the account for live charges)

## 2. Re-create Products/Prices in live mode

Test-mode and live-mode objects are **entirely separate** — nothing carries over automatically.

- [ ] Re-run the same `stripe products create` / `stripe prices create` commands used for test
      mode (see `docs/architecture.md`'s Billing section for the exact names/descriptions used:
      "AI Checker Pro" $49/mo, "AI Checker Business" $199/mo), but authenticated against live mode
      (`stripe login` defaults to whichever mode is active, or pass `--live` — confirm current CLI
      behavior before running)
- [ ] Update `supabase/seed.sql`'s `stripe_price_id` values to the new live-mode price IDs (they
      will NOT match the test-mode ones currently in there) and re-push via `supabase db push
      --include-seed`, or patch `plans.stripe_price_id` directly via the Data API like was done
      for test mode

## 3. Create a live-mode Restricted API Key

Same minimal permission set as the test-mode RAK, created fresh (RAKs are also mode-specific):

- [ ] Developers → API keys → Create restricted key (live mode): Checkout Sessions (write),
      Customers (write), Subscriptions (read), Customer Portal (write), Products/Prices (read)
- [ ] Set as `STRIPE_SECRET_KEY` in the **production** environment only (Vercel env vars, not
      `.env.local` — that file is for local dev against test mode)

## 4. Register a real webhook endpoint

Local dev used `stripe listen` (ephemeral, only works while that CLI process is running). A
deployed app needs a real, permanent webhook endpoint.

- [ ] Dashboard (live mode) → Developers → Webhooks → Add endpoint:
      `https://werida.io/api/billing/webhook`
- [ ] Subscribe it to exactly: `checkout.session.completed`, `invoice.paid`,
      `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
      (the same five the local `stripe listen` command was scoped to — see
      `docs/architecture.md`)
- [ ] Copy that endpoint's signing secret into production's `STRIPE_WEBHOOK_SECRET` — **this is a
      different value from the local dev one**, don't reuse it

## 5. Decide on self-serve plan switching (optional, not blocking)

Discovered while testing: the Customer Portal's default configuration has
`subscription_update.enabled = false` — customers can cancel via the Portal but can't currently
upgrade/downgrade between paid tiers there (only via `/pricing`'s Checkout flow). Fine to launch
without this; revisit `stripe billing_portal configurations update` if self-serve switching is
wanted later.

## 6. Legal / compliance pass before real money moves

- [ ] Have `/terms` and `/privacy` actually reviewed by a lawyer — the current wording is
      reasonable, standard SaaS language, but hasn't had formal legal review
- [ ] Confirm the refund policy in `/terms` reflects the business's actual final decision (current
      wording: no partial refunds, case-by-case exceptions at `support@werida.io`'s discretion)
- [ ] Decide whether Stripe Tax needs to be turned on (sales tax/VAT/GST collection) — currently
      off entirely; per Stripe's own guidance, enabling `automatic_tax` without an active tax
      registration silently collects $0 tax while looking like it's working, so don't flip this on
      without a registration in place first

## 7. Update environment-specific config

- [ ] `NEXT_PUBLIC_APP_URL=https://werida.io` in the production environment (used to build
      Checkout `success_url`/`cancel_url` and Portal `return_url`)
- [ ] Confirm CORS behavior in `next.config.js` still makes sense once the extension is
      distributed via the Chrome Web Store (currently allows any origin on `/api/*`, which is
      intentional — see the comment there — but worth a second look at launch)

## What we'll need from the user when this is ready

- Live-mode `STRIPE_SECRET_KEY` (restricted key)
- Live-mode `STRIPE_WEBHOOK_SECRET` (from the registered production endpoint)
- Live-mode `STRIPE_PRICE_ID_PRO` / `STRIPE_PRICE_ID_BUSINESS`
- Confirmation that Stripe has approved the account for live charges
