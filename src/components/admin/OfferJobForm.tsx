"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCadMinor } from "@/lib/quote/units";

/**
 * The Session F primary path (D035): Admin OFFERS a job to a professional
 * with an explicit amount, rather than silently treating them as already
 * accepted. Posts to /api/admin/jobs/[id]/offer — the pre-existing
 * /api/admin/jobs/[id]/assign route (and AssignProfessionalButton) still
 * exist, unmodified, but are no longer linked from this page.
 */
export function OfferJobForm({
  jobId,
  professionalId,
  estimatedPayoutMinor,
}: {
  jobId: string;
  professionalId: string;
  estimatedPayoutMinor: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(
    estimatedPayoutMinor != null ? String((estimatedPayoutMinor / 100).toFixed(2)) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalId, offerAmountMinor: Math.round(dollars * 100) }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not send this offer.");
      setSubmitting(false);
      return;
    }
    router.push(`/admin/jobs/${jobId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-ink-muted">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={`Offer amount for professional ${professionalId}`}
          className="w-24 rounded-lg border border-border px-2 py-1 text-sm text-ink"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-purple px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
        >
          {submitting ? "Sending…" : "Offer"}
        </button>
      </div>
      {estimatedPayoutMinor != null && (
        <span className="text-xs text-ink-muted">Estimated: {formatCadMinor(estimatedPayoutMinor)}</span>
      )}
      {error && <span className="text-xs text-coral-text">{error}</span>}
    </div>
  );
}
