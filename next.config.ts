import type { NextConfig } from "next";
import path from "path";

/**
 * Content-Security-Policy (Session H, spec section 19 — deferred since
 * Phase C).
 *
 * Uses Next.js's own documented "Without Nonces" pattern
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md
 * — read directly per this project's AGENTS.md, since Next 16 may not
 * match training-data assumptions), NOT the nonce + nonce + `strict-dynamic`
 * pattern the same doc also describes. A nonce-based CSP was tried first
 * and reverted: Next can only inject a per-request nonce into
 * **dynamically** rendered pages, and this app's marketing/quote/admin/
 * pro pages are deliberately statically prerendered (`next build`'s own
 * output shows them as `○ Static`) for performance — forcing the whole
 * app to dynamic rendering just to support nonces would be a real,
 * unrequested architecture change (and a real performance regression:
 * no static optimization, no CDN caching, slower first paint on every
 * page). Verified empirically: with a nonce-based CSP, a real browser
 * (not just curl) showed the framework's own static-page script tags
 * being blocked on every route tested.
 *
 * `'unsafe-inline'` for `script-src` is the accepted tradeoff this
 * causes — explicitly permitted by spec section 19 ("minimize where
 * practical," not "eliminate unconditionally").
 *
 * `'unsafe-eval'` — Session H0.1 correction: an earlier version of this
 * policy omitted `'unsafe-eval'` in every environment, reasoning that
 * React's dev-mode eval usage "just logs a harmless console warning."
 * Real QA on a running dev server showed a genuine error, not a warning
 * ("eval() is not supported in this environment... React requires
 * eval() in development mode for various debugging features like
 * reconstructing callstacks from a different environment"), and Next's
 * own CSP docs (node_modules/next/dist/docs/01-app/02-guides/content-
 * security-policy.md, "Development Environment") explicitly recommend
 * enabling `'unsafe-eval'` in dev for exactly this reason. Fixed by
 * including it only when `NODE_ENV !== "production"` — the doc is
 * explicit that "`unsafe-eval` is not required for production; neither
 * React nor Next.js use `eval` in production by default," so this
 * changes nothing about the production security posture.
 */
const isProduction = process.env.NODE_ENV === "production";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} https://www.paypal.com https://www.sandbox.paypal.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api-m.paypal.com https://api-m.sandbox.paypal.com",
  "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
];

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives.join("; ") },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only makes sense once actually served over HTTPS. `preload` is
  // deliberately omitted — submitting to the browser preload list is a
  // one-way door not to take casually pre-launch.
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
