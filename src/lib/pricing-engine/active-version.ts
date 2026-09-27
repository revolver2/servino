import { prisma } from "@/lib/server/prisma";
import { mapPricingVersionRow } from "./map-row";
import type { PricingVersionForEngine, ServicePricingRuleForEngine } from "./types";

export type ActivePricingVersion = {
  version: PricingVersionForEngine;
  rules: Map<string, ServicePricingRuleForEngine>;
};

/**
 * The single DB-backed lookup every real pricing resolution starts from.
 * Server-only by construction (imports the Prisma client, same convention
 * as everything under `src/lib/server/`) — never imported by client/browser
 * code; `src/lib/quote/lead/dev-local-lead-adapter.ts` (the one client-side
 * consumer of pricing) deliberately keeps using the older, DB-free
 * `getPricingAdapter()` instead of this module.
 */
export async function getActivePricingVersion(citySlug: string): Promise<ActivePricingVersion | null> {
  const row = await prisma.pricingVersion.findFirst({
    where: { citySlug, status: "ACTIVE" },
    include: { rules: true },
  });
  if (!row) return null;
  return mapPricingVersionRow(row);
}
