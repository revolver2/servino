# Image Asset Requirements

_Created Phase S1. Servino does not yet have verified, real project
photography — this document exists so that's a known, tracked gap rather
than a reason to fabricate images (spec section 14 — image truthfulness
is treated as a hard rule, not a style preference)._

## Current state

Every image-shaped surface in the storefront is currently either:
- **abstract/geometric** (the hero's slat-pattern illustration, the
  Inspiration section's color/material swatches) — deliberately not
  photography, so there's no risk of being mistaken for a real project, or
- **disabled** (`showBeforeAfter: false` — the Before/After section
  returns `null` rather than showing placeholder or stock imagery).

Both are honest, intentional design choices (see `docs/DECISIONS.md`
D005), not temporary placeholders waiting to be "filled in" with stock
photos. When real assets exist, they *replace* the abstract treatment —
they don't get layered on top of it.

## What would materially improve the storefront

In priority order (highest conversion impact first):

1. **Hero transformation image** — one striking, high-quality photo of a
   finished decorative wall (the current abstract slat illustration works
   well but a real photo would likely outperform it once available).
2. **Before/after pair** — a genuine Servino-completed project, shot
   consistently (same angle/lighting for before and after). This is what
   unblocks `showBeforeAfter: true` — spec section 18 requires this
   section stay off until a real pair exists; do not enable it with a
   generic/licensed pair.
3. **Service card imagery** — one representative photo per service (Wall
   Panels, Marble Sheets, Wallpaper, Decorative Partitions) to replace the
   current flat color-block treatment in `Services.tsx`.
4. **Inspiration style photography** — a real photo per style (Natural
   Wood, Light Oak, Dark Walnut, Black, White, Marble, Stone, Minimal,
   Contemporary) to replace the current color/gradient swatches in
   `Inspiration.tsx`. Lower priority than 1–3 since the swatch treatment
   already reads as intentional and honest, not broken.

## Requirements when real assets do arrive

- **Provenance:** only images of actual Servino-completed projects may be
  labeled as Servino work. Licensed/stock/generated images may be used
  for general inspiration but must never be presented as a completed
  Servino project (spec section 14).
- **Format:** modern formats (WebP/AVIF) with a JPEG/PNG fallback via
  Next.js `<Image>` — not currently used anywhere since there are no real
  photos to serve yet; adopt `next/image` when real assets are added
  (automatic responsive sizing, lazy loading, and format negotiation come
  for free rather than needing to be built).
- **Aspect ratios:** hero — 4:3 (matches the current abstract treatment's
  container, spec section 13); service cards — roughly square; before/
  after — matching pair, same crop.
- **Licensing:** if any licensed/stock imagery is used for non-"Servino
  project" purposes (e.g. general inspiration), retain proof of license.

## Session H0.1 — launch photography shot list and provenance labeling

Re-reviewed during pre-launch QA (Session H0.1): no change to the current
site — the abstract/disabled treatment above remains correct and
truthful until real assets exist. This section only makes the asset
request more concrete for whoever sources the first real photos.

**Recommended shot list for first launch photography** (real,
Servino-completed jobs only — not stock, not generated):
- Finished wall-panel installation (wide shot, well-lit).
- Finished marble-sheet installation.
- Finished wallpaper installation.
- Finished decorative-partition installation.
- Close-up workmanship detail (seams/joins/finish quality) — this is
  what differentiates a professional install from a DIY one and is
  currently missing from every "what would materially improve"
  suggestion above.
- Before/after pairs, one per service where possible — same angle and
  lighting for both shots (see "genuine Servino-completed project" note
  above).

**Every image used anywhere in the product must carry one, and only
one, of these three provenance labels internally (in the filename,
CMS entry, or code comment — not necessarily shown to the customer):**
- **REAL SERVINO PROJECT** — an actual completed Servino job. The only
  category that may ever be presented as "our work" or paired with
  service/before-after claims.
- **LICENSED STOCK** — a properly licensed photo used for general
  inspiration only. Must never be captioned or implied as a Servino
  project; license proof retained per "Requirements when real assets
  arrive" above.
- **ILLUSTRATIVE/GENERATED** — an abstract or AI/illustration-generated
  image (the current Hero slats and Inspiration swatches fall in this
  category). Never used to depict a specific finished project or
  implied to be photography of real work.

Mixing these — e.g. captioning a LICENSED STOCK photo as a Servino
project, or letting an ILLUSTRATIVE/GENERATED image sit next to
before/after claim language — is exactly the failure mode spec section
14 exists to prevent, and is the reason `showBeforeAfter` stays `false`
until real REAL SERVINO PROJECT pairs exist.

## What does NOT block S1/current release

None of the above blocks shipping the current storefront — every
image-dependent section already degrades gracefully without real assets
(verified this phase, see `docs/PROJECT_STATUS.md`). This document is a
forward-looking asset request, not a blocker list.
