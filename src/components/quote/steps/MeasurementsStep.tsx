"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeasurementUnit, WallMeasurement } from "@/types/quote";
import { makeWallId } from "@/types/quote";
import { useQuote } from "@/lib/quote/quote-provider";
import { convertWallDimension, dimensionError, roundM2, totalAreaM2, wallAreaM2 } from "@/lib/quote/units";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";

const MAX_WALLS = 8;

export function MeasurementsStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();

  const [unit, setUnit] = useState<MeasurementUnit>(quote?.measurements.unit ?? "metric");
  const [walls, setWalls] = useState<WallMeasurement[]>(
    quote?.measurements.walls ?? [{ id: makeWallId(), width: null, height: null }]
  );
  const [touched, setTouched] = useState(false);

  if (!quote) return null;

  const unitLabel = unit === "metric" ? "m" : "ft";
  const total = roundM2(totalAreaM2({ unit, walls }));

  function updateWall(id: string, patch: Partial<WallMeasurement>) {
    setWalls((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }

  function addWall() {
    if (walls.length >= MAX_WALLS) return;
    setWalls((prev) => [...prev, { id: makeWallId(), width: null, height: null }]);
  }

  function removeWall(id: string) {
    setWalls((prev) => (prev.length > 1 ? prev.filter((w) => w.id !== id) : prev));
  }

  function handleUnitChange(next: MeasurementUnit) {
    if (next === unit) return;
    // Switching units must preserve the physical dimensions already
    // entered, not discard them — convert every wall's width/height into
    // the new unit rather than clearing the form.
    setWalls((prev) =>
      prev.map((w) => ({
        ...w,
        width: convertWallDimension(w.width, unit, next),
        height: convertWallDimension(w.height, unit, next),
      }))
    );
    setUnit(next);
  }

  const hasErrors = walls.some(
    (w) => dimensionError(w.width, unit) !== null || dimensionError(w.height, unit) !== null
  );

  function handleContinue() {
    setTouched(true);
    if (hasErrors || total <= 0) return;

    const measurements = { unit, walls };
    updateQuote({ measurements });
    analytics.track({ name: "measurements_completed", totalAreaM2: total, wallCount: walls.length });
    router.push("/quote/photo");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Tell us about your wall
      </h1>

      <div className="mt-5 inline-flex rounded-full border border-border p-1">
        {(["metric", "imperial"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleUnitChange(option)}
            aria-pressed={unit === option}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              unit === option ? "bg-purple text-white" : "text-ink-muted"
            }`}
          >
            {option === "metric" ? "Metric (m)" : "Imperial (ft)"}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {walls.map((wall, index) => {
          const widthErr = touched ? dimensionError(wall.width, unit) : null;
          const heightErr = touched ? dimensionError(wall.height, unit) : null;
          const area = roundM2(wallAreaM2(wall, unit));

          return (
            <div key={wall.id} className="rounded-2xl border border-border p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-light text-xs font-bold text-purple-dark">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-ink">Wall {index + 1}</p>
                </div>
                {walls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeWall(wall.id)}
                    className="text-xs font-medium text-ink-muted hover:text-coral-text"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`width-${wall.id}`} className="block text-xs font-medium text-ink-muted">
                    Width ({unitLabel})
                  </label>
                  <input
                    id={`width-${wall.id}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={wall.width ?? ""}
                    onChange={(e) =>
                      updateWall(wall.id, { width: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
                    aria-invalid={Boolean(widthErr)}
                  />
                  {widthErr && <p className="mt-1 text-xs text-coral-text">{widthErr}</p>}
                </div>

                <div>
                  <label htmlFor={`height-${wall.id}`} className="block text-xs font-medium text-ink-muted">
                    Height ({unitLabel})
                  </label>
                  <input
                    id={`height-${wall.id}`}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    value={wall.height ?? ""}
                    onChange={(e) =>
                      updateWall(wall.id, { height: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
                    aria-invalid={Boolean(heightErr)}
                  />
                  {heightErr && <p className="mt-1 text-xs text-coral-text">{heightErr}</p>}
                </div>
              </div>

              {area > 0 && !widthErr && !heightErr && (
                <p className="mt-2 text-xs text-ink-muted">Area: {area} m²</p>
              )}
            </div>
          );
        })}
      </div>

      {walls.length < MAX_WALLS && (
        <button
          type="button"
          onClick={addWall}
          className="mt-4 text-sm font-semibold text-purple hover:text-purple-dark"
        >
          + Add another wall
        </button>
      )}

      <div className="mt-8 flex items-center justify-between rounded-2xl border border-border bg-offwhite px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-teal" />
          Total project area
        </span>
        <span className="text-lg font-semibold text-ink">{total} m²</span>
      </div>

      {touched && (hasErrors || total <= 0) && (
        <p className="mt-2 text-sm text-coral-text">Enter valid dimensions for at least one wall.</p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark sm:w-auto"
      >
        Continue
      </button>
    </div>
  );
}
