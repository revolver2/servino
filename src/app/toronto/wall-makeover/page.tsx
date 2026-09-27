import type { Metadata } from "next";
import { FunnelHeader } from "@/components/quote/FunnelHeader";
import { Footer } from "@/components/layout/Footer";
import { TransformationHero } from "@/components/landing/TransformationHero";
import { BeforeAfter } from "@/components/home/BeforeAfter";
import { Services } from "@/components/home/Services";
import { Trust } from "@/components/home/Trust";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";
import { TrackPageView } from "@/components/analytics/TrackPageView";

export const metadata: Metadata = {
  title: "Wall Makeover — Toronto",
  description: "Choose your project, tell us about your wall, and get your Servino price.",
};

const LANDING_SLUG = "toronto/wall-makeover";

export default function WallMakeoverLandingPage() {
  return (
    <>
      <TrackPageView event={{ name: "landing_page_view", landingSlug: LANDING_SLUG }} />
      <FunnelHeader />
      <TransformationHero />
      <BeforeAfter />
      <Services />
      <Trust />
      <HowItWorks />
      <Faq />
      <FinalCta />
      <Footer />
    </>
  );
}
