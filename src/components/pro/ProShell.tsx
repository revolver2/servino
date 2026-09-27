"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/branding/Logo";

/**
 * Deliberately not AdminShell squeezed onto mobile (spec section 70) — a
 * fixed bottom tab bar (the standard shape for a phone-first operational
 * tool) instead of a sidebar, three destinations only, large tap targets.
 */
const TABS: { href: string; label: string; icon: string; exact?: boolean }[] = [
  { href: "/pro", label: "Home", icon: "🏠", exact: true },
  { href: "/pro/jobs", label: "Jobs", icon: "🧰" },
  { href: "/pro/profile", label: "Profile", icon: "👤" },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function ProShell({ displayName, children }: { displayName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/pro/auth/logout", { method: "POST" });
    router.push("/pro/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-offwhite">
      <header className="flex items-center justify-between border-b border-border bg-white px-4 py-3">
        <Link href="/pro">
          <Logo symbolSize={26} wordmarkTextClassName="text-base" />
        </Link>
        <div className="flex items-center gap-3">
          <span className="max-w-[9rem] truncate text-xs text-ink-muted" title={displayName}>
            {displayName}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-ink/20 hover:text-ink disabled:opacity-60"
          >
            {loggingOut ? "…" : "Sign out"}
          </button>
        </div>
      </header>

      {/* Not a <main> — the root layout already provides the page's one <main> landmark (same fix as AdminShell). */}
      <div className="flex-1 px-4 pb-24 pt-4">{children}</div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-3">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href, tab.exact);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                  active ? "text-purple" : "text-ink-muted"
                }`}
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
