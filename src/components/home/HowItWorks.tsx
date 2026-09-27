const steps = [
  { title: "Tell us about your project", dotClassName: "bg-purple" },
  { title: "Get your price", dotClassName: "bg-coral" },
  { title: "We connect you with a professional", dotClassName: "bg-teal" },
  { title: "Get it done", dotClassName: "bg-purple" },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Home projects, without the hassle.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="rounded-2xl border border-border p-6 transition-all hover:shadow-md motion-safe:hover:-translate-y-1"
            >
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${step.dotClassName}`} />
                <span className="text-sm font-bold tracking-wide text-ink-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <p className="mt-3 text-base font-semibold text-ink">{step.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
