import { notFound } from "next/navigation";
import { requireProfessionalSession } from "@/lib/server/pro-auth";
import { getOwnProfessionalProfile } from "@/lib/pro/profile";
import { serviceNameForSlug } from "@/lib/pro/display";
import { verificationLabel } from "@/lib/admin/status-display";

export const metadata = { title: "Profile" };

export default async function ProProfilePage() {
  const session = await requireProfessionalSession();
  if (!session) return null;

  const profile = await getOwnProfessionalProfile(session.id);
  if (!profile) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Profile</h1>

      <section className="rounded-2xl border border-border bg-white p-4">
        <dl className="space-y-2 text-sm">
          <Row label="Name" value={profile.displayName} />
          {profile.businessName && <Row label="Business" value={profile.businessName} />}
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone} />
          <Row label="Verification" value={verificationLabel(profile.verificationStatus)} />
          {profile.serviceAreaNote && <Row label="Service area" value={profile.serviceAreaNote} />}
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Services</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.services.length === 0 ? (
            <p className="text-sm text-ink-muted">No services on file yet — contact your admin.</p>
          ) : (
            profile.services.map((s) => (
              <span key={s.id} className="rounded-full bg-purple-light px-3 py-1 text-xs font-semibold text-purple-dark">
                {serviceNameForSlug(s.serviceSlug)}
              </span>
            ))
          )}
        </div>
      </section>

      <p className="text-xs text-ink-muted">
        Name, services, and verification are managed by your Servino admin. Contact them to make changes.
      </p>
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
