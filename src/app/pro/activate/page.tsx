import { Logo } from "@/components/branding/Logo";
import { ProActivateForm } from "@/components/pro/ProActivateForm";
import { Card } from "@/components/admin/ui";

export const metadata = { title: "Set up your Servino account" };

export default async function ProActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Set up your account</h1>
          <p className="mt-1 text-sm text-ink-muted">Choose a password to start using Servino.</p>
          <div className="mt-6">
            {token ? (
              <ProActivateForm token={token} />
            ) : (
              <p role="alert" className="rounded-xl bg-coral-light px-4 py-3 text-sm text-ink">
                This activation link is missing its token. Ask your admin to send you the full link again.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
