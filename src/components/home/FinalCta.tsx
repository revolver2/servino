import Link from "next/link";

export function FinalCta() {
  return (
    <section className="bg-ink py-16 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to transform your space?
        </h2>
        <p className="mt-4 text-base text-white/70">
          Tell us about your project and see your Servino price.
        </p>
        <div className="mt-8">
          <Link
            href="/quote"
            className="inline-flex items-center justify-center rounded-full bg-purple px-7 py-3.5 text-base font-semibold text-white transition-all hover:bg-purple-dark motion-safe:hover:-translate-y-0.5"
          >
            Get Your Price
          </Link>
        </div>
      </div>
    </section>
  );
}
