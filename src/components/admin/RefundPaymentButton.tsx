"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefundPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not issue this refund.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-coral px-4 py-2 text-sm font-semibold text-coral-text transition-colors hover:bg-coral-light"
      >
        Issue full refund
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-coral bg-coral-light p-4">
      <label htmlFor="refund-reason" className="text-sm font-semibold text-ink">
        Refund reason
      </label>
      <textarea
        id="refund-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
      />
      {error && <p className="mt-2 text-sm text-coral-text">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Refunding…" : "Confirm full refund"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={submitting}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
