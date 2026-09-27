import type { MeasurementsState, MeasurementUnit, WallMeasurement } from "@/types/quote";

/** 1 foot in meters. */
const FT_TO_M = 0.3048;

/** 1 square foot in square meters — derived from FT_TO_M so the two constants can never drift apart. */
const FT2_TO_M2 = FT_TO_M * FT_TO_M;

/**
 * Converts a single length value between metric (m) and imperial (ft).
 * Used when a visitor switches units mid-entry (spec: unit switching must
 * preserve the physical dimensions, not just re-label the number).
 */
export function convertLength(value: number, from: MeasurementUnit, to: MeasurementUnit): number {
  if (from === to) return value;
  return from === "imperial" ? value * FT_TO_M : value / FT_TO_M;
}

/** Rounds a length for display/storage — same 2-decimal precision as roundM2. */
export function roundLength(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Converts a wall dimension for a unit switch. Returns null for a blank
 * or non-finite value rather than propagating NaN/Infinity — an
 * unconvertible value is treated the same as "not entered yet," never
 * corrupted into a nonsense number.
 */
export function convertWallDimension(value: number | null, from: MeasurementUnit, to: MeasurementUnit): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return roundLength(convertLength(value, from, to));
}

/**
 * Area for a single wall, in square meters, computed in the wall's native
 * unit first and converted once — avoids compounding rounding error from
 * converting each dimension separately.
 */
export function wallAreaM2(wall: WallMeasurement, unit: MeasurementsState["unit"]): number {
  if (wall.width == null || wall.height == null) return 0;
  if (wall.width <= 0 || wall.height <= 0) return 0;

  const areaNative = wall.width * wall.height;
  return unit === "imperial" ? areaNative * FT2_TO_M2 : areaNative;
}

export function totalAreaM2(state: MeasurementsState): number {
  return state.walls.reduce((sum, wall) => sum + wallAreaM2(wall, state.unit), 0);
}

/** Sane bounds for a single residential wall dimension, per unit. */
const DIMENSION_BOUNDS: Record<MeasurementsState["unit"], { min: number; max: number }> = {
  metric: { min: 0.1, max: 15 },
  imperial: { min: 0.3, max: 50 },
};

export function dimensionError(value: number | null, unit: MeasurementsState["unit"]): string | null {
  if (value == null || Number.isNaN(value)) return "Required";
  const { min, max } = DIMENSION_BOUNDS[unit];
  if (value <= 0) return "Must be greater than 0";
  if (value < min) return `Must be at least ${min}`;
  if (value > max) return `That seems too large — check the unit`;
  return null;
}

/** Rounds to 2 decimal places for display — internal math stays unrounded. */
export function roundM2(areaM2: number): number {
  return Math.round(areaM2 * 100) / 100;
}

// ---------------------------------------------------------------------------
// Money — always integer minor units (cents). Never use floats for money.
// ---------------------------------------------------------------------------

export function formatCadMinor(minor: number): string {
  const dollars = minor / 100;
  return dollars.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
