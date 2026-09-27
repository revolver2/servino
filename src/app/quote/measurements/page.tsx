import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { MeasurementsStep } from "@/components/quote/steps/MeasurementsStep";

export const metadata: Metadata = { title: "Measurements" };

export default function MeasurementsPage() {
  return (
    <StepGuard step="measurements">
      <ProgressIndicator step="measurements" />
      <MeasurementsStep />
    </StepGuard>
  );
}
