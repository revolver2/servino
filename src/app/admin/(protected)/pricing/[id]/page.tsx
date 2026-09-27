import { notFound } from "next/navigation";
import { getPricingVersionDetail } from "@/lib/admin/pricing";
import { formatCadMinor } from "@/lib/quote/units";
import { formatDateTime } from "@/lib/admin/status-display";
import { getEnabledServices } from "@/lib/services-data";
import { Card, DefinitionRow, PageHeader, StatusChip } from "@/components/admin/ui";
import { PricingVersionActions } from "@/components/admin/PricingVersionActions";

export const metadata = { title: "Pricing version" };

const STATUS_TONE = { DRAFT: "neutral", ACTIVE: "teal", RETIRED: "neutral" } as const;

export default async function AdminPricingVersionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = await getPricingVersionDetail(id);
  if (!version) notFound();

  const serviceNames = new Map(getEnabledServices().map((s) => [s.slug, s.name]));

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={version.label}
        description={`${version.citySlug} · created ${formatDateTime(version.createdAt)} by ${version.createdByAdmin?.email ?? "unknown"}`}
        actions={<StatusChip tone={STATUS_TONE[version.status]}>{version.status}</StatusChip>}
      />

      <Card className="mb-4 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Lifecycle</h2>
        <div className="mt-3">
          <PricingVersionActions versionId={version.id} status={version.status} />
        </div>
        <dl className="mt-4">
          <DefinitionRow label="Effective" value={version.effectiveAt ? formatDateTime(version.effectiveAt) : "—"} />
          <DefinitionRow label="Activated" value={version.activatedAt ? formatDateTime(version.activatedAt) : "—"} />
          <DefinitionRow label="Retired" value={version.retiredAt ? formatDateTime(version.retiredAt) : "—"} />
        </dl>
        {version.notes && <p className="mt-3 text-sm text-ink-muted">{version.notes}</p>}
      </Card>

      <Card className="mb-4 overflow-x-auto p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer rates</h2>
        <table className="mt-3 w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th scope="col" className="py-2 pr-4">Service</th>
              <th scope="col" className="py-2 pr-4">Install only /m²</th>
              <th scope="col" className="py-2 pr-4">Material /m²</th>
              <th scope="col" className="py-2 pr-4">Material+Install /m²</th>
              <th scope="col" className="py-2">Minimum job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {version.rules.map((r) => (
              <tr key={r.id}>
                <td className="py-2 pr-4 text-ink">{serviceNames.get(r.serviceSlug) ?? r.serviceSlug}</td>
                <td className="py-2 pr-4 text-ink">{formatCadMinor(r.installOnlyRateMinorPerM2)}</td>
                <td className="py-2 pr-4 text-ink">{formatCadMinor(r.materialRateMinorPerM2)}</td>
                <td className="py-2 pr-4 text-ink">
                  {formatCadMinor(r.installOnlyRateMinorPerM2 + r.materialRateMinorPerM2)}
                </td>
                <td className="py-2 text-ink">{formatCadMinor(r.minimumSubtotalMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-ink-muted">Tax: {version.taxLabel} ({String(version.taxRatePercent)}%)</p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Internal economics assumptions</h2>
        <div className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          <dl>
            <DefinitionRow label="Professional payout" value={`${version.professionalPayoutPercentOfLabor}% of labor`} />
            <DefinitionRow label="Material cost estimate" value={`${version.materialCostPercentOfCustomerRate}% of material rate`} />
            <DefinitionRow
              label="Processing estimate"
              value={`${version.paymentProcessingPercent}% + ${formatCadMinor(version.paymentProcessingFixedMinor)}`}
            />
          </dl>
          <dl>
            <DefinitionRow label="CAC assumption" value={formatCadMinor(version.estimatedCacMinor)} />
            <DefinitionRow label="Other variable cost" value={formatCadMinor(version.otherVariableCostMinor)} />
            <DefinitionRow
              label="Quote health (healthy / acceptable / low)"
              value={`${version.healthyMarginPercent}% / ${version.acceptableMarginPercent}% / ${version.lowMarginPercent}%`}
            />
          </dl>
        </div>
      </Card>
    </div>
  );
}
