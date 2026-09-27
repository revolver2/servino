"use client";

import { useState } from "react";

/**
 * Displays the raw activation link exactly once, client-side only, never
 * persisted anywhere beyond this component's own state (D033/spec section
 * 59) — refreshing or navigating away loses it, which is intentional; a
 * new link can always be generated again.
 */
export function GenerateActivationLinkButton({ professionalId }: { professionalId: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setSubmitting(true);
    setError(null);
    setLink(null);
    const res = await fetch(`/api/admin/professionals/${professionalId}/activation`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not generate an activation link.");
      setSubmitting(false);
      return;
    }
    setLink(`${window.location.origin}${json.data.activationPath}`);
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
        {submitting ? "Generating…" : "Generate activation link"}
      </button>
      {error && <p className="mt-2 text-sm text-coral-text">{error}</p>}
      {link && (
        <div className="mt-3 rounded-lg border border-border bg-offwhite p-3">
          <p className="text-xs text-ink-muted">
            Deliver this link to the professional yourself (text/call/email) — it&apos;s only shown here once, valid
            24 hours, and single-use.
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
