import Link from "next/link";
import { notFound } from "next/navigation";
import { getJobDetail, getJobFieldTimestamps } from "@/lib/admin/jobs";
import { getJobTimeline } from "@/lib/admin/timeline";
import { formatCadMinor } from "@/lib/quote/units";
import {
  jobStatusLabel,
  jobStatusTone,
  timingLabel,
  materialOwnershipLabel,
  formatDateTime,
  pricingSourceLabel,
  quoteHealthLabel,
  quoteHealthTone,
  reasonCodeLabel,
  offerStatusLabel,
  offerStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
  payoutStatusLabel,
  payoutStatusTone,
  customerIssueReasonLabel,
} from "@/lib/admin/status-display";
import { allowedNextStatusesForManualControl, type JobStatus } from "@/lib/server/job-status";
import { Card, DefinitionRow, PageHeader, StatusChip } from "@/components/admin/ui";
import { JobStatusControl } from "@/components/admin/JobStatusControl";
import { WithdrawOfferButton } from "@/components/admin/WithdrawOfferButton";
import { GenerateCompletionLinkButton } from "@/components/admin/GenerateCompletionLinkButton";
import { AdminConfirmCompletionButton } from "@/components/admin/AdminConfirmCompletionButton";
import { JobActualsForm } from "@/components/admin/JobActualsForm";

export const metadata = { title: "Job detail" };

export default async function AdminJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [job, timeline, fieldTimestamps] = await Promise.all([
    getJobDetail(id),
    getJobTimeline(id),
    getJobFieldTimestamps(id),
  ]);
  if (!job) notFound();

  const snapshot = job.bookingIntent.quoteSnapshot;
  const openOffer = job.offers.find((o) => o.status === "OFFERED");
  const acceptedOffer = job.offers.find((o) => o.status === "ACCEPTED");
  const estimatedPayoutMinor = snapshot?.economicsSnapshot?.professionalPayoutEstimateMinor ?? null;
  const compensationDeltaMinor =
    acceptedOffer && estimatedPayoutMinor != null ? acceptedOffer.offerAmountMinor - estimatedPayoutMinor : null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={job.lead.contact?.firstName ? `${job.lead.contact.firstName}'s project` : "Job"}
        description={`Job ${job.id} · Lead ${job.leadId}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusChip>
            <Link
              href={`/admin/leads/${job.leadId}`}
              className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink/20"
            >
              View lead
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer</h2>
          <dl className="mt-3">
            <DefinitionRow label="Name" value={job.lead.contact?.firstName ?? "—"} />
            <DefinitionRow label="Email" value={job.lead.contact?.email ?? "—"} />
            <DefinitionRow label="Phone" value={job.lead.contact?.phone ?? "—"} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Project</h2>
          <dl className="mt-3">
            <DefinitionRow label="Service" value={job.lead.serviceSlug ?? "—"} />
            <DefinitionRow label="Location" value={job.lead.citySlug ?? "—"} />
            <DefinitionRow label="Total area" value={job.lead.totalAreaM2 !== null ? `${job.lead.totalAreaM2} m²` : "—"} />
            <DefinitionRow label="Style" value={job.lead.styleId ?? "—"} />
            <DefinitionRow label="Material ownership" value={materialOwnershipLabel(job.lead.materialOwnership)} />
            <DefinitionRow label="Timing" value={timingLabel(job.lead.timing?.value ?? null)} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Quote</h2>
          {snapshot ? (
            <dl className="mt-3">
              <DefinitionRow label="Subtotal" value={formatCadMinor(snapshot.subtotalMinor)} />
              <DefinitionRow label={snapshot.taxLabel} value={formatCadMinor(snapshot.taxMinor)} />
              <DefinitionRow label="Total" value={formatCadMinor(snapshot.totalMinor)} />
              <DefinitionRow label="Pricing source" value={pricingSourceLabel(snapshot.pricingSource)} />
              {snapshot.pricingVersion && (
                <DefinitionRow label="Pricing version" value={snapshot.pricingVersion.label} />
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No quote snapshot on file.</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Payment</h2>
            {job.payment && (
              <StatusChip tone={paymentStatusTone(job.payment.status)}>{paymentStatusLabel(job.payment.status)}</StatusChip>
            )}
          </div>
          {job.payment ? (
            <dl className="mt-3">
              <DefinitionRow label="Amount" value={formatCadMinor(job.payment.amountMinor)} />
              <DefinitionRow
                label="Refunds"
                value={job.payment.refunds.length > 0 ? `${job.payment.refunds.length} issued` : "None"}
              />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No payment started yet.</p>
          )}
          {job.payment && (
            <Link
              href={`/admin/payments/${job.payment.id}`}
              className="mt-3 inline-block text-sm font-semibold text-purple hover:text-purple-dark"
            >
              View payment detail →
            </Link>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Professional</h2>
          <dl className="mt-3">
            <DefinitionRow
              label="Assigned"
              value={
                job.assignedProfessional ? (
                  <Link href={`/admin/professionals/${job.assignedProfessional.id}`} className="text-purple hover:text-purple-dark">
                    {job.assignedProfessional.displayName}
                  </Link>
                ) : (
                  "Unassigned"
                )
              }
            />
            {job.assignedAt && <DefinitionRow label="Since" value={formatDateTime(job.assignedAt)} />}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {openOffer && <WithdrawOfferButton jobId={job.id} />}
            <Link
              href={`/admin/professionals?offerTo=${job.id}`}
              className="text-sm font-semibold text-purple hover:text-purple-dark"
            >
              {job.assignedProfessional ? "Offer to someone else →" : "Offer this job →"}
            </Link>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Offer &amp; field workflow</h2>
          {job.offers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No offer has been sent for this job yet.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Offer history</p>
                <ul className="mt-2 space-y-2">
                  {job.offers.map((offer) => (
                    <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-ink">
                        {offer.professional.displayName} — {formatCadMinor(offer.offerAmountMinor)}
                        {offer.declineReason && (
                          <span className="text-ink-muted"> · {reasonCodeLabel(offer.declineReason)}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-muted">
                        {formatDateTime(offer.offeredAt)}
                        <StatusChip tone={offerStatusTone(offer.status)}>{offerStatusLabel(offer.status)}</StatusChip>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {acceptedOffer && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-border pt-3 text-sm sm:grid-cols-4">
                  <FieldStamp label="Accepted" at={acceptedOffer.respondedAt} />
                  <FieldStamp label="En route" at={fieldTimestamps.JOB_EN_ROUTE ?? null} />
                  <FieldStamp label="Arrived" at={fieldTimestamps.JOB_ARRIVED ?? null} />
                  <FieldStamp label="Started" at={fieldTimestamps.JOB_STARTED ?? null} />
                  <FieldStamp label="Completion reported" at={fieldTimestamps.JOB_COMPLETION_REPORTED ?? null} />
                </div>
              )}

              {acceptedOffer && estimatedPayoutMinor != null && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Estimated vs. actual compensation (internal — never shown to the customer or professional)
                  </p>
                  <dl className="mt-2">
                    <DefinitionRow label="Estimated (Session E assumption)" value={formatCadMinor(estimatedPayoutMinor)} />
                    <DefinitionRow label="Actual offered" value={formatCadMinor(acceptedOffer.offerAmountMinor)} />
                    <DefinitionRow
                      label="Difference"
                      value={
                        <span className={compensationDeltaMinor != null && compensationDeltaMinor > 0 ? "text-coral-text" : undefined}>
                          {compensationDeltaMinor != null ? formatCadMinor(compensationDeltaMinor) : "—"}
                        </span>
                      }
                    />
                  </dl>
                </div>
              )}
            </div>
          )}
        </Card>

        {job.problemReports.length > 0 && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Problem reports</h2>
            <ul className="mt-3 space-y-3">
              {job.problemReports.map((report) => (
                <li key={report.id} className="rounded-xl bg-coral-light px-4 py-3 text-sm">
                  <p className="font-semibold text-ink">
                    {reasonCodeLabel(report.reasonCode)} — reported by {report.professional.displayName}
                  </p>
                  {report.note && <p className="mt-1 text-ink-muted">{report.note}</p>}
                  <p className="mt-1 text-xs text-ink-muted">{formatDateTime(report.reportedAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {job.customerIssueReports.length > 0 && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer issue reports</h2>
            <ul className="mt-3 space-y-3">
              {job.customerIssueReports.map((report) => (
                <li key={report.id} className="rounded-xl bg-coral-light px-4 py-3 text-sm">
                  <p className="font-semibold text-ink">
                    {customerIssueReasonLabel(report.reasonCode)}
                    {report.resolved && <span className="ml-2 text-ink-muted">(resolved)</span>}
                  </p>
                  {report.note && <p className="mt-1 text-ink-muted">{report.note}</p>}
                  <p className="mt-1 text-xs text-ink-muted">{formatDateTime(report.reportedAt)}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {(job.status === "COMPLETED" || job.status === "CONFIRMED") && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Completion confirmation</h2>
            {job.status === "CONFIRMED" ? (
              <p className="mt-2 text-sm text-ink-muted">This job&apos;s completion has been confirmed.</p>
            ) : (
              <div className="mt-3 flex flex-wrap items-start gap-4">
                <GenerateCompletionLinkButton jobId={job.id} />
                <AdminConfirmCompletionButton jobId={job.id} />
              </div>
            )}
          </Card>
        )}

        {job.payout && (
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Payout</h2>
              <StatusChip tone={payoutStatusTone(job.payout.status)}>{payoutStatusLabel(job.payout.status)}</StatusChip>
            </div>
            <dl className="mt-3">
              <DefinitionRow label="Amount" value={formatCadMinor(job.payout.amountMinor)} />
            </dl>
            <Link
              href={`/admin/payouts/${job.payout.id}`}
              className="mt-3 inline-block text-sm font-semibold text-purple hover:text-purple-dark"
            >
              View payout detail →
            </Link>
          </Card>
        )}

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Status</h2>
          <p className="mt-2 text-sm text-ink-muted">Current: {jobStatusLabel(job.status)}</p>
          <div className="mt-3">
            <JobStatusControl jobId={job.id} allowedNext={allowedNextStatusesForManualControl(job.status as JobStatus)} />
          </div>
        </Card>

        {snapshot?.economicsSnapshot && (
          <Card className="p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Economics (internal — never shown to the customer)
              </h2>
              <StatusChip tone={quoteHealthTone(snapshot.economicsSnapshot.quoteHealth)}>
                {quoteHealthLabel(snapshot.economicsSnapshot.quoteHealth)}
              </StatusChip>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <dl>
                <DefinitionRow
                  label="Professional payout estimate"
                  value={formatCadMinor(snapshot.economicsSnapshot.professionalPayoutEstimateMinor)}
                />
                <DefinitionRow
                  label="Material cost estimate"
                  value={formatCadMinor(snapshot.economicsSnapshot.materialCostEstimateMinor)}
                />
                <DefinitionRow
                  label="Processing estimate"
                  value={formatCadMinor(snapshot.economicsSnapshot.processingEstimateMinor)}
                />
                <DefinitionRow label="CAC assumption" value={formatCadMinor(snapshot.economicsSnapshot.cacAssumptionMinor)} />
              </dl>
              <dl>
                <DefinitionRow
                  label="Other variable cost"
                  value={formatCadMinor(snapshot.economicsSnapshot.otherVariableCostMinor)}
                />
                <DefinitionRow
                  label="Contribution profit"
                  value={
                    <span className={snapshot.economicsSnapshot.contributionProfitMinor < 0 ? "text-coral-text" : undefined}>
                      {formatCadMinor(snapshot.economicsSnapshot.contributionProfitMinor)}
                    </span>
                  }
                />
                <DefinitionRow
                  label="Contribution margin"
                  value={`${snapshot.economicsSnapshot.contributionMarginPercent}%`}
                />
              </dl>
            </div>
          </Card>
        )}

        {job.payment && (
          <Card className="p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
              Actual costs (Session H — internal, feeds /admin/launch)
            </h2>
            <div className="mt-3">
              <JobActualsForm
                jobId={job.id}
                initial={
                  job.jobActuals
                    ? {
                        actualMaterialCostMinor: job.jobActuals.actualMaterialCostMinor,
                        actualCacMinor: job.jobActuals.actualCacMinor,
                        actualOtherVariableCostMinor: job.jobActuals.actualOtherVariableCostMinor,
                        note: job.jobActuals.note,
                      }
                    : null
                }
              />
            </div>
          </Card>
        )}

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Timeline</h2>
          <ol className="mt-3 space-y-3">
            {timeline.map((event, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-36 shrink-0 text-xs text-ink-muted">{formatDateTime(event.at)}</span>
                <span className="text-ink">{event.label}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}

// Plain divs, not <dt>/<dd> — this is a compact visual grid of timestamp
// "stamps", not a real definition list; axe's dlitem rule (dt/dd must be
// direct children of a dl) correctly flagged the previous version, which
// wrapped each pair in its own <div> inside a plain grid <div>.
function FieldStamp({ label, at }: { label: string; at: Date | null }) {
  return (
    <div>
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-ink">{at ? formatDateTime(at) : "—"}</p>
    </div>
  );
}
