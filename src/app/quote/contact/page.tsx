import type { Metadata } from "next";
import { StepGuard } from "@/components/quote/StepGuard";
import { ProgressIndicator } from "@/components/quote/ProgressIndicator";
import { ContactStep } from "@/components/quote/steps/ContactStep";

export const metadata: Metadata = { title: "Your Contact Details" };

export default function ContactPage() {
  return (
    <StepGuard step="contact">
      <ProgressIndicator step="contact" />
      <ContactStep />
    </StepGuard>
  );
}
