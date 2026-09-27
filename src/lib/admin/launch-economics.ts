import { prisma } from "@/lib/server/prisma";
import { approximateActualProcessingFeeMinor } from "./payments";

const CAPTURED_OR_LATER = ["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED"] as const;

export type JobEconomicsRow = {
  jobId: string;
  serviceSlug: string | null;
  customerFirstName: string | null;
  jobStatus: string;
  paymentStatus: string;

  revenueSubtotalMinor: number;
  revenueTaxMinor: number;
  revenueTotalMinor: number;

  estimatedPayoutMinor: number | null;
  actualPayoutMinor: number | null; // null until Payout.status === PAID
  payoutStatus: string | null;

  estimatedProcessingFeeMinor: number | null;
  /** Calculated from the published PayPal Canada rate — never PayPal's own reported fee. See docs/PAYMENTS.md. */
  actualProcessingFeeApproxMinor: number;

  estimatedMaterialCostMinor: number | null;
  actualMaterialCostMinor: number | null; // null = UNKNOWN, never defaulted to 0

  estimatedCacMinor: number | null;
  actualCacMinor: number | null; // null = UNKNOWN, never defaulted to 0

  /** Only actual field that defaults to 0 when unset — see JobActuals' own schema comment for why. */
  actualOtherVariableCostMinor: number;

  refundMinor: number;

  estimatedContributionMinor: number | null;
  /** null when actualContributionComplete is false — never a fabricated number. */
  actualContributionMinor: number | null;
  actualContributionComplete: boolean;
  missingActualFields: string[];

  hasUnresolvedIssue: boolean;
};

export async function getJobEconomicsRows(): Promise<JobEconomicsRow[]> {
  const jobs = await prisma.job.findMany({
    where: { payment: { status: { in: [...CAPTURED_OR_LATER] } } },
    orderBy: { createdAt: "asc" },
    include: {
      lead: { include: { contact: true } },
      bookingIntent: { include: { quoteSnapshot: { include: { economicsSnapshot: true } } } },
      payment: { include: { refunds: { where: { status: "COMPLETED" } } } },
      payout: true,
      jobActuals: true,
      customerIssueReports: { where: { resolved: false } },
    },
  });

  return jobs.map((job): JobEconomicsRow => {
    const snapshot = job.bookingIntent.quoteSnapshot;
    const economics = snapshot?.economicsSnapshot ?? null;
    const payment = job.payment!; // guaranteed by the where clause
    const payout = job.payout;
    const actuals = job.jobActuals;

    const refundMinor = payment.refunds.reduce((sum, r) => sum + r.amountMinor, 0);
    const actualPayoutMinor = payout && payout.status === "PAID" ? payout.amountMinor : null;
    const actualProcessingFeeApproxMinor = approximateActualProcessingFeeMinor(payment.amountMinor);

    const missingActualFields: string[] = [];
    if (actualPayoutMinor === null) missingActualFields.push("professional payout (not yet recorded paid)");
    if (!actuals || actuals.actualMaterialCostMinor === null || actuals.actualMaterialCostMinor === undefined) {
      missingActualFields.push("actual material cost");
    }
    if (!actuals || actuals.actualCacMinor === null || actuals.actualCacMinor === undefined) {
      missingActualFields.push("actual CAC");
    }

    const actualContributionComplete = missingActualFields.length === 0;
    const actualOtherVariableCostMinor = actuals?.actualOtherVariableCostMinor ?? 0;

    const actualContributionMinor = actualContributionComplete
      ? snapshot!.subtotalMinor -
        (actualPayoutMinor ?? 0) -
        actualProcessingFeeApproxMinor -
        (actuals!.actualMaterialCostMinor ?? 0) -
        (actuals!.actualCacMinor ?? 0) -
        actualOtherVariableCostMinor -
        refundMinor
      : null;

    return {
      jobId: job.id,
      serviceSlug: job.lead.serviceSlug,
      customerFirstName: job.lead.contact?.firstName ?? null,
      jobStatus: job.status,
      paymentStatus: payment.status,

      revenueSubtotalMinor: snapshot?.subtotalMinor ?? 0,
      revenueTaxMinor: snapshot?.taxMinor ?? 0,
      revenueTotalMinor: snapshot?.totalMinor ?? 0,

      estimatedPayoutMinor: economics?.professionalPayoutEstimateMinor ?? null,
      actualPayoutMinor,
      payoutStatus: payout?.status ?? null,

      estimatedProcessingFeeMinor: economics?.processingEstimateMinor ?? null,
      actualProcessingFeeApproxMinor,

      estimatedMaterialCostMinor: economics?.materialCostEstimateMinor ?? null,
      actualMaterialCostMinor: actuals?.actualMaterialCostMinor ?? null,

      estimatedCacMinor: economics?.cacAssumptionMinor ?? null,
      actualCacMinor: actuals?.actualCacMinor ?? null,

      actualOtherVariableCostMinor,
      refundMinor,

      estimatedContributionMinor: economics?.contributionProfitMinor ?? null,
      actualContributionMinor,
      actualContributionComplete,
      missingActualFields,

      hasUnresolvedIssue: job.customerIssueReports.length > 0,
    };
  });
}

export type LaunchSummary = {
  paidJobsCount: number;
  completedPaidJobsCount: number; // Payment CAPTURED-or-later AND Job.status === CONFIRMED
  completionRate: number | null; // completedPaidJobsCount / paidJobsCount, null if paidJobsCount is 0
  totalRevenueMinor: number;
  averageOrderValueMinor: number | null;
  totalActualPayoutMinor: number;
  jobsWithPayoutPaidCount: number;
  totalActualProcessingFeeApproxMinor: number;
  totalRefundMinor: number;
  totalEstimatedCacMinor: number | null; // sum of Session E assumption across paid jobs, for comparison only
  totalActualCacMinor: number | null; // null unless every paid job has an actual CAC entered
  jobsWithCompleteActualsCount: number;
  totalActualContributionMinor: number | null; // null unless every paid job has complete actuals
  totalEstimatedContributionMinor: number | null;
};

export function summarizeLaunchEconomics(rows: JobEconomicsRow[]): LaunchSummary {
  const paidJobsCount = rows.length;
  const completedPaidJobsCount = rows.filter((r) => r.jobStatus === "CONFIRMED").length;

  const totalRevenueMinor = rows.reduce((sum, r) => sum + r.revenueTotalMinor, 0);
  const totalActualPayoutMinor = rows.reduce((sum, r) => sum + (r.actualPayoutMinor ?? 0), 0);
  const jobsWithPayoutPaidCount = rows.filter((r) => r.actualPayoutMinor !== null).length;
  const totalActualProcessingFeeApproxMinor = rows.reduce((sum, r) => sum + r.actualProcessingFeeApproxMinor, 0);
  const totalRefundMinor = rows.reduce((sum, r) => sum + r.refundMinor, 0);

  const allHaveEstimatedCac = rows.every((r) => r.estimatedCacMinor !== null);
  const totalEstimatedCacMinor = allHaveEstimatedCac
    ? rows.reduce((sum, r) => sum + (r.estimatedCacMinor ?? 0), 0)
    : null;

  const allHaveActualCac = paidJobsCount > 0 && rows.every((r) => r.actualCacMinor !== null);
  const totalActualCacMinor = allHaveActualCac ? rows.reduce((sum, r) => sum + (r.actualCacMinor ?? 0), 0) : null;

  const jobsWithCompleteActualsCount = rows.filter((r) => r.actualContributionComplete).length;
  const allComplete = paidJobsCount > 0 && jobsWithCompleteActualsCount === paidJobsCount;
  const totalActualContributionMinor = allComplete
    ? rows.reduce((sum, r) => sum + (r.actualContributionMinor ?? 0), 0)
    : null;

  const allHaveEstimatedContribution = rows.every((r) => r.estimatedContributionMinor !== null);
  const totalEstimatedContributionMinor = allHaveEstimatedContribution
    ? rows.reduce((sum, r) => sum + (r.estimatedContributionMinor ?? 0), 0)
    : null;

  return {
    paidJobsCount,
    completedPaidJobsCount,
    completionRate: paidJobsCount > 0 ? completedPaidJobsCount / paidJobsCount : null,
    totalRevenueMinor,
    averageOrderValueMinor: paidJobsCount > 0 ? Math.round(totalRevenueMinor / paidJobsCount) : null,
    totalActualPayoutMinor,
    jobsWithPayoutPaidCount,
    totalActualProcessingFeeApproxMinor,
    totalRefundMinor,
    totalEstimatedCacMinor,
    totalActualCacMinor,
    jobsWithCompleteActualsCount,
    totalActualContributionMinor,
    totalEstimatedContributionMinor,
  };
}
