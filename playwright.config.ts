import { defineConfig, devices } from "@playwright/test";

/**
 * Committed regression suite for the revenue-critical funnel (Phase C —
 * see docs/PROJECT_STATUS.md "Automated Test Suite Decision"). Scoped to
 * the highest-value flows (spec section 4): money, leads, funnel state,
 * confirmation — not exhaustive UI coverage.
 *
 * Uses the system-installed Chrome (`channel: "chrome"`) rather than
 * Playwright's bundled Chromium — this environment has no reliable access
 * to Playwright's browser-binary CDN (see docs/DECISIONS.md), but does
 * have Chrome installed locally. CI environments with working Playwright
 * browser downloads can drop the `channel` override.
 *
 * Requires the local database AND the isolated test-mode app server
 * running (targets `servino_test`, port 3100 — never `servino_dev` or
 * production; see scripts/test-server.mjs and spec section 49):
 *   node scripts/dev-db.mjs start     (separate terminal)
 *   npm run test:e2e:server            (separate terminal)
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  // Session D: logs in as the test admin once for the whole run (see
  // global-setup.ts for why) — every test starts pre-authenticated via
  // storageState unless it explicitly clears it. Irrelevant to the
  // customer-funnel tests (they use localStorage, not cookies).
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: "./tests/e2e/.auth/admin.json",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
