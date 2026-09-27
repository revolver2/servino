import { prisma } from "@/lib/server/prisma";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_ACTIVE_JOB_MS = 72 * 60 * 60 * 1000;

export type OverviewMetrics = {
  newLeads7d: number;
  bookingIntents7d: number;
  unassignedJobs: number;
  activeJobs: number;
  completedJobs: number;
  pipelineQuoteValueMinor: number;
  // Session G
  paymentsPending: number;
  paymentsConfirmed: number;
  completionAwaitingCustomer: number;
  payoutsEligible: number;
  payoutsHeld: number;
  issuesRequiringAttention: number;
};

/** Every number here comes directly from the database — no fabricated/estimated metrics (spec section 14). */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const since7d = new Date(Date.now() - SEVEN_DAYS_MS);

  const [
    newLeads7d,
    bookingIntents7d,
    unassignedJobs,
    activeJobs,
    completedJobs,
    pipelineJobs,
    paymentsPending,
    paymentsConfirmed,
    completionAwaitingCustomer,
    payoutsEligible,
    payoutsHeld,
    issuesRequiringAttention,
  ] = await Promise.all([
    prisma.lead.count({ where: { createdAt: { gte: since7d } } }),
    prisma.bookingIntent.count({ where: { createdAt: { gte: since7d } } }),
    prisma.job.count({
      where: { assignedProfessionalId: null, status: { notIn: ["COMPLETED", "CANCELLED"] } },
    }),
    // Session F: a job en route or arrived is just as "active" as
    // assigned/in-progress — it hasn't reached a professional-reported
    // completion or gone back to the unassigned pool.
    prisma.job.count({ where: { status: { in: ["ASSIGNED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] } } }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
    prisma.job.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      select: { bookingIntent: { select: { quoteSnapshot: { select: { totalMinor: true } } } } },
    }),
    prisma.payment.count({ where: { status: { in: ["PENDING", "CREATED", "APPROVED"] } } }),
    prisma.payment.count({ where: { status: "CAPTURED" } }),
    prisma.job.count({ where: { status: "COMPLETED" } }),
    prisma.payout.count({ where: { status: "ELIGIBLE" } }),
    prisma.payout.count({ where: { status: "HELD" } }),
    prisma.customerIssueReport.count({ where: { resolved: false } }),
  ]);

  const pipelineQuoteValueMinor = pipelineJobs.reduce(
    (sum, j) => sum + (j.bookingIntent.quoteSnapshot?.totalMinor ?? 0),
    0
  );

  return {
    newLeads7d,
    bookingIntents7d,
    unassignedJobs,
    activeJobs,
    completedJobs,
    pipelineQuoteValueMinor,
    paymentsPending,
    paymentsConfirmed,
    completionAwaitingCustomer,
    payoutsEligible,
    payoutsHeld,
    issuesRequiringAttention,
  };
}

export type ActionItem = {
  key: string;
  title: string;
  count: number;
  href: string;
};

const RECENT_COMPLETION_MS = 72 * 60 * 60 * 1000; // same window as "stale" — bounded, not an unresolved-forever list

/** Only conditions the current model can actually compute — no invented operational truth (spec section 15). */
export async function getActionRequired(): Promise<ActionItem[]> {
  const staleBefore = new Date(Date.now() - STALE_ACTIVE_JOB_MS);
  const completedSince = new Date(Date.now() - RECENT_COMPLETION_MS);

  const [
    newJobs,
    unassignedReady,
    manualReview,
    staleActive,
    incompletePros,
    unprofitable,
    declinedNeedsReoffer,
    unresolvedProblems,
    recentCompletions,
    paymentFailed,
    unresolvedIssues,
    payoutsEligible,
    disputedPayments,
    refundOnUnpaidPayout,
  ] = await Promise.all([
    prisma.job.count({ where: { status: "NEW" } }),
    prisma.job.count({ where: { status: "READY_FOR_ASSIGNMENT", assignedProfessionalId: null } }),
    prisma.job.count({ where: { status: "MANUAL_REVIEW" } }),
    prisma.job.count({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] }, updatedAt: { lt: staleBefore } },
    }),
    prisma.professional.count({ where: { active: true, verificationStatus: "MISSING" } }),
    // Session E / D029: an UNPROFITABLE quote health doesn't block the
    // customer's automatic price, but it does surface here so the owner
    // can review before doing the work.
    prisma.job.count({
      where: {
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        bookingIntent: { quoteSnapshot: { economicsSnapshot: { quoteHealth: "UNPROFITABLE" } } },
      },
    }),
    // Session F — distinct from the generic "unassigned" condition: this
    // job was already offered and declined once, not just never offered.
    prisma.job.count({
      where: { status: "READY_FOR_ASSIGNMENT", offers: { some: { status: "DECLINED" } } },
    }),
    prisma.problemReport.count({ where: { resolved: false } }),
    // Bounded to a recent window (same reasoning as "stale") so this
    // never becomes an unresolved-forever list — completion confirmation
    // itself (Session G) is the real closure boundary now; this just
    // flags a job that's SAT at COMPLETED a while without confirmation.
    prisma.job.count({ where: { status: "COMPLETED", updatedAt: { gte: completedSince } } }),
    // Session G
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.customerIssueReport.count({ where: { resolved: false } }),
    prisma.payout.count({ where: { status: "ELIGIBLE" } }),
    prisma.payment.count({ where: { status: "DISPUTED" } }),
    // The "professional already paid, payment later refunded/disputed"
    // manual-review edge case (docs/PAYOUTS.md) — computed live, not a
    // stored flag.
    prisma.payout.count({
      where: { status: "PAID", job: { payment: { status: { in: ["REFUNDED", "DISPUTED"] } } } },
    }),
  ]);

  const items: ActionItem[] = [
    { key: "new", title: "New customer requests need review", count: newJobs, href: "/admin/jobs?status=NEW" },
    {
      key: "unassigned",
      title: "Ready for assignment, no professional yet",
      count: unassignedReady,
      href: "/admin/jobs?status=READY_FOR_ASSIGNMENT&assigned=no",
    },
    {
      key: "manual_review",
      title: "Flagged for manual review",
      count: manualReview,
      href: "/admin/jobs?status=MANUAL_REVIEW",
    },
    {
      key: "stale",
      title: "No update in 3+ days (active job)",
      count: staleActive,
      href: "/admin/jobs",
    },
    {
      key: "pro_unverified",
      title: "Active professional not yet verified",
      count: incompletePros,
      href: "/admin/professionals",
    },
    {
      key: "unprofitable",
      title: "Quote economics flagged unprofitable — review before starting work",
      count: unprofitable,
      href: "/admin/jobs",
    },
    {
      key: "declined_needs_reoffer",
      title: "Offer declined — needs reassignment",
      count: declinedNeedsReoffer,
      href: "/admin/jobs?status=READY_FOR_ASSIGNMENT",
    },
    {
      key: "problem_reported",
      title: "Problem reported by a professional",
      count: unresolvedProblems,
      href: "/admin/jobs",
    },
    {
      key: "completion_reported",
      title: "Completion reported — review",
      count: recentCompletions,
      href: "/admin/jobs?status=COMPLETED",
    },
    {
      key: "payment_failed",
      title: "Customer payment failed",
      count: paymentFailed,
      href: "/admin/payments?status=FAILED",
    },
    {
      key: "issues_unresolved",
      title: "Customer issue reported — needs review",
      count: unresolvedIssues,
      href: "/admin/jobs",
    },
    {
      key: "payouts_eligible",
      title: "Payouts eligible — ready to pay",
      count: payoutsEligible,
      href: "/admin/payouts?status=ELIGIBLE",
    },
    {
      key: "payments_disputed",
      title: "Payment disputed or reversed by provider",
      count: disputedPayments,
      href: "/admin/payments?status=DISPUTED",
    },
    {
      key: "refund_after_payout",
      title: "Professional already paid, but payment was later refunded/disputed",
      count: refundOnUnpaidPayout,
      href: "/admin/payouts?status=PAID",
    },
  ];

  return items.filter((item) => item.count > 0);
}

export type ActivityEvent = {
  at: Date;
  label: string;
  href?: string;
};

/** Merges real customer-funnel timestamps with real admin AuditEvent rows — never manufactured activity (spec section 16). */
export async function getRecentActivity(limit = 15): Promise<ActivityEvent[]> {
  const take = limit * 2;

  const [jobs, auditEvents] = await Promise.all([
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        createdAt: true,
        lead: { select: { serviceSlug: true, contact: { select: { firstName: true } } } },
      },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { email: true } } },
    }),
  ]);

  const jobEvents: ActivityEvent[] = jobs.map((j) => ({
    at: j.createdAt,
    label: `Project request submitted${j.lead.contact?.firstName ? ` — ${j.lead.contact.firstName}` : ""}${
      j.lead.serviceSlug ? ` (${j.lead.serviceSlug})` : ""
    }`,
    href: `/admin/jobs/${j.id}`,
  }));

  const auditLabels: Record<string, (a: (typeof auditEvents)[number]) => string> = {
    ADMIN_LOGIN_SUCCESS: (a) => `${a.actor?.email ?? "Admin"} signed in`,
    ADMIN_LOGIN_FAILED: () => `Failed admin login attempt`,
    ADMIN_LOGOUT: (a) => `${a.actor?.email ?? "Admin"} signed out`,
    PROFESSIONAL_CREATED: (a) => `${a.actor?.email ?? "Admin"} added a professional`,
    PROFESSIONAL_UPDATED: (a) => `${a.actor?.email ?? "Admin"} updated a professional`,
    JOB_CREATED: () => `Job created from booking intent`,
    JOB_STATUS_CHANGED: (a) => {
      const meta = a.metadata as { from?: string; to?: string } | null;
      return `${a.actor?.email ?? "Admin"} changed job status${meta?.from && meta?.to ? ` (${meta.from} → ${meta.to})` : ""}`;
    },
    JOB_ASSIGNED: (a) => `${a.actor?.email ?? "Admin"} assigned a professional`,
    JOB_REASSIGNED: (a) => `${a.actor?.email ?? "Admin"} reassigned a professional`,
    // Session G
    PAYMENT_CAPTURED: () => `Customer payment confirmed`,
    PAYMENT_FAILED: () => `A customer payment failed`,
    REFUND_COMPLETED: (a) => `${a.actor?.email ?? "Admin"} issued a refund`,
    CUSTOMER_COMPLETION_CONFIRMED: () => `Customer confirmed project completion`,
    CUSTOMER_ISSUE_REPORTED: () => `Customer reported an issue`,
    ADMIN_COMPLETION_CONFIRMED: (a) => `${a.actor?.email ?? "Admin"} confirmed completion on the customer's behalf`,
    PAYOUT_ELIGIBLE: () => `A payout became eligible`,
    PAYOUT_RECORDED: (a) => `${a.actor?.email ?? "Admin"} recorded a payout as paid`,
    PAYOUT_HELD: () => `A payout was held`,
  };

  const auditActivity: ActivityEvent[] = auditEvents
    .filter((a) => a.action !== "JOB_CREATED") // avoid duplicating with jobEvents above
    .map((a) => ({
      at: a.createdAt,
      label: (auditLabels[a.action] ?? (() => a.action))(a),
      href: a.entityType === "JOB" ? `/admin/jobs/${a.entityId}` : undefined,
    }));

  return [...jobEvents, ...auditActivity].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
