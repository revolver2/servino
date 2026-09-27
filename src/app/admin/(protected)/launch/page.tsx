import Link from "next/link";
import { getJobEconomicsRows, summarizeLaunchEconomics } from "@/lib/admin/launch-economics";
import { formatCadMinor } from "@/lib/quote/units";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Launch — First 10 Jobs" };

const FIRST_MILESTONE = 10;

function money(minor: number | null): string {
  return minor === null ? "Unknown" : formatCadMinor(minor);
}

function moneyOrDash(minor: number): string {
  return formatCadMinor(minor);
}

/**
 * `/admin/launch` — spec sections 41–46: "Are the first 10 jobs working
 * economically?" Deliberately NOT a generic startup vanity dashboard —
 * every number here is a real query against the database (or an
 * explicit "Unknown"), never an estimate presented as fact and never a
 * missing actual silently shown as $0 (spec section 46).
 */
export default async function AdminLaunchPage() {
  const rows = await getJobEconomicsRows();
  const summary = summarizeLaunchEconomics(rows);

  const progress = Math.min(summary.completedPaidJobsCount, FIRST_MILESTONE);
  const incompleteRows = rows.filter((r) => !r.actualContributionComplete);

  return (
    <div>
      <PageHeader
        title="Launch"
        description="Is Servino's first 10 real Toronto jobs working economically? Every number below is real — nothing is estimated or faked."
      />

      <Card className="mb-6 p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">First business milestone</p>
        <p className="mt-2 text-5xl font-bold tracking-tight text-ink">
          {summary.completedPaidJobsCount} <span className="text-2xl font-medium text-ink-muted">/ {FIRST_MILESTONE}</span>
        </p>
        <p className="mt-2 text-sm text-ink-muted">completed, paid Toronto jobs</p>
        <div className="mx-auto mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-offwhite">
          <div
            className="h-full rounded-full bg-purple transition-all"
            style={{ width: `${(progress / FIRST_MILESTONE) * 100}%` }}
          />
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No paid jobs yet"
          description="Once a customer completes checkout, this dashboard will start tracking real launch economics."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Metric label="Paid jobs" value={String(summary.paidJobsCount)} />
            <Metric label="Completed jobs" value={String(summary.completedPaidJobsCount)} />
            <Metric
              label="Completion rate"
              value={summary.completionRate === null ? "—" : `${Math.round(summary.completionRate * 100)}%`}
            />
            <Metric label="Customer revenue" value={moneyOrDash(summary.totalRevenueMinor)} />
            <Metric
              label="Average order value"
              value={summary.averageOrderValueMinor === null ? "—" : moneyOrDash(summary.averageOrderValueMinor)}
            />
            <Metric
              label="Professional compensation (paid)"
              value={moneyOrDash(summary.totalActualPayoutMinor)}
              hint={`${summary.jobsWithPayoutPaidCount} of ${summary.paidJobsCount} jobs recorded paid`}
            />
            <Metric
              label="Payment fees (approx.)"
              value={moneyOrDash(summary.totalActualProcessingFeeApproxMinor)}
              hint="Calculated from PayPal's published rate, not their own reported fee"
            />
            <Metric label="Refunds" value={moneyOrDash(summary.totalRefundMinor)} />
            <Metric label="Estimated CAC (Session E, total)" value={money(summary.totalEstimatedCacMinor)} />
            <Metric label="Actual CAC (total, where entered)" value={money(summary.totalActualCacMinor)} />
            <Metric
              label="Actual contribution profit"
              value={money(summary.totalActualContributionMinor)}
              hint={
                summary.totalActualContributionMinor === null
                  ? `${summary.jobsWithCompleteActualsCount} of ${summary.paidJobsCount} jobs have complete actuals`
                  : undefined
              }
            />
            <Metric label="Estimated contribution profit (Session E, total)" value={money(summary.totalEstimatedContributionMinor)} />
          </div>

          {incompleteRows.length > 0 && (
            <Card className="mt-6 p-4">
              <p className="text-sm font-semibold text-ink">
                {incompleteRows.length} job{incompleteRows.length === 1 ? "" : "s"} missing actual cost data
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Actual contribution profit can&apos;t be computed for these until the missing fields are entered on
                each job&apos;s detail page.
              </p>
            </Card>
          )}

          <Card className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1400px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th scope="col" className="px-4 py-3">Job</th>
                  <th scope="col" className="px-4 py-3">Service</th>
                  <th scope="col" className="px-4 py-3">Revenue</th>
                  <th scope="col" className="px-4 py-3">Est. Pro</th>
                  <th scope="col" className="px-4 py-3">Actual Pro</th>
                  <th scope="col" className="px-4 py-3">Est. Fee</th>
                  <th scope="col" className="px-4 py-3">Approx. Actual Fee</th>
                  <th scope="col" className="px-4 py-3">Est. Material</th>
                  <th scope="col" className="px-4 py-3">Actual Material</th>
                  <th scope="col" className="px-4 py-3">Est. CAC</th>
                  <th scope="col" className="px-4 py-3">Actual CAC</th>
                  <th scope="col" className="px-4 py-3">Refund</th>
                  <th scope="col" className="px-4 py-3">Est. Contribution</th>
                  <th scope="col" className="px-4 py-3">Actual Contribution</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.jobId} className="hover:bg-offwhite">
                    <td className="px-4 py-3">
                      <Link href={`/admin/jobs/${row.jobId}`} className="font-semibold text-purple hover:text-purple-dark">
                        {row.customerFirstName ?? row.jobId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink">{row.serviceSlug ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{moneyOrDash(row.revenueTotalMinor)}</td>
                    <td className="px-4 py-3 text-ink-muted">{money(row.estimatedPayoutMinor)}</td>
                    <td className="px-4 py-3 text-ink">{money(row.actualPayoutMinor)}</td>
                    <td className="px-4 py-3 text-ink-muted">{money(row.estimatedProcessingFeeMinor)}</td>
                    <td className="px-4 py-3 text-ink">{moneyOrDash(row.actualProcessingFeeApproxMinor)}</td>
                    <td className="px-4 py-3 text-ink-muted">{money(row.estimatedMaterialCostMinor)}</td>
                    <td className="px-4 py-3 text-ink">{money(row.actualMaterialCostMinor)}</td>
                    <td className="px-4 py-3 text-ink-muted">{money(row.estimatedCacMinor)}</td>
                    <td className="px-4 py-3 text-ink">{money(row.actualCacMinor)}</td>
                    <td className="px-4 py-3 text-ink">{row.refundMinor > 0 ? moneyOrDash(row.refundMinor) : "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{money(row.estimatedContributionMinor)}</td>
                    <td className="px-4 py-3 font-semibold text-ink">
                      {row.actualContributionComplete ? (
                        <span className={row.actualContributionMinor! < 0 ? "text-coral-text" : undefined}>
                          {moneyOrDash(row.actualContributionMinor!)}
                        </span>
                      ) : (
                        <span className="text-ink-muted" title={row.missingActualFields.join(", ")}>
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.jobStatus}
                      {row.hasUnresolvedIssue && <span className="ml-1 text-coral-text">· issue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}
