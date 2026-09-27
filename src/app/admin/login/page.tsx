import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/branding/Logo";

export const metadata = { title: "Sign in" };

export default async function AdminLoginPage() {
  const admin = await requireAdminSession();
  if (admin) redirect("/admin");

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Admin sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">Operations access only.</p>
          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
