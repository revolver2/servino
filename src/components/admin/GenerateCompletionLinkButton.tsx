"use client";

import { useState } from "react";

/** Same one-time-display pattern as GenerateActivationLinkButton (D033) — never persisted client-side beyond this component's own state. */
export function GenerateCompletionLinkButton({ jobId }: { jobId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    setLink(null);
    const res = await fetch(`/api/admin/jobs/${jobId}/completion-token`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not generate a confirmation link.");
      setSubmitting(false);
      return;
    }
    setLink(`${window.location.origin}${json.data.confirmPath}`);
    setSubmitting(false);
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={submitting}
        className="rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Generating…" : "Generate confirmation link"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-text">{error}</p>}
      {link && (
        <div className="mt-3 rounded-lg border border-border bg-offwhite p-3">
          <p className="text-xs text-ink-muted">
            Deliver this link to the customer yourself — valid 14 days, single-use.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1.5 text-xs text-ink">{link}</code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
