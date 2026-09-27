import Link from "next/link";

export function TransformationHero() {
  return (
    <section className="bg-offwhite">
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="mb-4 inline-flex items-center rounded-full bg-purple-light px-3 py-1 text-xs font-semibold text-purple-dark">
          Now serving Toronto, Ontario
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
          Transform your wall without the contractor search.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-ink-muted">
          Choose your project, tell us about your wall, and get your Servino price.
        </p>
        <div className="mt-8">
          <Link
            href="/quote"
            className="inline-flex items-center justify-center rounded-full bg-purple px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-purple-dark"
          >
            Get My Price
          </Link>
        </div>
      </div>
    </section>
  );
}
