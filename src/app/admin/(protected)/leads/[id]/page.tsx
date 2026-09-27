import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeadDetail } from "@/lib/admin/leads";
import { formatCadMinor } from "@/lib/quote/units";
import {
  leadStatusLabel,
  leadStatusTone,
  timingLabel,
  materialOwnershipLabel,
  formatDateTime,
} from "@/lib/admin/status-display";
import { Card, DefinitionRow, PageHeader, StatusChip } from "@/components/admin/ui";

export const metadata = { title: "Lead detail" };

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) notFound();

  const latestSnapshot = lead.quoteSnapshots[0] ?? null;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={lead.contact?.firstName ?? "Unnamed lead"}
        description={`Lead ${lead.id}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusChip tone={leadStatusTone(lead.status)}>{leadStatusLabel(lead.status)}</StatusChip>
            {lead.job && (
              <Link
                href={`/admin/jobs/${lead.job.id}`}
                className="rounded-full bg-purple px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-purple-dark"
              >
                View job
              </Link>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Customer</h2>
          <dl className="mt-3">
            <DefinitionRow label="Name" value={lead.contact?.firstName ?? "Not captured yet"} />
            <DefinitionRow label="Email" value={lead.contact?.email ?? "Not captured yet"} />
            <DefinitionRow label="Phone" value={lead.contact?.phone ?? "Not captured yet"} />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Project</h2>
          <dl className="mt-3">
            <DefinitionRow label="Service" value={lead.serviceSlug ?? "—"} />
            <DefinitionRow label="Location" value={lead.citySlug ?? "—"} />
            <DefinitionRow label="Postal code" value={lead.postalCode ?? "—"} />
            <DefinitionRow
              label="Measurement unit"
              value={lead.measurementUnit ?? "—"}
            />
            <DefinitionRow label="Total area" value={lead.totalAreaM2 !== null ? `${lead.totalAreaM2} m²` : "—"} />
            <DefinitionRow label="Style" value={lead.styleId ?? "—"} />
            <DefinitionRow
              label="Material ownership"
              value={materialOwnershipLabel(lead.materialOwnership)}
            />
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Quote</h2>
          {latestSnapshot ? (
            <dl className="mt-3">
              <DefinitionRow label="Subtotal" value={formatCadMinor(latestSnapshot.subtotalMinor)} />
              <DefinitionRow label={latestSnapshot.taxLabel} value={formatCadMinor(latestSnapshot.taxMinor)} />
              <DefinitionRow label="Total" value={formatCadMinor(latestSnapshot.totalMinor)} />
              <DefinitionRow label="Currency" value={latestSnapshot.currency} />
              <DefinitionRow label="Pricing source" value={latestSnapshot.pricingSource} />
              <DefinitionRow label="Generated" value={formatDateTime(latestSnapshot.priceGeneratedAt)} />
              {lead.quoteSnapshots.length > 1 && (
                <DefinitionRow label="Snapshots on file" value={String(lead.quoteSnapshots.length)} />
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No quote generated yet.</p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Timing</h2>
          <dl className="mt-3">
            <DefinitionRow label="Customer preference" value={timingLabel(lead.timing?.value ?? null)} />
          </dl>

          <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-ink-muted">Booking intent</h2>
          <dl className="mt-3">
            <DefinitionRow label="Status" value={lead.bookingIntent ? "Created" : "Not created"} />
            {lead.bookingIntent && (
              <DefinitionRow label="Submitted" value={formatDateTime(lead.bookingIntent.createdAt)} />
            )}
          </dl>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">Attribution</h2>
          {lead.attribution ? (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2">
              <DefinitionRow label="Source" value={lead.attribution.utmSource ?? "—"} />
              <DefinitionRow label="Medium" value={lead.attribution.utmMedium ?? "—"} />
              <DefinitionRow label="Campaign" value={lead.attribution.utmCampaign ?? "—"} />
              <DefinitionRow label="Content" value={lead.attribution.utmContent ?? "—"} />
              <DefinitionRow label="Term" value={lead.attribution.utmTerm ?? "—"} />
              <DefinitionRow label="Landing route" value={lead.attribution.landingRoute} />
              <DefinitionRow label="Referrer" value={lead.attribution.referrer ?? "Direct"} />
              <DefinitionRow label="First touch" value={formatDateTime(lead.attribution.firstTouchAt)} />
            </dl>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">No attribution recorded.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
