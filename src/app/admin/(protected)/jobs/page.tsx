import Link from "next/link";
import { listJobs } from "@/lib/admin/jobs";
import { getEnabledServices } from "@/lib/services-data";
import { formatCadMinor } from "@/lib/quote/units";
import { jobStatusLabel, jobStatusTone, timingLabel, formatDateTime } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState, StatusChip } from "@/components/admin/ui";

export const metadata = { title: "Jobs" };

const STATUS_OPTIONS = [
  "NEW",
  "REVIEWING",
  "READY_FOR_ASSIGNMENT",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
  "MANUAL_REVIEW",
];

function buildHref(base: string, params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    status: sp.status,
    service: sp.service,
    assigned: sp.assigned as "yes" | "no" | undefined,
    q: sp.q,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const { jobs, total, page, totalPages } = await listJobs(filters);
  const services = getEnabledServices();

  return (
    <div>
      <PageHeader title="Jobs" description={`${total} operational job${total === 1 ? "" : "s"}.`} />

      <Card className="mb-4 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="q" className="block text-xs font-medium text-ink-muted">
              Search
            </label>
            <input
              id="q"
              name="q"
              type="text"
              defaultValue={sp.q ?? ""}
              placeholder="Name, email, phone, or job ID"
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-ink focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/30"
            />
          </div>
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
                  {jobStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="service" className="block text-xs font-medium text-ink-muted">
              Service
            </label>
            <select
              id="service"
              name="service"
              defaultValue={sp.service ?? ""}
              className="mt-1 rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              <option value="">All</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assigned" className="block text-xs font-medium text-ink-muted">
              Assigned
            </label>
            <select
              id="assigned"
              name="assigned"
              defaultValue={sp.assigned ?? ""}
              className="mt-1 rounded-lg border border-border px-3 py-2 text-sm text-ink"
            >
              <option value="">All</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
          >
            Filter
          </button>
          {(sp.q || sp.status || sp.service || sp.assigned) && (
            <Link href="/admin/jobs" className="text-sm font-medium text-ink-muted hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs found" description="Submitted customer projects will appear here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Job</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Service</th>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Quote value</th>
                <th scope="col" className="px-4 py-3">Professional</th>
                <th scope="col" className="px-4 py-3">Timing</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-offwhite">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-muted">
                    {job.id.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3 text-ink">{job.lead.contact?.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{job.lead.serviceSlug ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">{job.lead.citySlug ?? "—"}</td>
                  <td className="px-4 py-3 text-ink">
                    {job.bookingIntent.quoteSnapshot ? formatCadMinor(job.bookingIntent.quoteSnapshot.totalMinor) : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink">{job.assignedProfessional?.displayName ?? "Unassigned"}</td>
                  <td className="px-4 py-3 text-ink">{timingLabel(job.lead.timing?.value ?? null)}</td>
                  <td className="px-4 py-3">
                    <StatusChip tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</StatusChip>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(job.updatedAt)}</td>
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

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref("/admin/jobs", { ...sp, page: String(page - 1) })}
                className="rounded-lg border border-border px-3 py-1.5 font-medium text-ink hover:border-ink/20"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref("/admin/jobs", { ...sp, page: String(page + 1) })}
                className="rounded-lg border border-border px-3 py-1.5 font-medium text-ink hover:border-ink/20"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
