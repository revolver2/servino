"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReconcilePaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/payments/${paymentId}/reconcile`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not reconcile this payment.");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink/20 disabled:opacity-60"
      >
        {submitting ? "Reconciling…" : "Reconcile with provider"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-text">{error}</p>}
    </div>
  );
}
