"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AssignProfessionalButton({
  jobId,
  professionalId,
  label = "Assign",
}: {
  jobId: string;
  professionalId: string;
  label?: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalId }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not assign.");
      setSubmitting(false);
      return;
    }
    router.push(`/admin/jobs/${jobId}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={submitting}
        className="rounded-full bg-purple px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Assigning…" : label}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}
