import { isEnabled } from "@/lib/feature-flags";

/**
 * Spec section 15: never imply generic/stock imagery is real Servino work.
 * Stays disabled until verified before/after photos from completed
 * Servino jobs exist. Do not enable by flipping the flag with placeholder
 * or stock images.
 */
export function BeforeAfter() {
  if (!isEnabled("showBeforeAfter")) return null;

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          See the difference
        </h2>
      </div>
    </section>
  );
}
