/**
 * Static seed data for the initial Toronto launch category.
 * Phase A only — the homepage reads from this file directly.
 * Shape mirrors the `Service` / `ServiceCategory` Prisma models (see
 * prisma/schema.prisma) so this becomes a DB fetch with no UI changes
 * once the Services admin module (Phase D) exists.
 */
export type PublicPricingMode =
  | "EXACT_PRICE"
  | "STARTING_FROM"
  | "RANGE"
  | "QUOTE_ONLY"
  | "NO_PUBLIC_PRICE";

export type Service = {
  slug: string;
  name: string;
  categorySlug: string;
  shortDescription: string;
  publicPricingMode: PublicPricingMode;
  enabled: boolean;
};

export type ServiceCategory = {
  slug: string;
  name: string;
};

export const serviceCategories: ServiceCategory[] = [
  { slug: "decorative-walls", name: "Decorative Walls" },
];

export const services: Service[] = [
  {
    slug: "wall-panels",
    name: "Wall Panels",
    categorySlug: "decorative-walls",
    shortDescription: "Fluted, slat, MDF and PVC panel installation.",
    publicPricingMode: "QUOTE_ONLY",
    enabled: true,
  },
  {
    slug: "marble-sheets",
    name: "Marble Sheets",
    categorySlug: "decorative-walls",
    shortDescription: "Marble and faux-marble sheet wall installation.",
    publicPricingMode: "QUOTE_ONLY",
    enabled: true,
  },
  {
    slug: "wallpaper",
    name: "Wallpaper",
    categorySlug: "decorative-walls",
    shortDescription: "Decorative wallpaper and wall coverings.",
    publicPricingMode: "QUOTE_ONLY",
    enabled: true,
  },
  {
    slug: "decorative-partitions",
    name: "Decorative Partitions",
    categorySlug: "decorative-walls",
    shortDescription: "Lightweight decorative wall partitions.",
    publicPricingMode: "QUOTE_ONLY",
    enabled: true,
  },
];

export function getEnabledServices(): Service[] {
  return services.filter((s) => s.enabled);
}
