import Link from "next/link";
import { getEnabledServices } from "@/lib/services-data";

const cardAccents = ["bg-purple-light", "bg-coral-light", "bg-teal-light", "bg-purple-light"];

export function Services() {
  const items = getEnabledServices();

  return (
    <section id="services" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            What would you like to transform?
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            Start with a project below to get a price and connect with a professional.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {items.map((service, i) => (
            <Link
              key={service.slug}
              href={`/quote/project?service=${service.slug}`}
              className="group rounded-2xl border border-border p-5 transition-all hover:border-ink/15 hover:shadow-md motion-safe:hover:-translate-y-1 sm:p-6"
            >
              <div className={`h-16 w-16 rounded-xl ${cardAccents[i % cardAccents.length]}`} />
              <p className="mt-5 text-base font-semibold text-ink">{service.name}</p>
              <p className="mt-1 text-sm text-ink-muted">{service.shortDescription}</p>
              <span className="mt-4 inline-flex items-center text-sm font-semibold text-purple transition-transform group-hover:text-purple-dark motion-safe:group-hover:translate-x-0.5">
                Get Price →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
