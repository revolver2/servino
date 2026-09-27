"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Service = { slug: string; name: string };

type RuleInput = {
  serviceSlug: string;
  installOnlyRate: string; // dollars, as typed
  materialRate: string;
  minimumSubtotal: string;
};

function dollarsToMinor(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** Toronto Launch v1 defaults — see docs/DECISIONS.md D028 for the research/methodology behind every number here. All fields remain editable; nothing here is auto-activated. */
function defaultRuleFor(slug: string): RuleInput {
  const defaults: Record<string, { install: number; material: number; min: number }> = {
    "wall-panels": { install: 65, material: 85, min: 350 },
    wallpaper: { install: 55, material: 22, min: 350 },
    "marble-sheets": { install: 75, material: 110, min: 350 },
    "decorative-partitions": { install: 55, material: 50, min: 350 },
  };
  const d = defaults[slug] ?? { install: 0, material: 0, min: 350 };
  return {
    serviceSlug: slug,
    installOnlyRate: String(d.install),
    materialRate: String(d.material),
    minimumSubtotal: String(d.min),
  };
}

export function PricingVersionForm({ services }: { services: Service[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("Toronto Launch v1");
  const [taxRatePercent, setTaxRatePercent] = useState("13");
  const [taxLabel, setTaxLabel] = useState("HST (13%)");
  const [payoutPercent, setPayoutPercent] = useState("75");
  const [materialCostPercent, setMaterialCostPercent] = useState("70");
  const [processingPercent, setProcessingPercent] = useState("2.9");
  const [processingFixed, setProcessingFixed] = useState("0.30");
  const [cac, setCac] = useState("75");
  const [otherVariable, setOtherVariable] = useState("10");
  const [healthyMargin, setHealthyMargin] = useState("30");
  const [acceptableMargin, setAcceptableMargin] = useState("15");
  const [lowMargin, setLowMargin] = useState("5");
  const [notes, setNotes] = useState(
    "Toronto launch rates — see docs/research/SERVICE_PRICING_RESEARCH.md and docs/DECISIONS.md D028."
  );
  const [rules, setRules] = useState<RuleInput[]>(services.map((s) => defaultRuleFor(s.slug)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRule(slug: string, patch: Partial<RuleInput>) {
    setRules((prev) => prev.map((r) => (r.serviceSlug === slug ? { ...r, ...patch } : r)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      citySlug: "toronto",
      label,
      taxRatePercent: Number(taxRatePercent),
      taxLabel,
      professionalPayoutPercentOfLabor: Number(payoutPercent),
      materialCostPercentOfCustomerRate: Number(materialCostPercent),
      paymentProcessingPercent: Number(processingPercent),
      paymentProcessingFixedMinor: dollarsToMinor(processingFixed),
      estimatedCacMinor: dollarsToMinor(cac),
      otherVariableCostMinor: dollarsToMinor(otherVariable),
      healthyMarginPercent: Number(healthyMargin),
      acceptableMarginPercent: Number(acceptableMargin),
      lowMarginPercent: Number(lowMargin),
      notes,
      rules: rules.map((r) => ({
        serviceSlug: r.serviceSlug,
        installOnlyRateMinorPerM2: dollarsToMinor(r.installOnlyRate),
        materialRateMinorPerM2: dollarsToMinor(r.materialRate),
        minimumSubtotalMinor: dollarsToMinor(r.minimumSubtotal),
      })),
    };

    const res = await fetch("/api/admin/pricing/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      setError(json.message ?? "Could not create this pricing version.");
      setSubmitting(false);
      return;
    }

    router.push(`/admin/pricing/${json.data.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <label htmlFor="label" className="block text-sm font-medium text-ink">
          Version label
        </label>
        <input
          id="label"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer rates (CAD dollars per m²)</legend>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="py-2 pr-3">Service</th>
                <th scope="col" className="py-2 pr-3">Install only</th>
                <th scope="col" className="py-2 pr-3">Material</th>
                <th scope="col" className="py-2">Minimum job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((r) => {
                const service = services.find((s) => s.slug === r.serviceSlug);
                const serviceLabel = service?.name ?? r.serviceSlug;
                return (
                  <tr key={r.serviceSlug}>
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">{serviceLabel}</th>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.installOnlyRate}
                        onChange={(e) => updateRule(r.serviceSlug, { installOnlyRate: e.target.value })}
                        aria-label={`${serviceLabel} — install only rate per m²`}
                        className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.materialRate}
                        onChange={(e) => updateRule(r.serviceSlug, { materialRate: e.target.value })}
                        aria-label={`${serviceLabel} — material rate per m²`}
                        className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={r.minimumSubtotal}
                        onChange={(e) => updateRule(r.serviceSlug, { minimumSubtotal: e.target.value })}
                        aria-label={`${serviceLabel} — minimum job charge`}
                        className="w-24 rounded-lg border border-border px-2 py-1.5 text-sm text-ink"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Tax</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="taxRatePercent" className="block text-sm font-medium text-ink">Tax rate (%)</label>
            <input id="taxRatePercent" type="number" step="0.01" min="0" value={taxRatePercent} onChange={(e) => setTaxRatePercent(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="taxLabel" className="block text-sm font-medium text-ink">Tax label</label>
            <input id="taxLabel" value={taxLabel} onChange={(e) => setTaxLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Internal economics assumptions</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="payoutPercent" className="block text-sm font-medium text-ink">Professional payout (% of labor)</label>
            <input id="payoutPercent" type="number" step="0.01" min="0" max="100" value={payoutPercent} onChange={(e) => setPayoutPercent(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="materialCostPercent" className="block text-sm font-medium text-ink">Material cost (% of material rate)</label>
            <input id="materialCostPercent" type="number" step="0.01" min="0" max="100" value={materialCostPercent} onChange={(e) => setMaterialCostPercent(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="processingPercent" className="block text-sm font-medium text-ink">Processing (%)</label>
            <input id="processingPercent" type="number" step="0.01" min="0" value={processingPercent} onChange={(e) => setProcessingPercent(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="processingFixed" className="block text-sm font-medium text-ink">Processing fixed fee ($)</label>
            <input id="processingFixed" type="number" step="0.01" min="0" value={processingFixed} onChange={(e) => setProcessingFixed(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="cac" className="block text-sm font-medium text-ink">CAC assumption ($)</label>
            <input id="cac" type="number" step="0.01" min="0" value={cac} onChange={(e) => setCac(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="otherVariable" className="block text-sm font-medium text-ink">Other variable cost ($)</label>
            <input id="otherVariable" type="number" step="0.01" min="0" value={otherVariable} onChange={(e) => setOtherVariable(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Quote health thresholds (contribution margin %)</legend>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="healthyMargin" className="block text-sm font-medium text-ink">Healthy ≥</label>
            <input id="healthyMargin" type="number" step="0.01" min="0" max="100" value={healthyMargin} onChange={(e) => setHealthyMargin(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="acceptableMargin" className="block text-sm font-medium text-ink">Acceptable ≥</label>
            <input id="acceptableMargin" type="number" step="0.01" min="0" max="100" value={acceptableMargin} onChange={(e) => setAcceptableMargin(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
          <div>
            <label htmlFor="lowMargin" className="block text-sm font-medium text-ink">Low-margin ≥ (below = unprofitable)</label>
            <input id="lowMargin" type="number" step="0.01" min="0" max="100" value={lowMargin} onChange={(e) => setLowMargin(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
          </div>
        </div>
      </fieldset>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-ink">Notes</label>
        <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink" />
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
        {submitting ? "Saving…" : "Create draft version"}
      </button>
    </form>
  );
}
