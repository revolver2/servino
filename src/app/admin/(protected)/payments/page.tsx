import Link from "next/link";
import { listPayments } from "@/lib/admin/payments";
import { formatCadMinor } from "@/lib/quote/units";
import { paymentStatusLabel, paymentStatusTone, formatDateTime } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState, StatusChip } from "@/components/admin/ui";

export const metadata = { title: "Payments" };

const STATUS_OPTIONS = [
  "PENDING",
  "CREATED",
  "APPROVED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "DISPUTED",
];

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { payments, total, page, totalPages } = await listPayments({
    status: sp.status,
    page: sp.page ? Number(sp.page) : undefined,
  });

  return (
    <div>
      <PageHeader title="Payments" description={`${total} customer payment${total === 1 ? "" : "s"}.`} />

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
                  {paymentStatusLabel(s)}
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
            <Link href="/admin/payments" className="text-sm font-medium text-ink-muted hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {payments.length === 0 ? (
        <EmptyState title="No payments found" description="Customer payments will appear here once checkout begins." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="px-4 py-3">Provider</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Refunds</th>
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-offwhite">
                  <td className="px-4 py-3 text-ink">{payment.job.lead.contact?.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{formatCadMinor(payment.amountMinor)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">
                    {payment.paypalCaptureId ?? payment.paypalOrderId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusChip>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{payment.refunds.length > 0 ? payment.refunds.length : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(payment.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/payments/${payment.id}`} className="font-semibold text-purple hover:text-purple-dark">
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
