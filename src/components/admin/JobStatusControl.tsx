"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jobStatusLabel } from "@/lib/admin/status-display";

export function JobStatusControl({ jobId, allowedNext }: { jobId: string; allowedNext: string[] }) {
  const router = useRouter();
  const [target, setTarget] = useState(allowedNext[0] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (allowedNext.length === 0) {
    return <p className="text-sm text-ink-muted">No further status changes are available from here.</p>;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not change status.");
      setSubmitting(false);
      return;
    }
    router.refresh();
    setSubmitting(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="job-next-status" className="sr-only">
        Next job status
      </label>
      <select
        id="job-next-status"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-lg border border-border px-3 py-2 text-sm text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
      >
        {allowedNext.map((s) => (
          <option key={s} value={s}>
            Move to: {jobStatusLabel(s)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Updating…" : "Update status"}
      </button>
      {error && <span className="text-sm text-coral">{error}</span>}
    </div>
  );
}
