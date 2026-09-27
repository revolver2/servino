import { notFound } from "next/navigation";
import { requireProfessionalSession } from "@/lib/server/pro-auth";
import { getProJobDetail } from "@/lib/pro/jobs";
import { serviceNameForSlug, proJobStatusLabel } from "@/lib/pro/display";
import { materialOwnershipLabel, timingLabel, formatDateTime, proPayoutStatusLabel } from "@/lib/admin/status-display";
import { formatCadMinor } from "@/lib/quote/units";
import { ProJobActions } from "@/components/pro/ProJobActions";

export const metadata = { title: "Job detail" };

export default async function ProJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const professional = await requireProfessionalSession();
  if (!professional) return null;

  const { id } = await params;
  const job = await getProJobDetail(id, professional.id);
  if (!job) notFound();

  const isPreAcceptance = job.status === "OFFERED";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{serviceNameForSlug(job.service.slug)}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{proJobStatusLabel(job.status)}</p>
      </div>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Project</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="Area" value={job.service.totalAreaM2 ? `${job.service.totalAreaM2} m²` : "—"} />
          <Row label="Style" value={job.service.styleId ?? "—"} />
          <Row label="Material" value={materialOwnershipLabel(job.service.materialOwnership)} />
        </dl>
        {job.materialResponsibilityNote && (
          <p className="mt-3 rounded-lg bg-purple-light px-3 py-2 text-xs text-purple-dark">
            {job.materialResponsibilityNote}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Location</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="City" value={job.location.citySlug ?? "—"} />
          <Row label="Postal code" value={job.location.postalCode ?? (isPreAcceptance ? "Shown after acceptance" : "—")} />
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Customer</h2>
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="Name" value={job.customer.firstName ?? "—"} />
          <Row label="Phone" value={job.customer.phone ?? (isPreAcceptance ? "Shown after acceptance" : "—")} />
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Timing</h2>
        <p className="mt-2 text-sm text-ink">{timingLabel(job.timing)}</p>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Your compensation</h2>
        <p className="mt-2 text-2xl font-semibold text-ink">
          {job.offerAmountMinor != null ? formatCadMinor(job.offerAmountMinor) : "—"}
        </p>
        {job.offeredAt && <p className="mt-1 text-xs text-ink-muted">Offered {formatDateTime(job.offeredAt)}</p>}
        {job.offerAmountMinor != null && (
          <p className="mt-3 inline-flex items-center rounded-full bg-offwhite px-3 py-1 text-sm font-semibold text-ink">
            Payout status: {proPayoutStatusLabel(job.payoutStatus)}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          This is what Servino has agreed to pay you for this job. Payment is handled directly by Servino, outside
          this app.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Actions</h2>
        <ProJobActions jobId={job.id} status={job.status} />
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
