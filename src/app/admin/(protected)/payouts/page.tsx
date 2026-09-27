import Link from "next/link";
import { listPayouts } from "@/lib/admin/payouts";
import { formatCadMinor } from "@/lib/quote/units";
import { payoutStatusLabel, payoutStatusTone, formatDateTime } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState, StatusChip } from "@/components/admin/ui";

export const metadata = { title: "Payouts" };

const STATUS_OPTIONS = ["ELIGIBLE", "PAID", "HELD", "CANCELLED"];

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { payouts, total, page, totalPages } = await listPayouts({
    status: sp.status,
    page: sp.page ? Number(sp.page) : undefined,
  });

  return (
    <div>
      <PageHeader title="Payouts" description={`${total} professional payout${total === 1 ? "" : "s"}.`} />

      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-ink-muted">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={sp.status ?? ""}
              className="mt-1 rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {payoutStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
          >
            Filter
          </button>
          {sp.status && (
            <Link href="/admin/payouts" className="text-sm font-medium text-ink-muted hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {payouts.length === 0 ? (
        <EmptyState title="No payouts found" description="Payouts become eligible once a job's completion is confirmed and payment is captured." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Professional</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="px-4 py-3">Payment</th>
                <th scope="col" className="px-4 py-3">Issue</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Since</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-offwhite">
                  <td className="px-4 py-3 text-ink">{payout.professional.displayName}</td>
                  <td className="px-4 py-3 text-ink">{formatCadMinor(payout.amountMinor)}</td>
                  <td className="px-4 py-3 text-ink-muted">{payout.job.payment?.status ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {payout.job.customerIssueReports.length > 0 ? "Unresolved" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip tone={payoutStatusTone(payout.status)}>{payoutStatusLabel(payout.status)}</StatusChip>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(payout.eligibleAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/payouts/${payout.id}`} className="font-semibold text-purple hover:text-purple-dark">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Page {page} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}
