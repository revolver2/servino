/**
 * Serviceability boundary (spec section 17).
 *
 * Components must never hardcode "Toronto" checks directly — they call
 * `resolveServiceability()`. When Phase D/E introduce the real Location
 * admin module (Country → Province → City → Zone/Postal Code, backed by
 * `prisma/schema.prisma`'s Country/Province/City/ServiceCity models), this
 * file is replaced by a DB-backed lookup with the same return shape.
 */

export type ServiceableCity = {
  slug: string;
  name: string;
  provinceCode: string;
  countryCode: string;
  /** Canada Forward Sortation Area first letters served by this city, for the B1 approximation below. */
  postalPrefixes: string[];
};

export const serviceableCities: ServiceableCity[] = [
  {
    slug: "toronto",
    name: "Toronto",
    provinceCode: "ON",
    countryCode: "CA",
    postalPrefixes: ["M"],
  },
];

export type ServiceabilityResult =
  | { valid: true; serviceable: true; citySlug: string; cityName: string }
  | { valid: true; serviceable: false }
  | { valid: false };

const CA_POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;

/**
 * Validates Canadian postal code format and checks it against the
 * currently launched cities. This is a B1 approximation (first-letter FSA
 * match only, not real polygon/FSA-level serviceability data) — documented
 * as such in DECISIONS.md.
 */
export function resolveServiceability(rawPostalCode: string): ServiceabilityResult {
  const postalCode = rawPostalCode.trim().toUpperCase();

  if (!CA_POSTAL_CODE_RE.test(postalCode)) {
    return { valid: false };
  }

  const firstLetter = postalCode[0];
  const match = serviceableCities.find((city) => city.postalPrefixes.includes(firstLetter));

  if (!match) {
    return { valid: true, serviceable: false };
  }

  return { valid: true, serviceable: true, citySlug: match.slug, cityName: match.name };
}
