import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayoutDetail } from "@/lib/admin/payouts";
import { formatCadMinor } from "@/lib/quote/units";
import {
  payoutStatusLabel,
  payoutStatusTone,
  paymentStatusLabel,
  customerIssueReasonLabel,
  formatDateTime,
} from "@/lib/admin/status-display";
import { Card, DefinitionRow, PageHeader, StatusChip } from "@/components/admin/ui";
import { RecordPayoutForm } from "@/components/admin/RecordPayoutForm";

export const metadata = { title: "Payout detail" };

export default async function AdminPayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payout = await getPayoutDetail(id);
  if (!payout) notFound();

  const unresolvedIssue = payout.job.customerIssueReports.find((r) => !r.resolved);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Payout detail"
        description={`Payout ${payout.id} · Job ${payout.jobId}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={payoutStatusTone(payout.status)}>{payoutStatusLabel(payout.status)}</StatusChip>
            <Link
              href={`/admin/jobs/${payout.jobId}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/20"
            >
              View job
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Professional</h2>
          <dl className="mt-3">
            <DefinitionRow
              label="Name"
              value={
                <Link href={`/admin/professionals/${payout.professional.id}`} className="text-purple hover:text-purple-dark">
                  {payout.professional.displayName}
                </Link>
              }
            />
            <DefinitionRow label="Agreed offer" value={formatCadMinor(payout.jobOffer.offerAmountMinor)} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Eligibility</h2>
          <dl className="mt-3">
            <DefinitionRow label="Customer payment" value={paymentStatusLabel(payout.job.payment?.status ?? "—")} />
            <DefinitionRow label="Eligible since" value={formatDateTime(payout.eligibleAt)} />
          </dl>
          {unresolvedIssue && (
            <div className="mt-3 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
              <p className="font-semibold">Unresolved customer issue — {customerIssueReasonLabel(unresolvedIssue.reasonCode)}</p>
              {unresolvedIssue.note && <p className="mt-1 text-ink-muted">{unresolvedIssue.note}</p>}
            </div>
          )}
          {payout.heldReason && payout.status === "HELD" && (
            <div className="mt-3 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
              <p className="font-semibold">Held — {payout.heldReason}</p>
            </div>
          )}
          {payout.status === "PAID" && payout.job.payment && payout.job.payment.status !== "CAPTURED" && (
            <div className="mt-3 rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
              <p className="font-semibold">
                This professional was already paid, but the customer payment is now {paymentStatusLabel(payout.job.payment.status)}.
                Manual review may be required.
              </p>
            </div>
          )}
        </Card>

        {payout.status === "PAID" ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Payout record</h2>
            <dl className="mt-3">
              <DefinitionRow label="Amount paid" value={formatCadMinor(payout.amountMinor)} />
              <DefinitionRow label="Method" value={payout.methodCategory ?? "—"} />
              <DefinitionRow label="Reference" value={payout.externalReference ?? "—"} />
              <DefinitionRow label="Paid at" value={payout.paidAt ? formatDateTime(payout.paidAt) : "—"} />
              <DefinitionRow label="Recorded by" value={payout.recordedByAdmin?.email ?? "—"} />
              {payout.amountOverrideReason && <DefinitionRow label="Override reason" value={payout.amountOverrideReason} />}
              {payout.note && <DefinitionRow label="Note" value={payout.note} />}
            </dl>
          </Card>
        ) : payout.status === "ELIGIBLE" ? (
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Record payout</h2>
            <div className="mt-3">
              <RecordPayoutForm payoutId={payout.id} agreedAmountMinor={payout.jobOffer.offerAmountMinor} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
