# S2 Post-Polish Screenshots

Captured **after** all S2 funnel visual polish (Tasks #74–#81). Same
scenarios, same test data, same viewport as `docs/qa/baseline-s2/` —
see `docs/qa/S2_VISUAL_COMPARISON.md` for the before/after analysis.

## Environment

- **Viewport:** 390×844 (mobile), matching the baseline
- **Browser:** System-installed Google Chrome, headless, driven via
  `playwright-core` + `channel: "chrome"` (see `scripts/qa-screenshots.mjs`
  and `scripts/qa-screenshot-pricing-failure.mjs`, both new one-off
  drivers written this session since no baseline capture script had
  been committed)
- **Commit hash:** none — repository still has zero commits (nothing
  committed in any phase unless explicitly requested)
- **Date:** 2026-09-22
- **Server:** `npm run dev` (port 3000), database: local
  `embedded-postgres` `servino_dev` instance
- **Pricing mode:** development mock pricing (`MockPricingAdapter`) —
  same as baseline, not authoritative Toronto pricing

## Scenarios captured

Identical scenario set and test data to `docs/qa/baseline-s2/README.md`
(01 through 10, plus 03b/05b branch). The pricing-failure screenshot
(`10-pricing-failure.png`) again required a temporary, immediately
reverted removal of `decorative-partitions` from
`src/lib/quote/pricing/dev-pricing-config.ts` — confirmed restored via
a direct file read-back showing the original four-entry maps, and a
clean `npx tsc --noEmit` immediately after.

## Limitations

- Same `03b`/`05b` separate-session caveat as the baseline.
- A Next.js 16 dev-mode status badge ("Rendering…" / "Compiling…",
  bottom-left, teal dot) is visible in most screenshots — a dev-server
  overlay artifact, not part of the application UI. In
  `05b-price-installation-only.png` it happens to overlap the bottom-left
  corner of the breakdown card's "Total" row; this is the same dev
  overlay, not a layout regression (confirmed by inspecting the live
  page with the overlay dismissed).
