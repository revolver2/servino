// Session E QA screenshot driver. Requires the target server already
// running against servino_dev with an admin account already bootstrapped,
// plus at least one ACTIVE pricing version and one job with an
// EconomicsSnapshot already present (see docs/qa/session-e/README for how
// these were produced for this session's screenshots).
// Usage: node scripts/qa-session-e-screenshots.mjs <output-dir> <base-url> <email> <password> <pricingVersionId> <jobId>
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";

const [outDir, baseURL, email, password, pricingVersionId, jobId] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

async function shot(page, file) {
  await page.screenshot({ path: path.join(outDir, file), fullPage: true });
  console.log("captured", file);
}

async function run() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const res = await page.request.post(`${baseURL}/api/admin/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);

  // --- Admin pricing overview: 1440 / 1024 / 768 ---
  await page.goto(`${baseURL}/admin/pricing`, { waitUntil: "networkidle" });
  await shot(page, "pricing-overview-1440.png");
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "pricing-overview-1024.png");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "pricing-overview-768.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Pricing version detail ---
  await page.goto(`${baseURL}/admin/pricing/${pricingVersionId}`, { waitUntil: "networkidle" });
  await shot(page, "pricing-version-1440.png");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "pricing-version-768.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Simulator: A/B (install-only + material+install) always shown together ---
  await page.goto(`${baseURL}/admin/pricing/simulator`, { waitUntil: "networkidle" });
  await page.selectOption("#sim-service", "wall-panels");
  await page.fill("#sim-area", "10");
  await page.getByRole("button", { name: /simulate/i }).click();
  await page.waitForSelector("text=Contribution margin");
  await shot(page, "simulator-installation-only-1440.png");
  await shot(page, "simulator-material-installation-1440.png"); // same page: both scenarios render side by side by design (spec section 38)
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload({ waitUntil: "networkidle" });
  await page.selectOption("#sim-service", "wall-panels");
  await page.fill("#sim-area", "10");
  await page.getByRole("button", { name: /simulate/i }).click();
  await page.waitForSelector("text=Contribution margin");
  await shot(page, "simulator-comparison-768.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  // --- Simulator: low-margin scenario (tiny area, near/at the minimum job floor) ---
  await page.goto(`${baseURL}/admin/pricing/simulator`, { waitUntil: "networkidle" });
  await page.selectOption("#sim-service", "marble-sheets");
  await page.fill("#sim-area", "1");
  await page.getByRole("button", { name: /simulate/i }).click();
  await page.waitForSelector("text=Contribution margin");
  await shot(page, "simulator-low-margin-1440.png");

  // --- Job detail: internal economics section ---
  await page.goto(`${baseURL}/admin/jobs/${jobId}`, { waitUntil: "networkidle" });
  await shot(page, "job-economics-1440.png");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.reload({ waitUntil: "networkidle" });
  await shot(page, "job-economics-768.png");
  await page.setViewportSize({ width: 1440, height: 900 });

  await browser.close();
  console.log("Admin screenshots done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
