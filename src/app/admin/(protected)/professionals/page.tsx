import Link from "next/link";
import { listProfessionals } from "@/lib/admin/professionals";
import { getJobDetail } from "@/lib/admin/jobs";
import { verificationLabel, verificationTone } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState, StatusChip } from "@/components/admin/ui";
import { OfferJobForm } from "@/components/admin/OfferJobForm";

export const metadata = { title: "Professionals" };

export default async function AdminProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ offerTo?: string }>;
}) {
  const { offerTo } = await searchParams;
  const [professionals, offerJob] = await Promise.all([
    listProfessionals(),
    offerTo ? getJobDetail(offerTo) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title="Professionals"
        description={`${professionals.length} professional${professionals.length === 1 ? "" : "s"} on file.`}
        actions={
          <Link
            href="/admin/professionals/new"
            className="rounded-full bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
          >
            + Add professional
          </Link>
        }
      />

      {offerTo && (
        <Card className="mb-4 border-purple/30 bg-purple-light p-4">
          {offerJob ? (
            <p className="text-sm text-ink">
              Offering <strong>{offerJob.lead.contact?.firstName ?? "this job"}</strong>&apos;s{" "}
              {offerJob.lead.serviceSlug ?? "project"} ({offerJob.lead.citySlug ?? "—"}) to a professional.{" "}
              <Link href={`/admin/jobs/${offerTo}`} className="font-semibold underline">
                Back to job
              </Link>
            </p>
          ) : (
            <p className="text-sm text-ink">Job not found.</p>
          )}
        </Card>
      )}

      {professionals.length === 0 ? (
        <EmptyState
          title="No professionals yet"
          description="Add your first professional to start assigning jobs."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Contact</th>
                <th scope="col" className="px-4 py-3">Services</th>
                <th scope="col" className="px-4 py-3">Area</th>
                <th scope="col" className="px-4 py-3">Verification</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Active jobs</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {professionals.map((pro) => {
                const serviceMatch =
                  !offerJob?.lead.serviceSlug || pro.services.some((s) => s.serviceSlug === offerJob.lead.serviceSlug);
                const eligible = pro.active && serviceMatch;

                return (
                  <tr key={pro.id} className="hover:bg-offwhite">
                    <td className="px-4 py-3 text-ink">
                      {pro.displayName}
                      {pro.businessName && <span className="block text-xs text-ink-muted">{pro.businessName}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {pro.email}
                      <span className="block">{pro.phone}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {pro.services.length > 0 ? pro.services.map((s) => s.serviceSlug).join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{pro.serviceAreaNote ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusChip tone={verificationTone(pro.verificationStatus)}>
                        {verificationLabel(pro.verificationStatus)}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip tone={pro.active ? "teal" : "neutral"}>{pro.active ? "Active" : "Inactive"}</StatusChip>
                    </td>
                    <td className="px-4 py-3 text-ink">{pro.jobs.length}</td>
                    <td className="px-4 py-3">
                      {offerTo && offerJob ? (
                        eligible ? (
                          <OfferJobForm
                            jobId={offerTo}
                            professionalId={pro.id}
                            estimatedPayoutMinor={
                              offerJob.bookingIntent.quoteSnapshot?.economicsSnapshot?.professionalPayoutEstimateMinor ?? null
                            }
                          />
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-coral-text">
                              {!pro.active ? "Inactive" : "Not set up for this service"}
                            </span>
                          </div>
                        )
                      ) : (
                        <Link
                          href={`/admin/professionals/${pro.id}`}
                          className="font-semibold text-purple hover:text-purple-dark"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
