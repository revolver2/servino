"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuote } from "@/lib/quote/quote-provider";
import { getLeadAdapter } from "@/lib/quote/lead/get-lead-adapter";
import { getAnalyticsAdapter } from "@/lib/quote/analytics/get-analytics-adapter";
import { LeadAdapterError } from "@/types/lead";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactStep() {
  const { quote, updateQuote } = useQuote();
  const router = useRouter();
  const analytics = getAnalyticsAdapter();
  const formRenderedAt = useRef(new Date().toISOString());
  const startedTracked = useRef(false);

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (startedTracked.current) return;
    startedTracked.current = true;
    analytics.track({ name: "contact_started" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!quote) return null;

  const firstNameError = touched && firstName.trim().length === 0 ? "Enter your first name" : null;
  const emailError = touched && !EMAIL_RE.test(email.trim()) ? "Enter a valid email address" : null;
  const phoneError = touched && phone.trim().replace(/[^0-9]/g, "").length < 7 ? "Enter a valid phone number" : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);

    if (firstName.trim().length === 0 || !EMAIL_RE.test(email.trim()) || phone.trim().replace(/[^0-9]/g, "").length < 7) {
      return;
    }

    setSubmitting(true);
    try {
      await getLeadAdapter().saveContactDetails(quote!.sessionId, {
        firstName: firstName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        honeypot,
        formRenderedAt: formRenderedAt.current,
      });
      analytics.track({ name: "contact_captured" });
      updateQuote({ contactCaptured: true, currentStep: "contact" });
      router.push("/quote/timing");
    } catch (err) {
      const message =
        err instanceof LeadAdapterError
          ? err.message
          : "Something went wrong saving your details. Please try again.";
      setSubmitError(message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Where should we send your project details?
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        We&apos;ll use this to follow up on your Servino project quote.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-2xl border border-border bg-white p-5 sm:p-6" noValidate>
        {/* Honeypot — hidden from sighted users, real users never fill this. */}
        <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
          <label htmlFor="company">Company</label>
          <input
            id="company"
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-ink">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
            aria-invalid={Boolean(firstNameError)}
            aria-describedby={firstNameError ? "firstName-error" : undefined}
          />
          {firstNameError && (
            <p id="firstName-error" className="mt-2 text-sm text-coral-text">
              {firstNameError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "email-error" : undefined}
          />
          {emailError && (
            <p id="email-error" className="mt-2 text-sm text-coral-text">
              {emailError}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-ink">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 w-full rounded-xl border border-border px-4 py-3 text-base text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
            aria-invalid={Boolean(phoneError)}
            aria-describedby={phoneError ? "phone-error" : undefined}
          />
          {phoneError && (
            <p id="phone-error" className="mt-2 text-sm text-coral-text">
              {phoneError}
            </p>
          )}
        </div>

        {submitError && (
          <div className="flex items-start gap-2 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-coral-text">
              <path
                d="M12 8v5M12 16h.01M12 3l9 16H3l9-16z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{submitError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-full bg-purple px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
