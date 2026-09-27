import Link from "next/link";
import { Logo } from "@/components/branding/Logo";

/**
 * Lighter header for the quote funnel — logo only, no marketing nav, so
 * the customer stays focused on completing the quote (spec section 3:
 * "Keep navigation lighter than the normal homepage").
 */
export function FunnelHeader() {
  return (
    <header className="border-b border-border bg-offwhite">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Link href="/">
          <Logo symbolSize={28} wordmarkTextClassName="text-base" />
        </Link>
      </div>
    </header>
  );
}
