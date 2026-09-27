import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { PhotoStep } from "@/components/quote/steps/PhotoStep";

export const metadata: Metadata = { title: "Photo" };

export default function PhotoPage() {
  return (
    <StepGuard step="photo">
      <ProgressIndicator step="photo" />
      <PhotoStep />
    </StepGuard>
  );
}
