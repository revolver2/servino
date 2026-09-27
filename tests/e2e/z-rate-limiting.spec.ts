import { test, expect } from "@playwright/test";
import { apiPost } from "./helpers/api";

/**
 * Named `z-*` so it runs LAST (Playwright's default order follows file
 * discovery order, effectively alphabetical) — this test deliberately
 * exhausts the `lead-contact` rate-limit bucket, which is keyed by IP and
 * therefore shared with every other test in this suite that calls
 * `/api/lead/contact`. Running first would 429 those tests.
 */
test("contact endpoint rate-limits after repeated rapid submissions", async ({ baseURL }) => {
  const sessionId = `phase-c-ratelimit-${Date.now()}`;
  await apiPost(baseURL!, "/api/lead/progress", {
    sessionId,
    serviceSlug: "wall-panels",
    postalCode: "M5V 2T6",
    measurementUnit: "METRIC",
    totalAreaM2: 5,
    styleId: "black",
    materialOwnership: "INSTALL_ONLY",
    currentStep: "PRICE",
  });
  await apiPost(baseURL!, "/api/lead/price", { sessionId });

  let sawRateLimit = false;
  for (let i = 0; i < 15; i++) {
    const result = await apiPost(baseURL!, "/api/lead/contact", {
      sessionId,
      firstName: "Rate",
      email: `rate-limit-${i}@example.com`,
      phone: "4165551234",
    });
    if (result.status === 429) {
      sawRateLimit = true;
      expect(result.json?.ok).toBe(false);
      expect((result.json as { code: string }).code).toBe("RATE_LIMITED");
      break;
    }
  }
  expect(sawRateLimit).toBe(true);
});
