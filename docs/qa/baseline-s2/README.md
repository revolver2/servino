# S2 Baseline Screenshots

Captured **before any S2 funnel styling changes** — this is the exact
visual state the funnel was in at the end of Phase S1, used for
before/after comparison once S2's visual polish is complete (see
`docs/qa/S2_VISUAL_COMPARISON.md`, `docs/qa/post-s2/`).

## Environment

- **Viewport:** 390×844 (mobile — matches the funnel's primary usage
  pattern and prior baseline conventions from S1)
- **Browser:** System-installed Google Chrome, headless, driven via
  Playwright (`playwright-core` + `channel: "chrome"` — see
  `playwright.config.ts` comment for why: this environment has no
  reliable access to Playwright's own browser-binary CDN)
- **Commit hash:** none — this repository has no commits yet (nothing
  has been committed in any phase of this project unless explicitly
  requested; see every prior phase's `PROJECT_STATUS.md`)
- **Date:** 2026-09-22
- **Node:** v24.14.1
- **Server:** `npm run dev` (port 3000), database: local `embedded-postgres`
  `servino_dev` instance
- **Pricing mode:** development mock pricing (`MockPricingAdapter`) — see
  `docs/DECISIONS.md` D009; not authoritative Toronto pricing

## Scenarios captured

| File | Scenario | Test data |
|---|---|---|
| `01-project-location.png` | Step 1, service + postal code entered, pre-continue | Wall Panels, `M5V 2T6` |
| `02-measurements-two-walls.png` | Step 2, two walls filled | Wall 1: 3×2.5m, Wall 2: 2×2m (total 11.5 m²) |
| `03a-photo-uploaded.png` | Step 3, photo selected | `tests/e2e/fixtures/test-photo.png` |
| `03b-photo-skipped.png` | Step 3, before clicking Skip (separate session) | Marble Sheets, `M4B 1B3`, wall 2.4×3m |
| `04-style-material.png` | Step 4, style + material selected, pre-continue | Light Oak, Material + Installation |
| `05a-price-material-installation.png` | Step 5, Material + Installation variant | Wall Panels, 11.5 m², Light Oak → $1,884.28 |
| `05b-price-installation-only.png` | Step 5, Installation Only variant (separate session) | Marble Sheets, 7.2 m², White, install-only |
| `06-contact.png` | Step 6, empty form | — |
| `07-timing.png` | Step 7, empty (pre-selection) | — |
| `08-confirmation.png` | Step 8, real validated confirmation | Full happy path, Within 1–2 weeks |
| `09-validation-error.png` | Measurements validation error | Width `0`, height `-2` → "Must be greater than 0" ×2 |
| `10-pricing-failure.png` | Real pricing-unavailable state | `decorative-partitions` dev rate temporarily removed from `dev-pricing-config.ts`, captured, then immediately restored (confirmed via `git diff`-equivalent read-back and a clean `tsc --noEmit`) |

All scenarios use the **real application** — no screenshot was edited,
mocked at the UI layer, or fabricated. The pricing-failure screenshot
required a temporary, immediately-reverted one-line config edit (same
technique used to validate this exact failure path in Phases B1/C); the
edit was live for under a minute and the file was confirmed restored
before continuing.

## Limitations

- The `03b`/`05b` scenarios are a separate browser session from
  `01`–`04`/`05a`/`06`–`08` (different service/postal code/style), since a
  single funnel run can only take one path through the photo/material
  branch. Not a like-for-like continuation of the same session — a
  deliberate choice to actually exercise the B-branch rather than reuse
  screenshots from the A-branch.
- Dev-mode "Compiling…" HMR indicator is visible in some screenshots
  (bottom-left badge) — this is a Next.js dev-server artifact, not part
  of the application UI.
