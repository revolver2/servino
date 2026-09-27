import type { ReactNode } from "react";
import { QuoteProvider } from "@/lib/quote/quote-provider";
import { FunnelHeader } from "@/components/quote/FunnelHeader";

export default function QuoteLayout({ children }: { children: ReactNode }) {
  return (
    <QuoteProvider>
      <FunnelHeader />
      {children}
    </QuoteProvider>
  );
}
