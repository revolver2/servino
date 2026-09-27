import { test, expect } from "@playwright/test";
import { computeCustomerPrice } from "../../src/lib/pricing-engine/customer-price";
import { computeEconomics } from "../../src/lib/pricing-engine/economics";
import type { PricingVersionForEngine, ServicePricingRuleForEngine } from "../../src/lib/pricing-engine/types";

/**
 * Pure computation tests — no server, no database, no browser. These call
 * the exact same functions production and the admin simulator use
 * (spec section 82). Fast and fully deterministic by construction.
 */

const version: PricingVersionForEngine = {
  id: "test-version",
  citySlug: "toronto",
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
};

const wallPanelsRule: ServicePricingRuleForEngine = {
  serviceSlug: "wall-panels",
  installOnlyRateMinorPerM2: 6500,
  materialRateMinorPerM2: 8500,
  minimumSubtotalMinor: 35000,
};

test.describe("computeCustomerPrice — determinism and correctness", () => {
  test("identical version + rule + input always produces the identical result", () => {
    const input = {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL" as const,
    };
    const results = Array.from({ length: 5 }, () => computeCustomerPrice(version, wallPanelsRule, input));
    for (const r of results) {
      expect(r).toEqual(results[0]);
    }
  });

  test("material + install: subtotal is (install + material) x area, tax applied once", () => {
    const result = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.subtotalMinor).toBe(150000); // (6500+8500)*10
    expect(result.taxMinor).toBe(19500); // 13% of 150000
    expect(result.totalMinor).toBe(169500);
    expect(result.minimumApplied).toBe(false);
    expect(result.laborComponentMinor).toBe(65000);
    expect(result.materialComponentMinor).toBe(85000);
  });

  test("install only: material rate is never charged, even though it exists on the rule", () => {
    const result = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "INSTALL_ONLY",
    });
    expect(result.subtotalMinor).toBe(65000); // labor only
    expect(result.materialComponentMinor).toBe(0);
    expect(result.laborComponentMinor).toBe(65000);
  });

  test("minimum job floor overrides a small raw calculation", () => {
    const result = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 1, // raw = 15000, below the 35000 minimum
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(result.minimumApplied).toBe(true);
    expect(result.subtotalMinor).toBe(35000);
    // Labor/material components still sum to the floored subtotal.
    expect(result.laborComponentMinor + result.materialComponentMinor).toBe(35000);
  });

  test("minimum job floor for INSTALL_ONLY puts 100% of the floor into the labor component", () => {
    const result = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 1,
      materialOwnership: "INSTALL_ONLY",
    });
    expect(result.minimumApplied).toBe(true);
    expect(result.subtotalMinor).toBe(35000);
    expect(result.laborComponentMinor).toBe(35000);
    expect(result.materialComponentMinor).toBe(0);
  });

  test("metric and imperial equivalent areas produce the identical price (unit conversion tolerance)", () => {
    // 10 m^2 vs the equivalent in sq ft (10 / 0.09290304 = 107.6391...) —
    // the funnel always normalizes to m^2 before calling the engine
    // (src/lib/quote/units.ts), so feeding the engine the converted m^2
    // value directly must be exact, not just close.
    const FT2_TO_M2 = 0.09290304;
    const areaInSqFt = 107.6391042;
    const convertedM2 = areaInSqFt * FT2_TO_M2;

    const a = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    const b = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: convertedM2,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    expect(b.totalMinor).toBe(a.totalMinor);
  });
});

test.describe("computeEconomics — contribution profit and quote health", () => {
  test("material cost estimate is zero for INSTALL_ONLY regardless of the rule's material rate", () => {
    const price = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "INSTALL_ONLY",
    });
    const economics = computeEconomics(version, price, "INSTALL_ONLY");
    expect(economics.materialCostEstimateMinor).toBe(0);
  });

  test("a healthy-margin scenario classifies as HEALTHY, ACCEPTABLE, or LOW_MARGIN consistently with its own margin", () => {
    const price = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 30,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    const economics = computeEconomics(version, price, "MATERIAL_AND_INSTALL");
    expect(economics.contributionMarginPercent).toBeGreaterThan(15);
    expect(["ACCEPTABLE", "HEALTHY"]).toContain(economics.quoteHealth);
  });

  test("a tiny minimum-job scenario can classify as UNPROFITABLE — the guardrail actually fires", () => {
    const price = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 0.5,
      materialOwnership: "INSTALL_ONLY",
    });
    const economics = computeEconomics(version, price, "INSTALL_ONLY");
    expect(economics.contributionProfitMinor).toBeLessThan(0);
    expect(economics.quoteHealth).toBe("UNPROFITABLE");
  });

  test("quote health thresholds are inclusive at the boundary (>= healthy, not > )", () => {
    // Construct a version where the margin lands exactly on a threshold.
    const preciseVersion: PricingVersionForEngine = { ...version, healthyMarginPercent: 20 };
    const price = { subtotalMinor: 100000, taxMinor: 13000, taxLabel: "HST", totalMinor: 113000, laborComponentMinor: 100000, materialComponentMinor: 0, minimumApplied: false };
    // contributionProfit should be exactly 20% of subtotal for this to test the boundary; construct assumptions accordingly.
    const zeroCostVersion: PricingVersionForEngine = {
      ...preciseVersion,
      professionalPayoutPercentOfLabor: 0,
      materialCostPercentOfCustomerRate: 0,
      paymentProcessingPercent: 0,
      paymentProcessingFixedMinor: 0,
      estimatedCacMinor: 80000, // subtotal(100000) - CAC(80000) - other(0) = 20000 = 20% margin exactly
      otherVariableCostMinor: 0,
    };
    const economics = computeEconomics(zeroCostVersion, price, "INSTALL_ONLY");
    expect(economics.contributionMarginPercent).toBe(20);
    expect(economics.quoteHealth).toBe("HEALTHY");
  });

  test("discount and referral overrides reduce contribution profit dollar-for-dollar", () => {
    const price = computeCustomerPrice(version, wallPanelsRule, {
      serviceSlug: "wall-panels",
      serviceName: "Wall Panels",
      totalAreaM2: 10,
      materialOwnership: "MATERIAL_AND_INSTALL",
    });
    const withoutDiscount = computeEconomics(version, price, "MATERIAL_AND_INSTALL");
    const withDiscount = computeEconomics(version, price, "MATERIAL_AND_INSTALL", { discountMinor: 5000 });
    expect(withoutDiscount.contributionProfitMinor - withDiscount.contributionProfitMinor).toBe(5000);
  });
});
