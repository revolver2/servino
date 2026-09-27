"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WithdrawOfferButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/offer/withdraw`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not withdraw this offer.");
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink-muted transition-colors hover:border-ink/20 hover:text-ink disabled:opacity-60"
      >
        {submitting ? "Withdrawing…" : "Withdraw offer"}
      </button>
      {error && <span className="text-xs text-coral-text">{error}</span>}
    </div>
  );
}
