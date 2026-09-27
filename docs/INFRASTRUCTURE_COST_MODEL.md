# Infrastructure Cost Model

_Session H. Estimated monthly cost to actually run Servino in
production at first-10-jobs scale. VPS pricing below was looked up
live (see Sources) rather than assumed — retrieved 2026-09-24, and
provider pricing changes over time; treat these as a current
ballpark, re-check before committing. Nothing here is a
recommendation of a specific provider over another — pick whichever
fits the Owner's own preference; the numbers just need to be in the
right ballpark._

## Required (launch cannot happen without these)

| Item | Estimated monthly cost (CAD, approximate) | Notes |
|---|---|---|
| VPS (Next.js + PostgreSQL, D045) | **~$8–35 CAD** | A small shared-CPU instance (2 vCPU / 4 GB RAM) is genuinely enough at first-10-jobs traffic. Hetzner's comparable CPX plan is ~€7.72/mo (≈$11 CAD) as of this research; DigitalOcean's comparable Premium/Basic droplet tier is ~$7–24 USD/mo (≈$10–33 CAD). Exact choice affects region/support/ease-of-use more than capability at this scale. |
| Domain registration | **~$1–2 CAD/mo** (~$15–20 CAD/year, billed annually) | `.ca` or `.com`, whichever the Owner prefers; not researched to an exact figure here — domain registrar pricing is well-known and easy to check directly (Namecheap, Google Domains successor, etc.) at purchase time. |
| TLS certificate | **$0** | Let's Encrypt via Caddy or certbot — free, auto-renewing. |
| Off-VPS backup storage | **~$1–5 CAD/mo** | A daily `pg_dump` of a first-10-jobs database is tiny (likely under 100 MB for a long time) — even a basic object-storage tier (Backblaze B2, DigitalOcean Spaces, etc.) costs cents/month at this volume. Not precisely researched — genuinely negligible at this data size regardless of provider. |
| PayPal transaction fees | **2.90% + $0.30 CAD per domestic transaction** | Not a fixed monthly cost — scales with actual revenue. Sourced from `docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md` (paypal.com/ca/business/paypal-business-fees, retrieved during Session G, page's own "last updated" 2026-07-15). International cards add 0.80–1.00%. |

**Required total, excluding PayPal fees (which scale with revenue,
not a fixed cost): roughly $10–40 CAD/month.**

## Optional (real value, not required for launch)

| Item | Estimated monthly cost | Notes |
|---|---|---|
| Uptime monitor (UptimeRobot, Better Uptime, etc.) | **$0** at this scale | Free tiers cover a single health-check endpoint easily. |
| Error tracking (Sentry or similar) | **$0–26 USD/mo** | Most have a free tier sufficient for a first-10-jobs app's error volume. Not integrated this session (see `docs/PROJECT_STATUS.md` "Session H — Observability") — a future decision, not a launch blocker. |
| Meta/Google ad conversion tracking | **$0 to configure** | The pixel itself is free; ad spend is a separate, Owner-controlled business decision (`docs/LAUNCH_CHECKLIST.md` "Ads") — not an infrastructure cost. |

## Future (not needed at first-10-jobs scale — do not provision yet)

| Item | Why deferred |
|---|---|
| Redis (distributed rate limiting) | Only needed if/when the app moves off the single-VPS architecture (D045/D046) — not before. |
| CDN | Static assets are served directly by Next.js; no meaningful latency problem exists at this traffic volume to justify one. |
| A second VPS / load balancer / managed database | First-10-jobs traffic doesn't come close to needing horizontal scaling. Revisit only after real, sustained traffic data says otherwise. |
| Staging environment infrastructure | Explicitly not built (`docs/PRODUCTION_DEPLOYMENT.md` "Environments") — a second subdomain on the same VPS covers the rare pre-production check this scale needs. |

## Bottom line

**Realistic all-in required infrastructure cost to launch: roughly
$10–40 CAD/month**, before any ad spend and before PayPal's
per-transaction fees (which only apply once there's actual revenue to
take a percentage of). This is a launch-appropriate, non-enterprise
number — consistent with the whole of Session H's "production
readiness, not feature count" framing.

## Sources

- [Hetzner Cloud CX22 Pricing 2026](https://vpsfor.dev/posts/hetzner-cx22-pricing-2026/) — retrieved 2026-09-24
- [Hetzner Cloud Pricing Calculator](https://costgoat.com/pricing/hetzner) — retrieved 2026-09-24
- [DigitalOcean Droplet Pricing](https://www.digitalocean.com/pricing/droplets) — retrieved 2026-09-24
- [DigitalOcean Pricing 2026 summary](https://costbench.com/software/cloud-infrastructure/digitalocean/) — retrieved 2026-09-24
- PayPal Canada business fees — see `docs/research/PAYPAL_MARKETPLACE_FEASIBILITY.md` (Session G)
