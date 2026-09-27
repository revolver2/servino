import type { Metadata } from "next";
import { getSupportEmail } from "@/lib/server/support-contact";

export const metadata: Metadata = {
  title: "Contact",
};

/**
 * Forced dynamic (Session H0.1 finding): this page would otherwise be
 * statically prerendered, which bakes `SUPPORT_EMAIL` in at build time
 * — the same NEXT_PUBLIC_*-style build-time-vs-runtime gotcha documented
 * in docs/PRODUCTION_DEPLOYMENT.md, but for a plain server-only env var
 * via static generation instead. Forcing dynamic rendering means an
 * owner can set SUPPORT_EMAIL and restart, without a full rebuild.
 */
export const dynamic = "force-dynamic";

export default function ContactPage() {
  const supportEmail = getSupportEmail();

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Contact</h1>
      {supportEmail ? (
        <p className="mt-4 text-base text-ink-muted">
          For questions about an existing project or quote, email{" "}
          <a href={`mailto:${supportEmail}`} className="text-purple underline">
            {supportEmail}
          </a>
          .
        </p>
      ) : (
        <p className="mt-4 text-base text-ink-muted">
          Servino support contact is being configured.
        </p>
      )}
    </div>
  );
}
