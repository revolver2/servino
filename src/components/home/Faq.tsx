const faqs = [
  {
    q: "What is Servino?",
    a: "Servino helps you plan a home improvement project, see a clear price, and connect with a trusted local professional.",
  },
  {
    q: "How do I get my project price?",
    a: "Tell us about your project — the type of work, your wall measurements, and a style if you have one in mind — and you'll see a price before you book anything.",
  },
  {
    q: "Can I provide my own materials?",
    a: "Yes. When you request your price, you can let us know whether you already have the material or want Servino to include it.",
  },
  {
    q: "Can I upload a photo?",
    a: "Yes, and it's optional. It's previewed on your own device to help you visualize your space — it isn't uploaded to Servino at this time. You can skip it and continue with just your measurements.",
  },
  {
    q: "Do I need exact measurements?",
    a: "Close measurements are enough to get started — you can confirm exact details with your professional later.",
  },
  {
    q: "What happens after I submit my project?",
    a: "Your project request goes to the Servino team, who review it and reach out to confirm next steps.",
  },
  {
    q: "How does Servino connect me with professionals?",
    a: "After you submit your project, Servino reviews it and connects you with a professional suited to your project and area.",
  },
  {
    q: "Where is Servino currently available?",
    a: "Servino is currently available in Toronto, Ontario, starting with decorative wall and interior installation projects.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Questions? We&apos;ve got answers.
        </h2>

        <div className="mt-8 divide-y divide-border rounded-2xl border border-border">
          {faqs.map((item) => (
            <details key={item.q} className="group p-5 open:bg-offwhite/60 sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between text-base font-semibold text-ink">
                {item.q}
                <span className="ml-4 shrink-0 text-ink-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
