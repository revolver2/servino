import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentDetail, approximateActualProcessingFeeMinor } from "@/lib/admin/payments";
import { formatCadMinor } from "@/lib/quote/units";
import { paymentStatusLabel, paymentStatusTone, formatDateTime } from "@/lib/admin/status-display";
import { Card, DefinitionRow, PageHeader, StatusChip } from "@/components/admin/ui";
import { ReconcilePaymentButton } from "@/components/admin/ReconcilePaymentButton";
import { RefundPaymentButton } from "@/components/admin/RefundPaymentButton";

export const metadata = { title: "Payment detail" };

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await getPaymentDetail(id);
  if (!payment) notFound();

  const canRefund = payment.status === "CAPTURED";
  const economics = payment.quoteSnapshot.economicsSnapshot;
  const showFeeComparison = payment.status === "CAPTURED" && economics;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Payment detail"
        description={`Payment ${payment.id} · Job ${payment.jobId}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={paymentStatusTone(payment.status)}>{paymentStatusLabel(payment.status)}</StatusChip>
            <Link
              href={`/admin/jobs/${payment.jobId}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/20"
            >
              View job
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Amount</h2>
          <dl className="mt-3">
            <DefinitionRow label="Subtotal" value={formatCadMinor(payment.quoteSnapshot.subtotalMinor)} />
            <DefinitionRow label={payment.quoteSnapshot.taxLabel} value={formatCadMinor(payment.quoteSnapshot.taxMinor)} />
            <DefinitionRow label="Total charged" value={formatCadMinor(payment.amountMinor)} />
            <DefinitionRow label="Currency" value={payment.currency} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Provider reference</h2>
          <dl className="mt-3">
            <DefinitionRow label="Provider" value={payment.provider} />
            <DefinitionRow label="Order ID" value={<span className="font-mono text-xs">{payment.paypalOrderId ?? "—"}</span>} />
            <DefinitionRow label="Capture ID" value={<span className="font-mono text-xs">{payment.paypalCaptureId ?? "—"}</span>} />
          </dl>
          {payment.paypalOrderId && (
            <div className="mt-3">
              <ReconcilePaymentButton paymentId={payment.id} />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer</h2>
          <dl className="mt-3">
            <DefinitionRow label="Name" value={payment.job.lead.contact?.firstName ?? "—"} />
            <DefinitionRow label="Email" value={payment.job.lead.contact?.email ?? "—"} />
          </dl>
        </Card>

        {showFeeComparison && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Processing fee — estimated vs. approximate actual
            </h2>
            <dl className="mt-3">
              <DefinitionRow
                label="Estimated (Session E assumption at quote time)"
                value={formatCadMinor(economics!.processingEstimateMinor)}
              />
              <DefinitionRow
                label="Approximate actual (published PayPal Canada rate)"
                value={formatCadMinor(approximateActualProcessingFeeMinor(payment.amountMinor))}
              />
            </dl>
            <p className="mt-2 text-xs text-ink-muted">
              Not PayPal&apos;s own reported per-transaction fee — calculated from the published domestic rate
              (2.90% + $0.30 CAD). The Session E estimate itself is never overwritten by this.
            </p>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Payment events</h2>
          {payment.events.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No events recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {payment.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-ink">
                    {event.eventType} <span className="text-ink-muted">({event.source})</span>
                  </span>
                  <span className="text-xs text-ink-muted">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {payment.refunds.length > 0 && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Refunds</h2>
            <ul className="mt-3 space-y-2">
              {payment.refunds.map((refund) => (
                <li key={refund.id} className="rounded-xl bg-offwhite px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{formatCadMinor(refund.amountMinor)} — {refund.status}</span>
                    <span className="text-xs text-ink-muted">{formatDateTime(refund.createdAt)}</span>
                  </div>
                  {refund.reason && <p className="mt-1 text-ink-muted">{refund.reason}</p>}
                  <p className="mt-1 text-xs text-ink-muted">Requested by {refund.requestedByAdmin.email}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {canRefund && (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Refund</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Issues a full refund of {formatCadMinor(payment.amountMinor)} back to the customer&apos;s original
              payment method.
              {payment.job.payout?.status === "PAID" && (
                <span className="mt-2 block rounded-lg bg-coral-light px-3 py-2 text-ink">
                  The professional has already been paid for this job — a refund will not automatically reverse
                  that. Manual reconciliation with the professional may be required.
                </span>
              )}
            </p>
            <div className="mt-3">
              <RefundPaymentButton paymentId={payment.id} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
