import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Terms of Service</h1>
      <p className="mt-4 text-sm text-ink-muted">
        These terms describe how Servino&apos;s project request, pricing, and
        payment process works, and what does and doesn&apos;t happen at each
        step.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">The Service</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Servino lets you describe a home improvement project (currently:
        decorative wall installation in Toronto, Ontario), see a price
        estimate, submit that project as a request, and pay online to secure
        it. Servino reviews each request and arranges for a suitable
        professional to carry out the work — you do not select the
        professional yourself. Coordination and updates happen through the
        Servino team directly, by phone or email, not through in-app
        messaging or automated scheduling.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">What submitting a project means</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Submitting your contact details and timing preference creates a{" "}
        <strong>project request</strong> — it means you&apos;ve asked Servino to
        follow up about your project. It does <strong>not</strong> mean:
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li>a professional has been assigned to your project,</li>
        <li>an appointment has been scheduled,</li>
        <li>any payment has been made or is due, or</li>
        <li>work has been booked or confirmed.</li>
      </ul>
      <p className="mt-2 text-sm text-ink-muted">
        Pricing shown during the quote process is an estimate produced by
        Servino&apos;s pricing tool at the time you viewed it, not a final,
        binding contract price.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Payment</h2>
      <p className="mt-2 text-sm text-ink-muted">
        After submitting a project request, you may be asked to complete
        payment through PayPal for the amount shown. Payment is collected
        securely by PayPal — Servino does not receive or store your card
        details. If your project can&apos;t proceed, contact Servino; refunds
        are reviewed on a case-by-case basis and, if approved, issued back to
        your original payment method.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Professionals</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Work is carried out by professionals who work with Servino, not by
        Servino employees. Servino reviews professionals before offering
        them projects, but does not itself perform or supervise the physical
        work.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Completion and confirmation</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Once a professional reports your project complete, Servino will ask
        you to confirm completion. If something isn&apos;t right, you can
        report an issue instead of confirming — this notifies Servino and
        pauses the project so it can be looked into, rather than closing it
        out automatically.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Accuracy of information</h2>
      <p className="mt-2 text-sm text-ink-muted">
        You&apos;re responsible for providing accurate project details (location,
        measurements, contact information) — Servino&apos;s price estimate and
        any follow-up depend on the information you provide being correct.
      </p>

      <p className="mt-8 text-sm text-ink-muted">
        Questions about these terms? Reach out through the{" "}
        <a href="/contact" className="text-purple underline">
          Contact
        </a>{" "}
        page.
      </p>
    </div>
  );
}
