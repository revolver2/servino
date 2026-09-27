import type {
  CustomerPriceComputation,
  CustomerPriceInput,
  PricingVersionForEngine,
  ServicePricingRuleForEngine,
} from "./types";
import { applyPercent, roundMinor } from "./rounding";

/**
 * The one place customer-facing price is computed from a PricingVersion +
 * ServicePricingRule (spec section 82: "the simulator must use the SAME
 * pricing/economics engine as production — do not duplicate formulas in
 * React"). Both `/api/lead/price` and the admin simulator call this.
 *
 * Formula: (installOnlyRate + (materialOwnership === MATERIAL_AND_INSTALL
 * ? materialRate : 0)) × area, floored at the service's minimum subtotal,
 * then tax applied once to the floored subtotal.
 *
 * Deterministic (spec section 49): identical version + rule + input always
 * produces the identical result — no wall-clock-dependent or random input
 * anywhere in this function.
 */
export function computeCustomerPrice(
  pricingVersion: PricingVersionForEngine,
  rule: ServicePricingRuleForEngine,
  input: CustomerPriceInput
): CustomerPriceComputation {
  const rawLaborMinor = roundMinor(rule.installOnlyRateMinorPerM2 * input.totalAreaM2);
  const rawMaterialMinor =
    input.materialOwnership === "MATERIAL_AND_INSTALL"
      ? roundMinor(rule.materialRateMinorPerM2 * input.totalAreaM2)
      : 0;
  const rawSubtotalMinor = rawLaborMinor + rawMaterialMinor;

  const minimumApplied = rawSubtotalMinor < rule.minimumSubtotalMinor;
  const subtotalMinor = minimumApplied ? rule.minimumSubtotalMinor : rawSubtotalMinor;

  // When the minimum floor overrides the raw calculation, labor/material
  // components are scaled proportionally so the economics engine still has
  // a meaningful split to work from — never left as the (now understated)
  // raw amounts, and never just labor or just material.
  let laborComponentMinor: number;
  let materialComponentMinor: number;
  if (!minimumApplied) {
    laborComponentMinor = rawLaborMinor;
    materialComponentMinor = rawMaterialMinor;
  } else {
    // Split the minimum-job floor using the RATE ratio (not the raw
    // amounts, which may both be zero at a zero/near-zero area) so the
    // economics engine always has a well-defined split.
    const materialRateActive = input.materialOwnership === "MATERIAL_AND_INSTALL";
    const laborRateShare = materialRateActive
      ? rule.installOnlyRateMinorPerM2 / (rule.installOnlyRateMinorPerM2 + rule.materialRateMinorPerM2)
      : 1;
    laborComponentMinor = roundMinor(subtotalMinor * laborRateShare);
    materialComponentMinor = subtotalMinor - laborComponentMinor;
  }

  const taxMinor = applyPercent(subtotalMinor, pricingVersion.taxRatePercent);
  const totalMinor = subtotalMinor + taxMinor;

  return {
    laborComponentMinor,
    materialComponentMinor,
    minimumApplied,
    subtotalMinor,
    taxMinor,
    taxLabel: pricingVersion.taxLabel,
    totalMinor,
  };
}
