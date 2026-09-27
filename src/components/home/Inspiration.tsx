import { isEnabled } from "@/lib/feature-flags";

/**
 * Spec section 16: style swatches only, not photography — avoids implying
 * any image represents real completed Servino work. Selecting a swatch
 * should only ever prefill a style identifier in the quote flow, never
 * price/measurements.
 */
const styles: { name: string; swatchClassName: string }[] = [
  { name: "Natural Wood", swatchClassName: "bg-[#C79A6B]" },
  { name: "Light Oak", swatchClassName: "bg-[#DCB98C]" },
  { name: "Dark Walnut", swatchClassName: "bg-[#5A3A2A]" },
  { name: "Black", swatchClassName: "bg-[#1A1A1E]" },
  { name: "White", swatchClassName: "bg-white border border-border" },
  { name: "Marble", swatchClassName: "bg-gradient-to-br from-white via-zinc-200 to-zinc-400" },
  { name: "Stone", swatchClassName: "bg-[#9C9488]" },
  { name: "Minimal", swatchClassName: "bg-[#EDEBE6]" },
  { name: "Contemporary", swatchClassName: "bg-[#7C7B85]" },
];

export function Inspiration() {
  if (!isEnabled("showInspirationGallery")) return null;

  return (
    <section id="inspiration" className="bg-offwhite py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Find your style
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            Explore looks for your space and start your project when something feels right.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-4">
          {styles.map((style) => (
            <div key={style.name} className="group flex flex-col items-center gap-2">
              <div
                className={`aspect-square w-full rounded-2xl transition-all motion-safe:group-hover:-translate-y-1 group-hover:shadow-md ${style.swatchClassName}`}
              />
              <span className="text-xs font-medium text-ink-muted">{style.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
