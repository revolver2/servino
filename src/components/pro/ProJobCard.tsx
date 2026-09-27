import Link from "next/link";
import { formatCadMinor } from "@/lib/quote/units";
import { materialOwnershipLabel, timingLabel } from "@/lib/admin/status-display";
import { serviceNameForSlug, proJobStatusLabel } from "@/lib/pro/display";
import type { ProJobView } from "@/lib/pro/jobs";

export function ProJobCard({ job, badgeLabel }: { job: ProJobView; badgeLabel?: string }) {
  return (
    <Link
      href={`/pro/jobs/${job.id}`}
      className="block rounded-2xl border border-border bg-white p-4 transition-colors hover:border-purple/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-ink">{serviceNameForSlug(job.service.slug)}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {job.service.totalAreaM2 ? `${job.service.totalAreaM2} m²` : "Area TBD"} ·{" "}
            {materialOwnershipLabel(job.service.materialOwnership)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-purple-light px-2.5 py-1 text-xs font-semibold text-purple-dark">
          {badgeLabel ?? proJobStatusLabel(job.status)}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-muted">{timingLabel(job.timing)}</span>
        {job.offerAmountMinor != null && <span className="font-semibold text-ink">{formatCadMinor(job.offerAmountMinor)}</span>}
      </div>
    </Link>
  );
}
