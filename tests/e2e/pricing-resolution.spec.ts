import { test, expect } from "@playwright/test";
import { testDb } from "./helpers/db";
import { resolvePricing } from "../../src/lib/pricing-engine/resolve-pricing";

/**
 * Tests `resolvePricing()`'s selection POLICY directly (spec section 5,
 * docs/DECISIONS.md D026) — not through HTTP, because the running test
 * server always sets NEXT_PUBLIC_USE_MOCK_PRICING=true
 * (scripts/test-server.mjs, so the existing 38 customer tests stay fast/
 * deterministic without a seeded pricing version), which would
 * short-circuit before this policy's more interesting branches ever ran.
 * `resolvePricing`'s Prisma dependency connects to the same isolated
 * servino_test database as everything else in this suite —
 * global-setup.ts sets DATABASE_URL before any test file (including this
 * one's static imports) loads. Each test mutates NODE_ENV/
 * NEXT_PUBLIC_USE_MOCK_PRICING for its own duration only and restores them
 * afterward, since `workers: 1` means every test file shares one process.
 */

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) original[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test.afterEach(async () => {
  // Any version this file activated must not leak into other test files —
  // retire everything for "toronto" so the shared servino_test database
  // returns to "no active version" for whoever runs next.
  await testDb.pricingVersion.updateMany({
    where: { citySlug: "toronto", status: "ACTIVE" },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
});

test("production never resolves to mock pricing, even with the mock flag set (D026)", async () => {
  await withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK_PRICING: "true" }, async () => {
    const result = await resolvePricing({
      citySlug: "toronto",
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.source).not.toBe("MOCK_DEV");
  });
});

test("production fails closed to UNAVAILABLE when no active pricing version exists", async () => {
  await withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK_PRICING: undefined }, async () => {
    const result = await resolvePricing({
      citySlug: "toronto",
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.source).toBe("UNAVAILABLE");
    expect(result.price.status).toBe("unavailable");
  });
});

test("non-production falls back to mock when no active version exists (dev convenience preserved)", async () => {
  await withEnv({ NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK_PRICING: undefined }, async () => {
    const result = await resolvePricing({
      citySlug: "toronto",
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.source).toBe("MOCK_DEV");
    expect(result.price.status).toBe("ok");
  });
});

test("when an active version exists, production uses it — never mock, never unavailable", async () => {
  const version = await testDb.pricingVersion.create({
    data: {
      citySlug: "toronto",
      label: `test-resolution-${Date.now()}`,
      status: "ACTIVE",
      activatedAt: new Date(),
      taxRatePercent: 13,
      taxLabel: "HST (13%)",
      professionalPayoutPercentOfLabor: 75,
      materialCostPercentOfCustomerRate: 70,
      paymentProcessingPercent: 2.9,
      paymentProcessingFixedMinor: 30,
      estimatedCacMinor: 7500,
      otherVariableCostMinor: 1000,
      healthyMarginPercent: 30,
      acceptableMarginPercent: 15,
      lowMarginPercent: 5,
      rules: {
        create: [
          {
            serviceSlug: "wall-panels",
            installOnlyRateMinorPerM2: 6500,
            materialRateMinorPerM2: 8500,
            minimumSubtotalMinor: 35000,
          },
        ],
      },
    },
  });

  await withEnv({ NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK_PRICING: undefined }, async () => {
    const result = await resolvePricing({
      citySlug: "toronto",
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.source).toBe("AUTHORITATIVE_VERSIONED");
    if (result.source === "AUTHORITATIVE_VERSIONED") {
      expect(result.pricingVersionId).toBe(version.id);
      expect(result.price.totalMinor).toBe(169500);
    }
  });
});
