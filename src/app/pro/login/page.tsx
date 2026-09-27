import { redirect } from "next/navigation";
import { requireProfessionalSession } from "@/lib/server/pro-auth";
import { ProLoginForm } from "@/components/pro/ProLoginForm";
import { Logo } from "@/components/branding/Logo";

export const metadata = { title: "Professional sign in" };

export default async function ProLoginPage() {
  const professional = await requireProfessionalSession();
  if (professional) redirect("/pro");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Professional sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">For Servino professionals only.</p>
          <div className="mt-6">
            <ProLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
