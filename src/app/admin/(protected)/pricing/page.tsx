import Link from "next/link";
import { listPricingVersions } from "@/lib/admin/pricing";
import { formatCadMinor } from "@/lib/quote/units";
import { formatDateTime } from "@/lib/admin/status-display";
import { getEnabledServices } from "@/lib/services-data";
import { Card, EmptyState, PageHeader, StatusChip, DefinitionRow } from "@/components/admin/ui";

export const metadata = { title: "Pricing" };

const STATUS_TONE = { DRAFT: "neutral", ACTIVE: "teal", RETIRED: "neutral" } as const;

export default async function AdminPricingPage() {
  const versions = await listPricingVersions("toronto");
  const active = versions.find((v) => v.status === "ACTIVE");
  const serviceNames = new Map(getEnabledServices().map((s) => [s.slug, s.name]));

  return (
    <div>
      <PageHeader
        title="Pricing"
        description="Toronto launch pricing — versioned, never edited in place. Not a fully automated economics platform; the smallest model that supports the real MVP."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/pricing/simulator"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-ink/20"
            >
              Simulator
            </Link>
            <Link
              href="/admin/pricing/new"
              className="rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
            >
              + New draft version
            </Link>
          </div>
        }
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Active version</h2>
      {!active ? (
        <EmptyState
          title="No active pricing version"
          description="The customer funnel will show 'pricing unavailable' until a draft version is activated. Create and activate one to go live."
        />
      ) : (
        <Card className="mb-8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-ink">{active.label}</p>
              <p className="text-sm text-ink-muted">
                Active since {active.activatedAt ? formatDateTime(active.activatedAt) : "—"}
              </p>
            </div>
            <Link
              href={`/admin/pricing/${active.id}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/20"
            >
              View details
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
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
                {active.rules.map((r) => (
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
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <dl>
              <DefinitionRow label="Tax" value={active.taxLabel} />
              <DefinitionRow label="Professional payout" value={`${active.professionalPayoutPercentOfLabor}% of labor`} />
              <DefinitionRow label="Material cost assumption" value={`${active.materialCostPercentOfCustomerRate}% of material rate`} />
            </dl>
            <dl>
              <DefinitionRow label="Processing assumption" value={`${active.paymentProcessingPercent}% + ${formatCadMinor(active.paymentProcessingFixedMinor)}`} />
              <DefinitionRow label="CAC assumption" value={formatCadMinor(active.estimatedCacMinor)} />
              <DefinitionRow label="Health thresholds" value={`${active.healthyMarginPercent}% / ${active.acceptableMarginPercent}% / ${active.lowMarginPercent}%`} />
            </dl>
          </div>
        </Card>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">All versions</h2>
      {versions.length === 0 ? (
        <EmptyState title="No pricing versions yet" description="Create a draft version to get started." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Label</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Services</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Created by</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {versions.map((v) => (
                <tr key={v.id} className="hover:bg-offwhite">
                  <td className="px-4 py-3 text-ink">{v.label}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={STATUS_TONE[v.status]}>{v.status}</StatusChip>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{v.rules.length}</td>
                  <td className="px-4 py-3 text-ink-muted">{formatDateTime(v.createdAt)}</td>
                  <td className="px-4 py-3 text-ink-muted">{v.createdByAdmin?.email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/pricing/${v.id}`} className="font-semibold text-purple hover:text-purple-dark">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
