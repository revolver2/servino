import Link from "next/link";
import { requireProfessionalSession } from "@/lib/server/pro-auth";
import {
  getOfferedJobsForProfessional,
  getActiveJobsForProfessional,
  getCompletedJobsForProfessional,
  getDeclinedOffersForProfessional,
} from "@/lib/pro/jobs";
import { ProJobCard } from "@/components/pro/ProJobCard";
import { serviceNameForSlug, reasonLabel } from "@/lib/pro/display";
import { formatDateTime } from "@/lib/admin/status-display";

export const metadata = { title: "Jobs" };

const TABS = [
  { key: "offered", label: "Offered" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
] as const;

export default async function ProJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const professional = await requireProfessionalSession();
  if (!professional) return null;

  const { tab: rawTab } = await searchParams;
  const tab = (TABS.some((t) => t.key === rawTab) ? rawTab : "offered") as (typeof TABS)[number]["key"];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Jobs</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/pro/jobs?tab=${t.key}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-purple text-white" : "bg-white text-ink-muted border border-border"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "offered" && <OfferedTab professionalId={professional.id} />}
      {tab === "active" && <ActiveTab professionalId={professional.id} />}
      {tab === "completed" && <CompletedTab professionalId={professional.id} />}
      {tab === "declined" && <DeclinedTab professionalId={professional.id} />}
    </div>
  );
}

async function OfferedTab({ professionalId }: { professionalId: string }) {
  const jobs = await getOfferedJobsForProfessional(professionalId);
  if (jobs.length === 0) return <Empty text="No open offers right now." />;
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <ProJobCard key={j.id} job={j} badgeLabel="Review offer" />
      ))}
    </div>
  );
}

async function ActiveTab({ professionalId }: { professionalId: string }) {
  const jobs = await getActiveJobsForProfessional(professionalId);
  if (jobs.length === 0) return <Empty text="No active jobs." />;
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <ProJobCard key={j.id} job={j} />
      ))}
    </div>
  );
}

async function CompletedTab({ professionalId }: { professionalId: string }) {
  const jobs = await getCompletedJobsForProfessional(professionalId);
  if (jobs.length === 0) return <Empty text="No completed jobs yet." />;
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <ProJobCard key={j.id} job={j} />
      ))}
    </div>
  );
}

async function DeclinedTab({ professionalId }: { professionalId: string }) {
  const offers = await getDeclinedOffersForProfessional(professionalId);
  if (offers.length === 0) return <Empty text="You haven't declined any offers." />;
  return (
    <div className="space-y-3">
      {offers.map((o) => (
        <div key={o.id} className="rounded-2xl border border-border bg-white p-4">
          <p className="text-base font-semibold text-ink">{serviceNameForSlug(o.job.lead.serviceSlug)}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Declined {formatDateTime(o.respondedAt ?? o.offeredAt)}
            {o.declineReason && ` — ${reasonLabel(o.declineReason)}`}
          </p>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
      <p className="text-sm text-ink-muted">{text}</p>
    </div>
  );
}
