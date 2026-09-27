import type { StyleId } from "@/types/quote";

/**
 * Service-specific style taxonomy (Session H0.2). Before this, every
 * service showed the identical global list of 6 styles regardless of
 * relevance — a customer could pick "Light Oak" for Wall Panels, switch
 * to Wallpaper, and the wood-toned styles (and the stale selection
 * itself) would carry over even though they make no sense for
 * wallpaper. This module is the single source of truth for which
 * styles are valid for which service — imported by both the client
 * step component (`StyleMaterialStep`) and the server route
 * (`/api/lead/progress`) that persists it, the same isomorphic pattern
 * already used for `getEnabledServices()` (`src/lib/services-data.ts`).
 *
 * Style has no effect on price (verified: no pricing-engine code reads
 * `styleId` anywhere) — this remains a cosmetic/preference field only,
 * so no pricing differences were introduced by this taxonomy.
 */

export type Style = {
  id: StyleId;
  name: string;
  swatchClassName: string;
};

const WALL_PANEL_STYLES: Style[] = [
  { id: "light-oak", name: "Light Oak", swatchClassName: "bg-[#DCB98C]" },
  { id: "natural-wood", name: "Natural Wood", swatchClassName: "bg-[#C79A6B]" },
  { id: "dark-walnut", name: "Dark Walnut", swatchClassName: "bg-[#5A3A2A]" },
  { id: "black", name: "Black", swatchClassName: "bg-[#1A1A1E]" },
  { id: "white", name: "White", swatchClassName: "bg-white border border-border" },
];

const MARBLE_SHEET_STYLES: Style[] = [
  { id: "white-marble", name: "White Marble", swatchClassName: "bg-gradient-to-br from-white via-zinc-100 to-zinc-300" },
  { id: "grey-marble", name: "Grey Vein Marble", swatchClassName: "bg-gradient-to-br from-zinc-300 via-zinc-400 to-zinc-500" },
  { id: "black-marble", name: "Black Marble", swatchClassName: "bg-gradient-to-br from-zinc-700 via-zinc-900 to-black" },
];

const WALLPAPER_STYLES: Style[] = [
  { id: "neutral", name: "Neutral", swatchClassName: "bg-[#EDEBE6]" },
  { id: "textured", name: "Textured", swatchClassName: "bg-[#C9C2B4]" },
  { id: "geometric", name: "Geometric", swatchClassName: "bg-[#7C7B85]" },
  { id: "botanical", name: "Botanical", swatchClassName: "bg-[#7C8C6B]" },
];

const DECORATIVE_PARTITION_STYLES: Style[] = [
  { id: "wood-slat", name: "Wood Slat", swatchClassName: "bg-[#9C7B54]" },
  { id: "geometric", name: "Geometric", swatchClassName: "bg-[#7C7B85]" },
  { id: "minimal", name: "Minimal", swatchClassName: "bg-[#EDEBE6]" },
  { id: "black", name: "Black", swatchClassName: "bg-[#1A1A1E]" },
];

const STYLES_BY_SERVICE: Record<string, Style[]> = {
  "wall-panels": WALL_PANEL_STYLES,
  "marble-sheets": MARBLE_SHEET_STYLES,
  wallpaper: WALLPAPER_STYLES,
  "decorative-partitions": DECORATIVE_PARTITION_STYLES,
};

export function getStylesForService(serviceSlug: string | null | undefined): Style[] {
  if (!serviceSlug) return [];
  return STYLES_BY_SERVICE[serviceSlug] ?? [];
}

/** A null/unset style is always considered valid — "nothing selected yet" is never an invalid state. */
export function isStyleValidForService(styleId: string | null | undefined, serviceSlug: string | null | undefined): boolean {
  if (!styleId) return true;
  return getStylesForService(serviceSlug).some((s) => s.id === styleId);
}

/**
 * Display-name lookup across all services. Used by read-only surfaces
 * (price breakdown, confirmation) that only have a bare `styleId` and
 * want a name regardless of which service it belongs to — not for
 * deciding which styles to *offer*, which must always go through
 * `getStylesForService()` so an irrelevant style never becomes
 * selectable in the first place.
 */
export function getStyleName(styleId: string | null | undefined): string | undefined {
  if (!styleId) return undefined;
  for (const styles of Object.values(STYLES_BY_SERVICE)) {
    const match = styles.find((s) => s.id === styleId);
    if (match) return match.name;
  }
  return undefined;
}
