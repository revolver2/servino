"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Service = { slug: string; name: string };

export type ProfessionalFormValues = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  serviceAreaNote: string;
  notes: string;
  verificationStatus: string;
  active: boolean;
  serviceSlugs: string[];
};

const VERIFICATION_OPTIONS = [
  "MISSING",
  "SUBMITTED",
  "UNDER_REVIEW",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "SUSPENDED",
];

export function ProfessionalForm({
  mode,
  professionalId,
  initial,
  services,
}: {
  mode: "create" | "edit";
  professionalId?: string;
  initial: ProfessionalFormValues;
  services: Service[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfessionalFormValues>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProfessionalFormValues>(key: K, value: ProfessionalFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function toggleService(slug: string) {
    setValues((v) => ({
      ...v,
      serviceSlugs: v.serviceSlugs.includes(slug)
        ? v.serviceSlugs.filter((s) => s !== slug)
        : [...v.serviceSlugs, slug],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const url = mode === "create" ? "/api/admin/professionals" : `/api/admin/professionals/${professionalId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const body =
      mode === "create"
        ? {
            displayName: values.displayName,
            businessName: values.businessName || null,
            email: values.email,
            phone: values.phone,
            serviceAreaNote: values.serviceAreaNote || null,
            notes: values.notes || null,
            verificationStatus: values.verificationStatus,
            serviceSlugs: values.serviceSlugs,
          }
        : {
            displayName: values.displayName,
            businessName: values.businessName || null,
            email: values.email,
            phone: values.phone,
            serviceAreaNote: values.serviceAreaNote || null,
            notes: values.notes || null,
            verificationStatus: values.verificationStatus,
            active: values.active,
            serviceSlugs: values.serviceSlugs,
          };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not save. Please try again.");
      setSubmitting(false);
      return;
    }

    if (mode === "create") {
      router.push(`/admin/professionals/${json.data.id}`);
    } else {
      router.refresh();
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-ink">
            Name
          </label>
          <input
            id="displayName"
            required
            value={values.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </div>
        <div>
          <label htmlFor="businessName" className="block text-sm font-medium text-ink">
            Business name (optional)
          </label>
          <input
            id="businessName"
            value={values.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={values.email}
            onChange={(e) => update("email", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-ink">
            Phone
          </label>
          <input
            id="phone"
            type="tel"
            required
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
          />
        </div>
      </div>

      <div>
        <label htmlFor="serviceAreaNote" className="block text-sm font-medium text-ink">
          Service area note (optional)
        </label>
        <input
          id="serviceAreaNote"
          value={values.serviceAreaNote}
          onChange={(e) => update("serviceAreaNote", e.target.value)}
          placeholder="e.g. Downtown Toronto only"
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Services</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {services.map((s) => (
            <label key={s.slug} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.serviceSlugs.includes(s.slug)}
                onChange={() => toggleService(s.slug)}
                className="h-4 w-4 rounded border-border text-purple focus:ring-purple/30"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="verificationStatus" className="block text-sm font-medium text-ink">
            Verification status
          </label>
          <select
            id="verificationStatus"
            value={values.verificationStatus}
            onChange={(e) => update("verificationStatus", e.target.value)}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
          >
            {VERIFICATION_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        {mode === "edit" && (
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(e) => update("active", e.target.checked)}
                className="h-4 w-4 rounded border-border text-purple focus:ring-purple/30"
              />
              Active — eligible for assignment
            </label>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-ink">
          Internal notes (admin only)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={values.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-coral-light px-4 py-3 text-sm text-ink">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
      >
        {submitting ? "Saving…" : mode === "create" ? "Create professional" : "Save changes"}
      </button>
    </form>
  );
}
