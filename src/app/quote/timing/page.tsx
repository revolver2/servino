import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { TimingStep } from "@/components/quote/steps/TimingStep";

export const metadata: Metadata = { title: "Timing" };

export default function TimingPage() {
  return (
    <StepGuard step="timing">
      <ProgressIndicator step="timing" />
      <TimingStep />
    </StepGuard>
  );
}
