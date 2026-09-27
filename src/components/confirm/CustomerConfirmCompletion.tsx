"use client";

import { useEffect, useState } from "react";

type Context = {
  serviceName: string;
  jobStatus: string;
  alreadyResponded: boolean;
  lastIssue: { reasonCode: string } | null;
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

const REASON_LABELS: Record<string, string> = {
  INCOMPLETE: "Work wasn't finished",
  QUALITY: "Quality concern",
  DAMAGE: "Something was damaged",
  SCOPE: "Different from what was agreed",
  OTHER: "Other",
};

async function callApi<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return response.json();
}

export function CustomerConfirmCompletion({ token }: { token: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "issue">("idle");
  const [reasonCode, setReasonCode] = useState("INCOMPLETE");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"confirmed" | "reported" | null>(null);

  useEffect(() => {
    callApi<Context>(`/api/customer/context?token=${encodeURIComponent(token)}`).then((res) => {
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setContext(res.data);
    });
  }, [token]);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    const res = await callApi("/api/customer/confirm-completion", { token });
    if (!res.ok) {
      setError(res.message);
      setSubmitting(false);
      return;
    }
    setDone("confirmed");
    setSubmitting(false);
  }

  async function handleReportIssue() {
    setSubmitting(true);
    setError(null);
    const res = await callApi("/api/customer/report-issue", { token, reasonCode, note: note || undefined });
    if (!res.ok) {
      setError(res.message);
      setSubmitting(false);
      return;
    }
    setDone("reported");
    setSubmitting(false);
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
        {error}
      </div>
    );
  }

  if (!context) {
    return <p className="text-sm text-ink-muted">Loading…</p>;
  }

  if (done === "confirmed" || (context.alreadyResponded && !context.lastIssue)) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal text-white">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Thanks for confirming.</h1>
        <p className="mt-3 text-sm text-ink-muted">We&apos;ve recorded that your project is complete.</p>
      </div>
    );
  }

  if (done === "reported" || (context.alreadyResponded && context.lastIssue)) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">We&apos;ve received your report.</h1>
        <p className="mt-3 text-sm text-ink-muted">
          Someone from Servino will follow up with you about this
          {context.lastIssue ? ` (${REASON_LABELS[context.lastIssue.reasonCode] ?? context.lastIssue.reasonCode})` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">How did your project go?</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Your professional marked your {context.serviceName} project as complete. Let us know how it went.
      </p>

      {mode === "idle" && (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
          >
            {submitting ? "Confirming…" : "Work completed"}
          </button>
          <button
            type="button"
            onClick={() => setMode("issue")}
            disabled={submitting}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-offwhite disabled:opacity-60"
          >
            Report an issue
          </button>
        </div>
      )}

      {mode === "issue" && (
        <div className="mt-8">
          <label htmlFor="reasonCode" className="text-sm font-semibold text-ink">
            What went wrong?
          </label>
          <select
            id="reasonCode"
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-border px-3 py-2.5 text-sm text-ink"
          >
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="note" className="mt-4 block text-sm font-semibold text-ink">
            Add a note (optional)
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            className="mt-1.5 block w-full rounded-xl border border-border px-3 py-2.5 text-sm text-ink"
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReportIssue}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-coral px-6 py-3.5 text-base font-semibold text-white transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setMode("idle")}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-border px-6 py-3.5 text-base font-semibold text-ink transition-colors hover:bg-offwhite disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
