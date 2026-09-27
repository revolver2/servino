import { PrismaClient } from "@prisma/client";

/**
 * Always points at the isolated `servino_test` database, regardless of
 * whatever `DATABASE_URL` the test-runner process happens to have — never
 * `servino_dev` (a developer's local work) or production (spec section
 * 49). The app-under-test is separately started against the same
 * database via `npm run test:e2e:server` (scripts/test-server.mjs).
 */
export const testDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://servino:servino_dev_local_only@127.0.0.1:55432/servino_test?schema=public",
    },
  },
});
