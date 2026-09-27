import { Hero } from "@/components/home/Hero";
import { Services } from "@/components/home/Services";
import { BeforeAfter } from "@/components/home/BeforeAfter";
import { Inspiration } from "@/components/home/Inspiration";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Trust } from "@/components/home/Trust";
import { Faq } from "@/components/home/Faq";
import { FinalCta } from "@/components/home/FinalCta";
import { TrackPageView } from "@/components/analytics/TrackPageView";

export default function Home() {
  return (
    <>
      <TrackPageView event={{ name: "homepage_view" }} />
      <Hero />
      <Services />
      <BeforeAfter />
      <Inspiration />
      <HowItWorks />
      <Trust />
      <Faq />
      <FinalCta />
    </>
  );
}
