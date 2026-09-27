import type { Metadata } from "next";
import { CustomerConfirmCompletion } from "@/components/confirm/CustomerConfirmCompletion";

export const metadata: Metadata = { title: "Confirm your project" };

/**
 * Token-authenticated, not session-authenticated (spec section 35) —
 * the customer funnel has no persistent login, so the admin-delivered
 * link itself is the credential, the same model as `/pro/activate`.
 * Never trusts anything client-side; `CustomerConfirmCompletion` only
 * trusts `/api/customer/context`'s server response.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {token ? (
        <CustomerConfirmCompletion token={token} />
      ) : (
        <p role="alert" className="rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
          This link is missing its token. Ask Servino for the full link again.
        </p>
      )}
    </div>
  );
}
