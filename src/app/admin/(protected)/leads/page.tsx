import Link from "next/link";
import { listLeads } from "@/lib/admin/leads";
import { getEnabledServices } from "@/lib/services-data";
import { formatCadMinor } from "@/lib/quote/units";
import { leadStatusLabel, leadStatusTone, timingLabel, formatDateTime } from "@/lib/admin/status-display";
import { PageHeader, Card, EmptyState, StatusChip } from "@/components/admin/ui";

export const metadata = { title: "Leads" };

const STATUS_OPTIONS = ["QUOTE_STARTED", "QUOTE_PARTIAL", "PRICE_VIEWED", "CONTACT_CAPTURED", "BOOKING_INTENT"];

function buildHref(base: string, params: Record<string, string | undefined>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  const qs = usp.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const filters = {
    status: sp.status,
    service: sp.service,
    source: sp.source,
    bookingIntent: sp.bookingIntent as "yes" | "no" | undefined,
    q: sp.q,
    page: sp.page ? Number(sp.page) : undefined,
  };

  const { leads, total, page, totalPages } = await listLeads(filters);
  const services = getEnabledServices();

  return (
    <div>
      <PageHeader title="Leads" description={`${total} total customer request${total === 1 ? "" : "s"}.`} />

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
              placeholder="Name, email, phone, or lead ID"
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
                  {leadStatusLabel(s)}
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
            <label htmlFor="bookingIntent" className="block text-xs font-medium text-ink-muted">
              Submitted
            </label>
            <select
              id="bookingIntent"
              name="bookingIntent"
              defaultValue={sp.bookingIntent ?? ""}
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
          {(sp.q || sp.status || sp.service || sp.bookingIntent) && (
            <Link href="/admin/leads" className="text-sm font-medium text-ink-muted hover:text-ink">
              Clear
            </Link>
          )}
        </form>
      </Card>

      {leads.length === 0 ? (
        <EmptyState title="No leads found" description="New customer requests will appear here." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <th scope="col" className="px-4 py-3">Created</th>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Service</th>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Area</th>
                <th scope="col" className="px-4 py-3">Quote</th>
                <th scope="col" className="px-4 py-3">Timing</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Source</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((lead) => {
                const snapshot = lead.quoteSnapshots[0];
                return (
                  <tr key={lead.id} className="hover:bg-offwhite">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(lead.createdAt)}</td>
                    <td className="px-4 py-3 text-ink">{lead.contact?.firstName ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{lead.serviceSlug ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">{lead.citySlug ?? "—"}</td>
                    <td className="px-4 py-3 text-ink">
                      {lead.totalAreaM2 !== null ? `${lead.totalAreaM2} m²` : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink">{snapshot ? formatCadMinor(snapshot.totalMinor) : "—"}</td>
                    <td className="px-4 py-3 text-ink">{timingLabel(lead.timing?.value ?? null)}</td>
                    <td className="px-4 py-3">
                      <StatusChip tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusChip>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{lead.attribution?.utmSource ?? "Direct"}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-purple hover:text-purple-dark">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
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
                href={buildHref("/admin/leads", { ...sp, page: String(page - 1) })}
                className="rounded-lg border border-border px-3 py-1.5 font-medium text-ink hover:border-ink/20"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref("/admin/leads", { ...sp, page: String(page + 1) })}
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
