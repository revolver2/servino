import { requireProfessionalSession } from "@/lib/server/pro-auth";
import { getOfferedJobsForProfessional, getActiveJobsForProfessional, getCompletedJobsForProfessional } from "@/lib/pro/jobs";
import { ProJobCard } from "@/components/pro/ProJobCard";

export const metadata = { title: "Home" };

/** Answers "what do I need to do today?" (spec section 16) — only real database data, no fake earnings/ratings/demand. */
export default async function ProHomePage() {
  const professional = await requireProfessionalSession();
  if (!professional) return null; // layout already redirects; satisfies TS

  const [offered, active, completed] = await Promise.all([
    getOfferedJobsForProfessional(professional.id),
    getActiveJobsForProfessional(professional.id),
    getCompletedJobsForProfessional(professional.id),
  ]);

  const recentlyCompleted = completed.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Hi, {professional.displayName.split(" ")[0]}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">Here&apos;s what needs your attention.</p>
      </div>

      {offered.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Offered to you ({offered.length})
          </h2>
          <div className="space-y-3">
            {offered.map((j) => (
              <ProJobCard key={j.id} job={j} badgeLabel="Review offer" />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
            Your jobs ({active.length})
          </h2>
          <div className="space-y-3">
            {active.map((j) => (
              <ProJobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {offered.length === 0 && active.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Nothing needs your attention right now</p>
          <p className="mt-1 text-sm text-ink-muted">New job offers will show up here.</p>
        </div>
      )}

      {recentlyCompleted.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Recently completed</h2>
          <div className="space-y-3">
            {recentlyCompleted.map((j) => (
              <ProJobCard key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
