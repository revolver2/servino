import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { StyleMaterialStep } from "@/components/quote/steps/StyleMaterialStep";

export const metadata: Metadata = { title: "Style" };

export default function StylePage() {
  return (
    <StepGuard step="style">
      <ProgressIndicator step="style" />
      <StyleMaterialStep />
    </StepGuard>
  );
}
