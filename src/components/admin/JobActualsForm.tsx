"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  jobId: string;
  initial: {
    actualMaterialCostMinor: number | null;
    actualCacMinor: number | null;
    actualOtherVariableCostMinor: number | null;
    note: string | null;
  } | null;
};

function minorToDollarsString(minor: number | null): string {
  return minor === null ? "" : (minor / 100).toFixed(2);
}

function dollarsStringToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

/**
 * Post-job actual-cost entry (spec sections 38–40). Deliberately blank
 * by default for material cost and CAC — a blank field saves as
 * `null` (UNKNOWN), never silently coerced to $0 (spec section 46).
 * "Other variable cost" is the one field pre-filled to $0.00, matching
 * the one documented exception in JobActuals' own schema comment.
 */
export function JobActualsForm({ jobId, initial }: Props) {
  const router = useRouter();
  const [materialCost, setMaterialCost] = useState(minorToDollarsString(initial?.actualMaterialCostMinor ?? null));
  const [cac, setCac] = useState(minorToDollarsString(initial?.actualCacMinor ?? null));
  const [otherCost, setOtherCost] = useState(
    initial?.actualOtherVariableCostMinor != null ? minorToDollarsString(initial.actualOtherVariableCostMinor) : "0.00"
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch(`/api/admin/jobs/${jobId}/actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualMaterialCostMinor: dollarsStringToMinor(materialCost),
        actualCacMinor: dollarsStringToMinor(cac),
        actualOtherVariableCostMinor: dollarsStringToMinor(otherCost),
        note: note.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not save actual costs.");
      setSubmitting(false);
      return;
    }
    setSaved(true);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm text-ink-muted">
        Enter what you actually know once this job is done — leave a field blank if you genuinely don&apos;t know
        it yet. Blank is not the same as $0 and is shown as &ldquo;unknown&rdquo; on the launch dashboard.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="actual-material" className="block text-xs font-medium text-ink-muted">
            Actual material cost (CAD)
          </label>
          <input
            id="actual-material"
            type="number"
            step="0.01"
            min="0"
            placeholder="Unknown"
            value={materialCost}
            onChange={(e) => setMaterialCost(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="actual-cac" className="block text-xs font-medium text-ink-muted">
            Actual CAC for this job (CAD)
          </label>
          <input
            id="actual-cac"
            type="number"
            step="0.01"
            min="0"
            placeholder="Unknown"
            value={cac}
            onChange={(e) => setCac(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="actual-other" className="block text-xs font-medium text-ink-muted">
            Other variable cost (CAD)
          </label>
          <input
            id="actual-other"
            type="number"
            step="0.01"
            min="0"
            value={otherCost}
            onChange={(e) => setOtherCost(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="actual-note" className="block text-xs font-medium text-ink-muted">
          Note (optional)
        </label>
        <input
          id="actual-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
        />
      </div>

      {error && <p className="mt-3 text-sm text-coral-text">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-teal">Saved.</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Save actual costs"}
      </button>
    </div>
  );
}
