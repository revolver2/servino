const traditional = [
  "Call multiple contractors",
  "Repeat your project details every time",
  "Wait days for quotes to trickle in",
  "Compare estimates manually",
  "Coordinate scheduling yourself",
];

const servino = [
  "Describe your project once",
  "Get a clear price up front",
  "Connect with a vetted professional",
  "Hear back from the Servino team directly",
];

const pillars = [
  {
    title: "Trusted Professionals",
    description: "Professionals go through a Servino review process before taking jobs.",
  },
  {
    title: "Clear Pricing",
    description: "Know what your project costs before you request it — no surprise quotes.",
  },
  {
    title: "Servino Support",
    description: "Servino stays involved from your first request through project completion.",
  },
  {
    title: "Simple Project Coordination",
    description: "Servino coordinates the details with your professional on your behalf.",
  },
];

export function Trust() {
  return (
    <section className="bg-offwhite py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Why homeowners choose Servino
        </h2>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-6">
            <p className="text-sm font-semibold text-ink-muted">The old way</p>
            <ul className="mt-4 space-y-3">
              {traditional.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink-muted">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted/40" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-purple bg-white p-6">
            <p className="text-sm font-semibold text-purple">With Servino</p>
            <ul className="mt-4 space-y-3">
              {servino.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar) => (
            <div key={pillar.title}>
              <p className="text-base font-semibold text-ink">{pillar.title}</p>
              <p className="mt-2 text-sm text-ink-muted">{pillar.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
