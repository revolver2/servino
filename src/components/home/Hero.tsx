import Link from "next/link";

/**
 * Abstract "slat wall panel" illustration — evokes Servino's flagship
 * service (fluted/slat decorative panels) without claiming to be a real
 * photo or a completed Servino project (spec section 14 — image
 * truthfulness). Purely geometric, so there's no risk of it being
 * mistaken for stock or generated photography.
 */
const SLATS = [
  { h: 58, tone: "bg-purple/70" },
  { h: 78, tone: "bg-purple/40" },
  { h: 46, tone: "bg-coral/60" },
  { h: 90, tone: "bg-ink/80" },
  { h: 64, tone: "bg-purple/50" },
  { h: 100, tone: "bg-teal/55" },
  { h: 72, tone: "bg-ink/60" },
  { h: 52, tone: "bg-coral/40" },
  { h: 86, tone: "bg-purple/60" },
  { h: 40, tone: "bg-teal/35" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-offwhite">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-4 inline-flex items-center rounded-full bg-purple-light px-3 py-1 text-xs font-semibold text-purple-dark">
              Now serving Toronto, Ontario
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
              A better home starts with the right pro.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-ink-muted">
              Choose your project, get a clear price, and connect with a trusted local
              professional.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/quote"
                className="inline-flex items-center justify-center rounded-full bg-purple px-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-purple-dark motion-safe:hover:-translate-y-0.5"
              >
                Get Your Price
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-full border border-border bg-white px-7 py-3.5 text-base font-semibold text-ink transition-colors hover:border-ink/20"
              >
                Explore Services
              </a>
            </div>

            <ul className="mt-10 grid grid-cols-3 gap-4 border-t border-border pt-6 sm:max-w-md">
              {[
                { label: "Clear pricing", dotClassName: "bg-teal" },
                { label: "Trusted pros", dotClassName: "bg-purple" },
                { label: "Simple process", dotClassName: "bg-coral" },
              ].map(({ label, dotClassName }) => (
                <li key={label} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${dotClassName}`} />
                  <span className="text-xs font-medium leading-4 text-ink-muted">{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-gradient-to-br from-white via-offwhite to-purple-light">
            <div className="absolute inset-0 flex items-end justify-center gap-2 px-8 pb-8 sm:gap-2.5 sm:px-12">
              {SLATS.map((slat, i) => (
                <span
                  key={i}
                  className={`w-full max-w-[18px] rounded-full ${slat.tone} shadow-sm`}
                  style={{ height: `${slat.h}%` }}
                />
              ))}
            </div>
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/60 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
