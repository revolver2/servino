import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfessionalDetail } from "@/lib/admin/professionals";
import { getEnabledServices } from "@/lib/services-data";
import { formatCadMinor } from "@/lib/quote/units";
import { jobStatusLabel, jobStatusTone, formatDateTime } from "@/lib/admin/status-display";
import { Card, PageHeader, StatusChip } from "@/components/admin/ui";
import { ProfessionalForm } from "@/components/admin/ProfessionalForm";
import { GenerateActivationLinkButton } from "@/components/admin/GenerateActivationLinkButton";

export const metadata = { title: "Professional detail" };

export default async function AdminProfessionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const professional = await getProfessionalDetail(id);
  if (!professional) notFound();

  const services = getEnabledServices().map((s) => ({ slug: s.slug, name: s.name }));
  const offeredCount = professional.offers.length;
  const acceptedCount = professional.jobs.filter((j) => j.status === "ASSIGNED").length;
  const activeFieldCount = professional.jobs.filter((j) => ["EN_ROUTE", "ARRIVED", "IN_PROGRESS"].includes(j.status)).length;
  const completedCount = professional.jobs.filter((j) => j.status === "COMPLETED").length;
  const activeJobs = professional.jobs.filter((j) => !["COMPLETED", "CANCELLED"].includes(j.status));

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={professional.displayName}
        description={professional.businessName ?? undefined}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Offered" value={offeredCount} />
        <StatBox label="Accepted" value={acceptedCount} />
        <StatBox label="Active" value={activeFieldCount} />
        <StatBox label="Completed" value={completedCount} />
      </div>

      <Card className="mb-6 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Account</h2>
        <p className="mt-2 text-sm text-ink">
          {professional.passwordHash ? (
            <StatusChip tone="teal">Activated</StatusChip>
          ) : (
            <StatusChip tone="neutral">Not yet activated</StatusChip>
          )}
        </p>
        <div className="mt-3">
          <GenerateActivationLinkButton professionalId={professional.id} />
        </div>
      </Card>

      {professional.offers.length > 0 && (
        <Card className="mb-6 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Open offers</h2>
          <ul className="mt-3 space-y-2">
            {professional.offers.map((offer) => (
              <li key={offer.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <Link href={`/admin/jobs/${offer.jobId}`} className="text-purple hover:text-purple-dark">
                  {offer.job.lead.contact?.firstName ?? "Job"}&apos;s {offer.job.lead.serviceSlug ?? "project"}
                </Link>
                <span className="text-ink-muted">
                  {formatCadMinor(offer.offerAmountMinor)} · offered {formatDateTime(offer.offeredAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6 p-6">
        <ProfessionalForm
          mode="edit"
          professionalId={professional.id}
          services={services}
          initial={{
            displayName: professional.displayName,
            businessName: professional.businessName ?? "",
            email: professional.email,
            phone: professional.phone,
            serviceAreaNote: professional.serviceAreaNote ?? "",
            notes: professional.notes ?? "",
            verificationStatus: professional.verificationStatus,
            active: professional.active,
            serviceSlugs: professional.services.map((s) => s.serviceSlug),
          }}
        />
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
        Assigned jobs {activeJobs.length > 0 && `(${activeJobs.length} active)`}
      </h2>
      {professional.jobs.length === 0 ? (
        <Card className="p-5">
          <p className="text-sm text-ink-muted">No jobs assigned yet.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Quote value</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professional.jobs.map((job) => (
                <tr key={job.id} className="hover:bg-offwhite">
                  <td className="px-4 py-3 text-ink">{job.lead.contact?.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">
                    {job.bookingIntent.quoteSnapshot ? formatCadMinor(job.bookingIntent.quoteSnapshot.totalMinor) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusChip>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{formatDateTime(job.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/jobs/${job.id}`} className="font-semibold text-purple hover:text-purple-dark">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 text-center">
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
    </div>
  );
}
