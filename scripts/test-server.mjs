/**
 * Starts the Next.js app pointed at the isolated `servino_test` database
 * on a separate port (3100), so the committed Playwright suite
 * (`npm run test:e2e`) never touches `servino_dev` (manual local work) or
 * a production database (spec section 49 — tests must not run against
 * production, and shouldn't clutter the developer's own dev data either).
 *
 * Usage: node scripts/test-server.mjs
 * Requires the embedded dev/test Postgres already running:
 *   node scripts/dev-db.mjs start
 */
import { spawn } from "node:child_process";

process.env.DATABASE_URL =
  "postgresql://servino:servino_dev_local_only@127.0.0.1:55432/servino_test?schema=public";
process.env.NEXT_PUBLIC_USE_MOCK_PRICING = "true";
process.env.PORT = "3100";

const child = spawn("npx", ["next", "dev", "-p", "3100"], {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
