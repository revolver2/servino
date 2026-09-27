"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ProActivateForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/pro/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not activate your account. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push("/pro");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="activate-password" className="block text-sm font-medium text-ink">
          Choose a password
        </label>
        <input
          id="activate-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
        <p className="mt-1 text-xs text-ink-muted">At least 12 characters.</p>
      </div>

      <div>
        <label htmlFor="activate-confirm" className="block text-sm font-medium text-ink">
          Confirm password
        </label>
        <input
          id="activate-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Setting up…" : "Set password and continue"}
      </button>
    </form>
  );
}
