import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { PriceStep } from "@/components/quote/steps/PriceStep";

export const metadata: Metadata = { title: "Your Price" };

export default function PricePage() {
  return (
    <StepGuard step="price">
      <ProgressIndicator step="price" />
      <PriceStep />
    </StepGuard>
  );
}
