"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { reasonLabel } from "@/lib/pro/display";

const DECLINE_REASONS = ["UNAVAILABLE", "TIMING", "OUTSIDE_AREA", "NOT_SUITABLE", "OTHER"] as const;
const PROBLEM_REASONS = [
  "CUSTOMER_UNAVAILABLE",
  "ACCESS_PROBLEM",
  "MATERIAL_PROBLEM",
  "SCOPE_DIFFERS",
  "SAFETY_CONCERN",
  "CANNOT_COMPLETE",
  "OTHER",
] as const;

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message ?? "Something went wrong. Please try again.");
  }
  return json.data;
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full bg-purple px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-full border border-border px-6 py-3 text-sm font-semibold text-ink-muted transition-colors hover:border-ink/20 hover:text-ink disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function DeclineDialog({ jobId, onCancel }: { jobId: string; onCancel: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState<(typeof DECLINE_REASONS)[number]>("UNAVAILABLE");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await post(`/api/pro/jobs/${jobId}/decline`, { reason, note: note || undefined });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not decline this job.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm font-semibold text-ink">Why are you declining?</p>
      <div className="mt-3 space-y-2">
        {DECLINE_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="decline-reason" checked={reason === r} onChange={() => setReason(r)} />
            {reasonLabel(r)}
          </label>
        ))}
      </div>
      <label htmlFor="decline-note" className="mt-3 block text-xs font-medium text-ink-muted">
        Optional note
      </label>
      <textarea
        id="decline-note"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-coral-text">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <SecondaryButton onClick={onCancel} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <PrimaryButton onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Declining…" : "Confirm decline"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ProblemDialog({ jobId, onCancel }: { jobId: string; onCancel: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState<(typeof PROBLEM_REASONS)[number]>("ACCESS_PROBLEM");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await post(`/api/pro/jobs/${jobId}/problem`, { reasonCode: reason, note: note || undefined });
      onCancel();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not report this problem.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm font-semibold text-ink">What&apos;s the problem?</p>
      {reason === "SAFETY_CONCERN" && (
        <p className="mt-2 rounded-lg bg-coral-light px-3 py-2 text-xs text-ink">
          If this is a safety concern, stop work and report it. Admin will follow up.
        </p>
      )}
      <div className="mt-3 space-y-2">
        {PROBLEM_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm text-ink">
            <input type="radio" name="problem-reason" checked={reason === r} onChange={() => setReason(r)} />
            {reasonLabel(r)}
          </label>
        ))}
      </div>
      <label htmlFor="problem-note" className="mt-3 block text-xs font-medium text-ink-muted">
        Details (optional)
      </label>
      <textarea
        id="problem-note"
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-coral-text">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <SecondaryButton onClick={onCancel} disabled={submitting}>
          Cancel
        </SecondaryButton>
        <PrimaryButton onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Reporting…" : "Report problem"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function ProJobActions({ jobId, status }: { jobId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [showProblem, setShowProblem] = useState(false);

  async function handleAction(path: string) {
    setBusy(true);
    setError(null);
    try {
      await post(path);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (showDecline) return <DeclineDialog jobId={jobId} onCancel={() => setShowDecline(false)} />;
  if (showProblem) return <ProblemDialog jobId={jobId} onCancel={() => setShowProblem(false)} />;

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-coral-text">
          {error}
        </p>
      )}

      {status === "OFFERED" && (
        <>
          <PrimaryButton onClick={() => handleAction(`/api/pro/jobs/${jobId}/accept`)} disabled={busy}>
            {busy ? "Accepting…" : "Accept job"}
          </PrimaryButton>
          <SecondaryButton onClick={() => setShowDecline(true)} disabled={busy}>
            Decline
          </SecondaryButton>
        </>
      )}

      {status === "ASSIGNED" && (
        <PrimaryButton onClick={() => handleAction(`/api/pro/jobs/${jobId}/en-route`)} disabled={busy}>
          {busy ? "Updating…" : "En route"}
        </PrimaryButton>
      )}

      {status === "EN_ROUTE" && (
        <PrimaryButton onClick={() => handleAction(`/api/pro/jobs/${jobId}/arrived`)} disabled={busy}>
          {busy ? "Updating…" : "Arrived"}
        </PrimaryButton>
      )}

      {status === "ARRIVED" && (
        <PrimaryButton onClick={() => handleAction(`/api/pro/jobs/${jobId}/start`)} disabled={busy}>
          {busy ? "Updating…" : "Start job"}
        </PrimaryButton>
      )}

      {status === "IN_PROGRESS" && (
        <>
          <PrimaryButton onClick={() => handleAction(`/api/pro/jobs/${jobId}/complete`)} disabled={busy}>
            {busy ? "Updating…" : "Complete job"}
          </PrimaryButton>
          <SecondaryButton onClick={() => setShowProblem(true)} disabled={busy}>
            Report a problem
          </SecondaryButton>
        </>
      )}

      {(status === "COMPLETED" || status === "DISPUTED") && (
        <p className="text-sm text-ink-muted">
          Completion reported. This does not yet mean payment has been made — Servino doesn&apos;t process payments yet.
        </p>
      )}
    </div>
  );
}
