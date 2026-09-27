import { prisma } from "@/lib/server/prisma";
import { mapPricingVersionRow } from "./map-row";
import type { PricingVersionForEngine, ServicePricingRuleForEngine } from "./types";

/**
 * Loads any PricingVersion by ID (draft, active, or retired) for the admin
 * simulator (spec section 37 — the owner previews a version regardless of
 * its lifecycle state, not just the currently active one).
 */
export async function getPricingVersionById(
  id: string
): Promise<{ version: PricingVersionForEngine; rules: Map<string, ServicePricingRuleForEngine> } | null> {
  const row = await prisma.pricingVersion.findUnique({ where: { id }, include: { rules: true } });
  if (!row) return null;
  return mapPricingVersionRow(row);
}
