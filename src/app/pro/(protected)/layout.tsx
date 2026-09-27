import { redirect } from "next/navigation";
import { requireProfessionalSession } from "@/lib/server/pro-auth";
import { ProShell } from "@/components/pro/ProShell";

/**
 * The page-level half of the professional auth boundary — same principle
 * as the admin (protected) layout (spec section 43, extended to /pro):
 * every /api/pro/* route independently calls requireProfessionalSession()
 * itself too, so hiding this layout alone is never the actual mechanism.
 */
export default async function ProProtectedLayout({ children }: { children: React.ReactNode }) {
  const professional = await requireProfessionalSession();
  if (!professional) redirect("/pro/login");

  return <ProShell displayName={professional.displayName}>{children}</ProShell>;
}
