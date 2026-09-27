# Session D Admin QA Screenshots

Captured against a real, seeded `servino_dev` database — no fabricated
demo data. Primary viewport 1440×900 (desktop-first, per spec section
50); responsive spot checks at 768×1024 and 390×844.

## Environment

- **Browser:** System-installed Google Chrome, headless, driven via
  `playwright-core` + `channel: "chrome"` (`scripts/qa-admin-screenshots.mjs`)
- **Server:** `npm run dev` (port 3000), database: local
  `embedded-postgres` `servino_dev` instance
- **Date:** 2026-09-23
- **Admin account:** bootstrapped via `npm run admin:bootstrap`
- **Data:** a mix of real funnel submissions run through this session
  (Deniz/wallpaper — assigned to Maria Finish; Yuki/decorative-partitions
  — ready for assignment, unassigned) plus accumulated leads from earlier
  phases' testing. Two professionals (John Deco, Maria Finish) created
  through the actual admin UI.

## Files

| File | Screen |
|---|---|
| `01-admin-login.png` | `/admin/login`, unauthenticated |
| `02-admin-overview.png` | `/admin` — metrics, Action Required, Recent Activity |
| `03-leads-list.png` | `/admin/leads` |
| `04-lead-detail.png` | `/admin/leads/[id]` (Deniz) |
| `05-jobs-list.png` | `/admin/jobs` |
| `06-job-detail-unassigned.png` | `/admin/jobs/[id]` (Yuki — Ready for assignment, Unassigned) |
| `07-job-detail-assigned.png` | `/admin/jobs/[id]` (Deniz — Assigned, full timeline) |
| `08-professionals-list.png` | `/admin/professionals` |
| `09-professional-detail.png` | `/admin/professionals/[id]` (John Deco) |
| `10-services.png` | `/admin/services` |
| `11-overview-768.png` | Overview at 768px (responsive check) |
| `12-jobs-list-768.png` | Jobs list at 768px (responsive check) |
| `13-overview-390.png` | Overview at 390px (mobile sanity check — not the primary target device) |
| `14-keyboard-focus-check.png` | Job detail after 3 `Tab` presses — confirms a visible native focus ring on sidebar nav (no global outline suppression) |

## Accessibility

Ran `axe-core` (WCAG 2A/2AA rules) against all 7 primary admin screens.
**One real, critical finding** on first pass: the job status `<select>`
in `JobStatusControl.tsx` had no accessible name (`select-name`, axe
`critical` impact). Fixed by adding a visually-hidden `<label>` plus a
`focus-visible` outline; re-scanned — **0 violations across all 7
pages** after the fix. No color-contrast violations were found on any
status chip, confirming the coral/purple/teal-on-light chip palette is
WCAG AA compliant (this was specifically checked given a similar
contrast defect was found and fixed in Phase S1).

## Limitations

- A Next.js 16 dev-mode status badge (bottom-left circular "N" icon) is
  visible in most screenshots — a dev-server overlay artifact, not part
  of the application UI (same category as the "Compiling…"/"Rendering…"
  badges documented in the S2 baseline/post screenshots).
- Screenshots reflect `servino_dev`, which has accumulated lead/quote
  history from every prior phase's manual testing (visible in the
  Overview's "New leads (7d)" / "Submitted (7d)" counts and the Recent
  Activity feed) — this is real historical data, not fabricated, and
  does not affect the correctness of what's shown.
