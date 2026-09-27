import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { ProjectLocationStep } from "@/components/quote/steps/ProjectLocationStep";

export const metadata: Metadata = { title: "Your Project" };

export default function ProjectPage() {
  return (
    <StepGuard step="project">
      <ProgressIndicator step="project" />
      <ProjectLocationStep />
    </StepGuard>
  );
}
