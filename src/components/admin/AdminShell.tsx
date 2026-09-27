"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/branding/Logo";

const NAV_ITEMS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/launch", label: "Launch" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/professionals", label: "Professionals" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/pricing", label: "Pricing" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(pathname, item.href, item.exact) ? "page" : undefined}
          className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(pathname, item.href, item.exact)
              ? "bg-purple-light text-purple-dark"
              : "text-ink-muted hover:bg-offwhite hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminShell({
  adminEmail,
  children,
}: {
  adminEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-white px-4 py-6 lg:flex lg:flex-col">
        <Link href="/admin" className="mb-8 px-2">
          <Logo symbolSize={28} wordmarkTextClassName="text-lg" />
        </Link>
        <NavLinks pathname={pathname} />
        <div className="mt-auto space-y-3 border-t border-border pt-4">
          <p className="truncate px-2 text-xs text-ink-muted" title={adminEmail}>
            {adminEmail}
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted transition-colors hover:bg-offwhite hover:text-ink disabled:opacity-60"
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-white px-4 py-3 lg:hidden">
        <Link href="/admin">
          <Logo symbolSize={26} wordmarkTextClassName="text-base" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
          aria-controls="admin-mobile-nav"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink"
        >
          Menu
        </button>
      </header>
      {mobileNavOpen && (
        <div id="admin-mobile-nav" className="border-b border-border bg-white px-4 py-3 lg:hidden">
          <NavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          <div className="mt-3 border-t border-border pt-3">
            <p className="px-2 text-xs text-ink-muted">{adminEmail}</p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-muted hover:bg-offwhite hover:text-ink disabled:opacity-60"
            >
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}

      {/* Not a <main> — the root layout already provides the page's one <main> landmark. */}
      <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
    </div>
  );
}
