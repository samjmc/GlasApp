import { useEffect, useState } from "react";
import { TodaysBiggestImpact } from "@/components/TodaysBiggestImpact";
import { HomePageTabs } from "@/components/HomePageTabs";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { WelcomeBanner } from "@/components/onboarding/WelcomeBanner";
import { FirstTimeUserTour } from "@/components/onboarding/FirstTimeUserTour";
import { useRegion } from "@/hooks/useRegion";
import { PageHeader } from "@/components/PageHeader";
import USHomePreviewPage from "./USHomePreviewPage";

export default function HomePage() {
  const { region } = useRegion();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (region?.code === "US") {
    return <USHomePreviewPage />;
  }
  const title = region?.home.title ?? 'Glas Politics';
  const tagline = region?.home.tagline ?? 'Accountability insights in progress.';

  return (
    <>
      {/* Onboarding Components */}
      <OnboardingModal />
      <FirstTimeUserTour />
      
      <div className="mobile-shell mobile-stack">
        <PageHeader
          className="mt-1"
          title={title}
          tooltipTitle="How to use the home page"
          bullets={[
            "Catch up on the day's most impactful political story at a glance.",
            "Browse the live news feed and vote on policy opportunities.",
            "Switch tabs to view TD rankings or explore constituency data."
          ]}
        />

        {/* Welcome Banner for new users */}
        <WelcomeBanner />

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            Today&apos;s Biggest Impact
          </h2>
          <TodaysBiggestImpact variant="compact" />
        </div>

        {/* Tabbed Content: Feed | TDs | Constituencies */}
        <HomePageTabs showScrollTop={showScrollTop} onScrollTop={handleScrollTop} />
      </div>
    </>
  );
}
