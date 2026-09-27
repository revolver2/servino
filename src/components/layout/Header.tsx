"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/branding/Logo";

/**
 * Every link here must resolve to something real — a homepage anchor
 * that exists, or nothing at all. No "For Professionals" / "About" /
 * "Help" / "Sign In" yet: none of those destinations exist in the
 * product (no professional portal, no about page, no help center, no
 * auth), and a decorative link that 404s is worse than a shorter nav.
 */
const navLinks = [
  { href: "/#services", label: "Services" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#inspiration", label: "Inspiration" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-offwhite/90 backdrop-blur transition-shadow duration-200 ${
        scrolled ? "border-border shadow-sm" : "border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-4 transition-[height] duration-200 sm:px-6 lg:px-8 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Logo symbolSize={32} wordmarkTextClassName="text-lg" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link
            href="/quote"
            className="inline-flex items-center justify-center rounded-full bg-purple px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-purple-dark motion-safe:hover:-translate-y-0.5"
          >
            Get Your Price
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-offwhite px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink-muted hover:bg-purple-light hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/quote"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-purple px-5 py-3 text-base font-semibold text-white"
            >
              Get Your Price
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
