"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCadMinor } from "@/lib/quote/units";

const METHODS = [
  { value: "E_TRANSFER", label: "E-transfer" },
  { value: "CASH", label: "Cash" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "DIRECT_DEPOSIT", label: "Direct deposit" },
  { value: "OTHER", label: "Other" },
];

export function RecordPayoutForm({ payoutId, agreedAmountMinor }: { payoutId: string; agreedAmountMinor: number }) {
  const router = useRouter();
  const [amountDollars, setAmountDollars] = useState((agreedAmountMinor / 100).toFixed(2));
  const [methodCategory, setMethodCategory] = useState("E_TRANSFER");
  const [externalReference, setExternalReference] = useState("");
  const [note, setNote] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinor = Math.round(parseFloat(amountDollars || "0") * 100);
  const isOverride = amountMinor !== agreedAmountMinor;

  async function handleSubmit() {
    if (isOverride && !overrideReason.trim()) {
      setError("A reason is required when the recorded amount differs from the agreed offer.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/payouts/${payoutId}/record`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor,
        methodCategory,
        externalReference: externalReference || undefined,
        note: note || undefined,
        amountOverrideReason: isOverride ? overrideReason : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not record this payout.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div>
      <p className="text-sm text-ink-muted">
        Record that you&apos;ve already paid this professional outside Servino (e-transfer, cash, etc). This does
        not send money — it only records what you did.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="block text-xs font-medium text-ink-muted">
            Amount paid (CAD)
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-ink-muted">Agreed offer: {formatCadMinor(agreedAmountMinor)}</p>
        </div>
        <div>
          <label htmlFor="method" className="block text-xs font-medium text-ink-muted">
            Method
          </label>
          <select
            id="method"
            value={methodCategory}
            onChange={(e) => setMethodCategory(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="reference" className="block text-xs font-medium text-ink-muted">
            Reference (optional)
          </label>
          <input
            id="reference"
            type="text"
            value={externalReference}
            onChange={(e) => setExternalReference(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="note" className="block text-xs font-medium text-ink-muted">
            Note (optional)
          </label>
          <input
            id="note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
      </div>

      {isOverride && (
        <div className="mt-4">
          <label htmlFor="override" className="block text-xs font-medium text-ink-muted">
            Reason for a different amount than the agreed offer ({formatCadMinor(agreedAmountMinor)})
          </label>
          <textarea
            id="override"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          />
        </div>
      )}

      {error && <p className="mt-3 text-sm text-coral-text">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Recording…" : "Record payout as paid"}
      </button>
    </div>
  );
}
