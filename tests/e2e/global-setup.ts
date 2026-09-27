import type { FullConfig } from "@playwright/test";
import { request as playwrightRequest } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { ensureTestAdmin, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } from "./helpers/admin";

// Session E: some tests (tests/e2e/pricing-resolution.spec.ts) statically
// import server-side modules that construct a Prisma client at import time
// (src/lib/server/prisma.ts reads DATABASE_URL when `new PrismaClient()`
// runs). Setting it here — globalSetup is guaranteed to run before any test
// file is loaded — ensures that client connects to the same isolated
// servino_test database as everything else in this suite. Unconditional
// (not just a default): the test-runner process must never trust an
// inherited DATABASE_URL that could point at servino_dev or production.
process.env.DATABASE_URL =
  "postgresql://servino:servino_dev_local_only@127.0.0.1:55432/servino_test?schema=public";

/**
 * Logs in as the test admin ONCE for the whole suite and saves the
 * resulting session cookie to a storageState file, which
 * `playwright.config.ts` loads as the default for every test. Without
 * this, every admin test re-authenticating individually (dozens of times
 * across the suite) would exceed the admin login endpoint's real,
 * deliberately tight rate limit (8/5min — spec section 47) purely from
 * test volume, not from anything wrong with the app. Tests that need to
 * start unauthenticated override with
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = (config.projects[0]?.use?.baseURL as string | undefined) ?? "http://localhost:3100";
  await ensureTestAdmin();

  const context = await playwrightRequest.newContext({ baseURL });
  const res = await context.post("/api/admin/auth/login", {
    data: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Global admin login setup failed with status ${res.status()}`);
  }

  const authDir = path.join(__dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  await context.storageState({ path: path.join(authDir, "admin.json") });
  await context.dispose();
}
