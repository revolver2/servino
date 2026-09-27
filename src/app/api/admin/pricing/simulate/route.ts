import { adminApiError, adminApiOk } from "@/lib/server/admin-api-response";
import { isSameOrigin, requireAdminSession } from "@/lib/server/admin-auth";
import { checkRateLimit, clientIp } from "@/lib/server/rate-limit";
import { simulatePricingSchema } from "@/lib/server/admin-pricing-schemas";
import { getPricingVersionById } from "@/lib/pricing-engine/version-by-id";
import { computeCustomerPrice } from "@/lib/pricing-engine/customer-price";
import { computeEconomics } from "@/lib/pricing-engine/economics";
import { getEnabledServices } from "@/lib/services-data";

/**
 * The admin simulator's only data source (spec section 37/82) — calls the
 * exact same `computeCustomerPrice`/`computeEconomics` functions production
 * uses, never a reimplementation. Works against ANY version (draft, active,
 * or retired), unlike the real customer flow which only ever uses the
 * active one.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return adminApiError("FORBIDDEN", "Invalid request origin.");

  const admin = await requireAdminSession();
  if (!admin) return adminApiError("UNAUTHORIZED", "Sign in required.");

  const rl = checkRateLimit("admin-mutation", clientIp(request), { windowMs: 60_000, max: 120 });
  if (!rl.allowed) return adminApiError("RATE_LIMITED", "Too many requests. Please slow down.");

  const json = await request.json().catch(() => null);
  const parsed = simulatePricingSchema.safeParse(json);
  if (!parsed.success) return adminApiError("VALIDATION_ERROR", "Invalid simulation input.");
  const input = parsed.data;

  const loaded = await getPricingVersionById(input.pricingVersionId);
  if (!loaded) return adminApiError("NOT_FOUND", "Pricing version not found.");

  const rule = loaded.rules.get(input.serviceSlug);
  if (!rule) return adminApiError("VALIDATION_ERROR", "This version has no rate configured for that service.");

  const service = getEnabledServices().find((s) => s.slug === input.serviceSlug);
  if (!service) return adminApiError("VALIDATION_ERROR", "Unknown service.");

  const customerPrice = computeCustomerPrice(loaded.version, rule, {
    serviceSlug: input.serviceSlug,
    serviceName: service.name,
    totalAreaM2: input.totalAreaM2,
    materialOwnership: input.materialOwnership,
  });
  const economics = computeEconomics(loaded.version, customerPrice, input.materialOwnership);

  return adminApiOk({
    customer: {
      subtotalMinor: customerPrice.subtotalMinor,
      taxMinor: customerPrice.taxMinor,
      taxLabel: customerPrice.taxLabel,
      totalMinor: customerPrice.totalMinor,
      minimumApplied: customerPrice.minimumApplied,
    },
    internal: economics,
  });
}
