import Link from "next/link";
import { getActionRequired, getOverviewMetrics, getRecentActivity } from "@/lib/admin/dashboard";
import { formatCadMinor } from "@/lib/quote/units";
import { formatDateTime } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Overview" };

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const [metrics, actionItems, activity] = await Promise.all([
    getOverviewMetrics(),
    getActionRequired(),
    getRecentActivity(15),
  ]);

  return (
    <div>
      <PageHeader title="Overview" description="Real-time operational snapshot from the database." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="New leads (7d)" value={String(metrics.newLeads7d)} />
        <MetricCard label="Submitted (7d)" value={String(metrics.bookingIntents7d)} />
        <MetricCard label="Unassigned jobs" value={String(metrics.unassignedJobs)} />
        <MetricCard label="Active jobs" value={String(metrics.activeJobs)} />
        <MetricCard label="Completed jobs" value={String(metrics.completedJobs)} />
        <MetricCard
          label="Pipeline value"
          value={formatCadMinor(metrics.pipelineQuoteValueMinor)}
          hint="Quoted total, not profit — see a job's Economics"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Payments pending" value={String(metrics.paymentsPending)} />
        <MetricCard label="Payments confirmed" value={String(metrics.paymentsConfirmed)} />
        <MetricCard label="Awaiting customer confirmation" value={String(metrics.completionAwaitingCustomer)} />
        <MetricCard label="Payouts eligible" value={String(metrics.payoutsEligible)} />
        <MetricCard label="Payouts held" value={String(metrics.payoutsHeld)} />
        <MetricCard label="Issues requiring attention" value={String(metrics.issuesRequiringAttention)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Action required</h2>
          {actionItems.length === 0 ? (
            <EmptyState title="Nothing needs attention" description="All jobs and professionals are in good shape." />
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {actionItems.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-offwhite"
                    >
                      <span className="text-ink">{item.title}</span>
                      <span className="ml-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-coral-light px-2 text-xs font-bold text-coral">
                        {item.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">Recent activity</h2>
          {activity.length === 0 ? (
            <EmptyState title="No activity yet" description="Customer and admin activity will appear here." />
          ) : (
            <Card>
              <ul className="divide-y divide-border">
                {activity.map((event, i) => {
                  const row = (
                    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                      <span className="text-ink">{event.label}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted">
                        {formatDateTime(event.at)}
                      </span>
                    </div>
                  );
                  return (
                    <li key={i}>
                      {event.href ? (
                        <Link href={event.href} className="block transition-colors hover:bg-offwhite">
                          {row}
                        </Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
