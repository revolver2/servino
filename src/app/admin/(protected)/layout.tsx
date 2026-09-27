import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/server/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * The page-level half of the auth boundary (spec section 43) — every
 * route under this group renders nothing without a valid, non-expired,
 * non-revoked session. The other half is that every `/api/admin/*` route
 * independently calls `requireAdminSession()` itself too, so hiding this
 * layout alone was never the actual security mechanism.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();
  if (!admin) redirect("/admin/login");

  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
