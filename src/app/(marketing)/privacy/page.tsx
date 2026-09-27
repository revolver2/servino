import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl px-4 py-20 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
      <p className="mt-4 text-sm text-ink-muted">
        This policy describes what the Servino product collects and how
        it&apos;s used.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">What we collect</h2>
      <p className="mt-2 text-sm text-ink-muted">When you use the Servino quote tool, we collect:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        <li>Project details you enter: service type, postal code, measurements, style, material preference.</li>
        <li>If you continue past the price step: your first name, email address, and phone number.</li>
        <li>A timing preference for when you&apos;d like the project started.</li>
        <li>
          Basic marketing attribution (where you came from — e.g. a search or ad
          campaign, the page you landed on) — this does not include your name or
          contact details.
        </li>
        <li>
          A photo of your space, if you choose to add one. It is only used
          for your own preview during the quote process and is not sent to
          or stored on Servino&apos;s servers — see &quot;Photos&quot; below.
        </li>
      </ul>
      <p className="mt-3 text-sm text-ink-muted">
        If you complete payment, PayPal collects your card or PayPal account
        details directly — Servino&apos;s servers never receive or store your
        raw card number. Servino does receive and store payment status, amount,
        and PayPal&apos;s own transaction reference from PayPal, to confirm and
        track your payment. We do not ask for or collect government ID, date of
        birth, or other identity documents through this quote tool.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">How we use it</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Project and contact details are used to follow up on the project quote you
        requested and to connect you with a Servino professional. We do not use
        your contact details for promotional marketing unless you separately opt
        in to that in the future — nothing in the current quote flow does this
        automatically or by default.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Photos</h2>
      <p className="mt-2 text-sm text-ink-muted">
        A photo you add is processed only on your own device, to show you a
        preview — it is not uploaded to or retained on Servino servers. If
        that changes in the future (for example, so a professional can
        reference it), we&apos;ll update this policy before it does.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Where it&apos;s stored</h2>
      <p className="mt-2 text-sm text-ink-muted">
        Project and contact details are stored in a database operated by Servino.
        Some non-identifying technical information (like which analytics events
        occurred) may be logged for debugging; we do not include your name,
        email, or phone number in those logs.
      </p>

      <h2 className="mt-8 text-lg font-semibold text-ink">Your choices</h2>
      <p className="mt-2 text-sm text-ink-muted">
        You can get a project price without providing contact details — those are
        only requested once you choose to continue with your project request. To request
        access to, correction of, or deletion of information you&apos;ve provided,
        contact us at the details on our{" "}
        <a href="/contact" className="text-purple underline">
          Contact
        </a>{" "}
        page.
      </p>
    </div>
  );
}
