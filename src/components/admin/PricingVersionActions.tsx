"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PricingVersionActions({ versionId, status }: { versionId: string; status: "DRAFT" | "ACTIVE" | "RETIRED" }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "activate" | "retire") {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/pricing/versions/${versionId}/${action}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not update this version.");
      setSubmitting(false);
      return;
    }
    router.refresh();
    setSubmitting(false);
  }

  if (status === "RETIRED") {
    return <p className="text-sm text-ink-muted">This version is retired — no further changes.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <button
          type="button"
          onClick={() => act("activate")}
          disabled={submitting}
          className="rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
        >
          {submitting ? "Activating…" : "Activate"}
        </button>
      )}
      <button
        type="button"
        onClick={() => act("retire")}
        disabled={submitting}
        className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink/20 disabled:opacity-60"
      >
        {submitting ? "Working…" : status === "DRAFT" ? "Discard draft" : "Retire"}
      </button>
      {error && <span className="text-sm text-coral">{error}</span>}
    </div>
  );
}
