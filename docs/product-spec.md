# AI Checker — Product Spec

Source research: Pangram's Chrome Web Store listing (5.0★, 19 ratings, 20,000 users, v2.8.1,
"Productivity > Tools"), pangram.com marketing/pricing/API pages, pangram.com/privacy-policy,
and the 20 screenshots in `content/pangram_screenshots/` documenting Pangram's install flow,
popup UI, result cards, and settings. Competitor scan: GPTZero, Winston AI, Originality.ai,
Copyleaks.

## 1. What we're building

**AI Checker** is a Chrome extension + web dashboard that tells you, instantly, whether text was
written by a human or generated/assisted by AI — without leaving the page you're on. It uses the
official Pangram API as its detection engine rather than an in-house model.

## 2. Phase 1 (MVP) feature set

- **Check for AI** popup: paste/type text, get an AI/Human/Mixed verdict with a percentage
  breakdown (AI / AI-assisted / Human), styled after Pangram's radial gauge UI (see screenshots
  6-8).
- **Right-click anywhere**: highlight text → right-click → "Check for AI Content" → instant
  result. Uses Chrome's `contextMenus` API — same UX Pangram ships (screenshot 5's "Express
  Check" callout).
- **Selection floating icon** (differentiator, Pangram doesn't have this): selecting text on any
  page shows a small rounded button near the selection; clicking it opens the extension UI with
  the text auto-filled. Manual copy/paste remains available too.
- **History**: every check saved (snippet, date, source URL, verdict, word count, credits used)
  with a unique shareable result link, private by default (mirrors `pangram.com/history/<uuid>`,
  screenshots 7-8, 16).
- **Settings**: account/plan info, upgrade CTA, badge mode (default vs silent — screenshot 11),
  floating-icon toggle, Phase-2 feature toggles shown but inert, contact/feedback links, logout
  (screenshots 11-14).
- **Account & billing**: Google OAuth (+ email/password), Free/Pro/Business tiers, credit meter
  in the toolbar header, Stripe-powered upgrade flow (screenshots 15, 19-20).

## 3. Explicitly out of scope for Phase 1 (Phase 2 backlog)

- Feed auto-scanning across X, LinkedIn, Reddit, Medium, Substack (screenshots 1, 12-13) —
  requires 5 separate site-specific content scripts and per-platform feed-health scoring UI.
- Google Docs "Scan for AI" widget + writing-playback (screenshot 11's toggle).
- Image AI-detection credits (Pangram tracks these separately — screenshots 5, 9-10 show
  "Image Scans 3/3").
- Plagiarism checking (Pangram bundles this via a second checker; out of scope until a
  plagiarism vendor is chosen).

These are designed for in the data model (`plans.features` jsonb) so turning them on later
doesn't require a schema migration, just new content scripts / UI.

## 4. Pricing & credit economics

Pangram API cost basis (retail, until a negotiated rate is confirmed):
**$0.05 / 1,000 words realtime, $0.04 / 1,000 words bulk.** 1 internal "credit" = 1,000 words,
matching Pangram's own unit.

| Plan | Credits/mo | Worst-case API cost/mo | Price | Notes |
|---|---|---|---|---|
| Free | 10 | ~$0.50 | $0 | Capped at 4 checks/day too, to blunt scripted multi-account abuse (Pangram does the same — screenshot 5's `4/4`). |
| Pro | 500 | ~$20-25 | $49/mo | ~50% gross margin even at worst-case realtime pricing. |
| Business | 2,000 (3 seats) | ~$80-100 | $199/mo | Needs seat/pool design — see schema in `docs/architecture.md`. |

**These numbers live in `supabase/seed.sql`, not in application code.** Run
`npm run estimate-margin` (backed by `scripts/estimate-margin.ts`) any time the Pangram rate
changes to re-validate margin before touching pricing.

**Open item:** if Pangram offers a wholesale/reseller rate once the real API key + contract
terms arrive, re-run the margin calc — prices above can likely come down.

**⚠️ Unresolved risk, actively being tracked (2026-07-29):** `pangram.com/pricing` now lists
**two** model-version rates — "Pangram 3: $0.05 = 1,000 words" and "Pangram 4: $0.05 = 100
words" (10x costlier per word). Every entire margin table above assumes the Pangram 3 rate. We
could not find any documented REST API parameter to pin the cheaper model — the `/task` endpoint
we integrated only documents `text` and `public_dashboard_link` as request fields, and there's no
versioned URL for it (unlike the earlier v2→v3 migration, which did change the URL path).
`packages/pangram-client` now captures Pangram's `version` response field into
`api_usage_log.pangram_model_version` on every real request as an audit trail, and the API route
logs it loudly to the server console. **Action needed:** confirm directly with Pangram (account
dashboard's API/Developer settings, or `support@pangram.com`) which rate the Developer API key
actually bills at, and whether it's configurable — do not treat the numbers in this table as
confirmed until that lands.

## 5. Target users

Individual writers/students verifying their own work, educators/reviewers spot-checking
content, small teams/agencies checking submitted or purchased content — same audience Pangram
targets, minus the enterprise/LMS segment for now.

## 6. Competitive context

| Product | Notable strength | Relevant takeaway |
|---|---|---|
| GPTZero | Most generous free tier (10k words/mo) | Our 10-credit (10k word) free tier is competitive |
| Winston AI | OCR + deepfake/image detection | Image detection explicitly deferred |
| Originality.ai | Best plagiarism checker | Plagiarism explicitly out of scope Phase 1 |
| Copyleaks | Enterprise multilingual, 30+ languages | Pangram already gives us 20+ languages "for free" |

## 7. Branding & naming

"AI Checker" needs a Chrome Web Store name-collision/trademark check before submission. Needs a
real icon set, store screenshots, and promo tile — own designs, not Pangram's (currently
placeholder solid-color PNGs in `apps/extension/public/icons/`).
