import Link from "next/link";
import { Logo } from "@/components/branding/Logo";

const footerLinks: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Servino",
    links: [
      { href: "/#services", label: "Services" },
      { href: "/#how-it-works", label: "How It Works" },
      { href: "/#inspiration", label: "Inspiration" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-offwhite">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo symbolSize={30} wordmarkTextClassName="text-lg" />
            <p className="mt-3 text-sm text-ink-muted">
              Improving your home should be easy. Serving Toronto, Ontario.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            {footerLinks.map((group) => (
              <div key={group.heading}>
                <p className="text-sm font-semibold text-ink">{group.heading}</p>
                <ul className="mt-3 space-y-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-ink-muted hover:text-ink">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-ink-muted">
          © {year} Servino. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
