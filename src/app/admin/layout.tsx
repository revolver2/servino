import type { Metadata } from "next";

// Never indexed — admin surfaces should not appear in search results even
// if a URL leaks (spec section 42).
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Servino Admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full bg-offwhite">{children}</div>;
}
