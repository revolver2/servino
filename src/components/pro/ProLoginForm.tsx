"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ProLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/pro/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not sign in. Please try again.");
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
        <label htmlFor="pro-email" className="block text-sm font-medium text-ink">
          Email
        </label>
        <input
          id="pro-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
      </div>

      <div>
        <label htmlFor="pro-password" className="block text-sm font-medium text-ink">
          Password
        </label>
        <input
          id="pro-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
