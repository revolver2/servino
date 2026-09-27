"use client";

import { useState } from "react";
import { formatCadMinor } from "@/lib/quote/units";
import { Card, DefinitionRow, StatusChip } from "@/components/admin/ui";

type Version = { id: string; label: string; status: "DRAFT" | "ACTIVE" | "RETIRED" };
type Service = { slug: string; name: string };

type SimResult = {
  customer: { subtotalMinor: number; taxMinor: number; taxLabel: string; totalMinor: number; minimumApplied: boolean };
  internal: {
    professionalPayoutEstimateMinor: number;
    materialCostEstimateMinor: number;
    processingEstimateMinor: number;
    cacAssumptionMinor: number;
    otherVariableCostMinor: number;
    contributionProfitMinor: number;
    contributionMarginPercent: number;
    quoteHealth: "HEALTHY" | "ACCEPTABLE" | "LOW_MARGIN" | "UNPROFITABLE";
  };
};

const HEALTH_TONE = {
  HEALTHY: "teal",
  ACCEPTABLE: "purple",
  LOW_MARGIN: "coral",
  UNPROFITABLE: "coral",
} as const;

async function simulate(pricingVersionId: string, serviceSlug: string, totalAreaM2: number, materialOwnership: string) {
  const res = await fetch("/api/admin/pricing/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pricingVersionId, serviceSlug, totalAreaM2, materialOwnership }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message ?? "Simulation failed.");
  return json.data as SimResult;
}

function ScenarioCard({ title, result }: { title: string; result: SimResult | null }) {
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      {!result ? (
        <p className="mt-3 text-sm text-ink-muted">Run a simulation to see results.</p>
      ) : (
        <>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</p>
          <dl className="mt-1">
            <DefinitionRow label="Subtotal" value={formatCadMinor(result.customer.subtotalMinor)} />
            <DefinitionRow label={result.customer.taxLabel} value={formatCadMinor(result.customer.taxMinor)} />
            <DefinitionRow label="Total" value={formatCadMinor(result.customer.totalMinor)} />
            {result.customer.minimumApplied && (
              <DefinitionRow label="Minimum applied" value="Yes" />
            )}
          </dl>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">Internal (never shown to customer)</p>
          <dl className="mt-1">
            <DefinitionRow label="Professional payout" value={formatCadMinor(result.internal.professionalPayoutEstimateMinor)} />
            <DefinitionRow label="Material cost" value={formatCadMinor(result.internal.materialCostEstimateMinor)} />
            <DefinitionRow label="Processing" value={formatCadMinor(result.internal.processingEstimateMinor)} />
            <DefinitionRow label="CAC" value={formatCadMinor(result.internal.cacAssumptionMinor)} />
            <DefinitionRow label="Other variable" value={formatCadMinor(result.internal.otherVariableCostMinor)} />
            <DefinitionRow
              label="Contribution profit"
              value={
                <span className={result.internal.contributionProfitMinor < 0 ? "text-coral-text" : undefined}>
                  {formatCadMinor(result.internal.contributionProfitMinor)}
                </span>
              }
            />
            <DefinitionRow label="Contribution margin" value={`${result.internal.contributionMarginPercent}%`} />
          </dl>
          <div className="mt-3">
            <StatusChip tone={HEALTH_TONE[result.internal.quoteHealth]}>{result.internal.quoteHealth.replace("_", " ")}</StatusChip>
          </div>
        </>
      )}
    </Card>
  );
}

export function PricingSimulator({ versions, services }: { versions: Version[]; services: Service[] }) {
  const defaultVersion = versions.find((v) => v.status === "ACTIVE") ?? versions[0];
  const [versionId, setVersionId] = useState(defaultVersion.id);
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug ?? "");
  const [area, setArea] = useState("10");
  const [installOnlyResult, setInstallOnlyResult] = useState<SimResult | null>(null);
  const [materialInstallResult, setMaterialInstallResult] = useState<SimResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSimulate() {
    const areaNum = Number(area);
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      setError("Enter a valid area greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const [installOnly, materialInstall] = await Promise.all([
        simulate(versionId, serviceSlug, areaNum, "INSTALL_ONLY"),
        simulate(versionId, serviceSlug, areaNum, "MATERIAL_AND_INSTALL"),
      ]);
      setInstallOnlyResult(installOnly);
      setMaterialInstallResult(materialInstall);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Card className="mb-6 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="sim-version" className="block text-sm font-medium text-ink">Pricing version</label>
            <select
              id="sim-version"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({v.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sim-service" className="block text-sm font-medium text-ink">Service</label>
            <select
              id="sim-service"
              value={serviceSlug}
              onChange={(e) => setServiceSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sim-area" className="block text-sm font-medium text-ink">Area (m²)</label>
            <input
              id="sim-area"
              type="number"
              step="0.1"
              min="0.1"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={submitting}
              className="w-full rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark disabled:opacity-60"
            >
              {submitting ? "Simulating…" : "Simulate"}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ScenarioCard title="A — Installation only" result={installOnlyResult} />
        <ScenarioCard title="B — Material + installation" result={materialInstallResult} />
      </div>
    </div>
  );
}
