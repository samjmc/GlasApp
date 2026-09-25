import { Link } from "wouter";
import { Heart, Map } from "lucide-react";
import { HomePageTabs } from "@/components/HomePageTabs";
import { TDScoresWidget, useScoresWidget } from "@/components/TDScoresWidget";
import { PartyRankingsWidget } from "@/components/PartyRankingsWidget";
import { YourTDsCard } from "@/components/home/YourTDsCard";
import { LatestVoteCard } from "@/components/home/LatestVoteCard";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { WelcomeBanner } from "@/components/onboarding/WelcomeBanner";
import { FirstTimeUserTour } from "@/components/onboarding/FirstTimeUserTour";
import { useAuth } from "@/contexts/AuthContext";

function HeroContext() {
  const { data } = useScoresWidget();
  const total = data?.stats.totalTds;
  const updated = data?.stats.lastScoredAt
    ? new Date(data.stats.lastScoredAt).toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <p className="text-base text-muted-foreground md:text-[17px]">
      {total ? `${total} TDs` : "Every TD"} rated on votes, questions and debate from the official Oireachtas record.
      {updated && ` Updated ${updated}.`}
    </p>
  );
}

const pill =
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-foreground transition-[background-color,transform] duration-150 hover:bg-elevated active:scale-[0.98]";

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <OnboardingModal />
      <FirstTimeUserTour />

      <div className="flex flex-col gap-6 md:gap-8">
        <header className="flex flex-col gap-2 pt-2">
          <h1 className="font-display text-[40px] font-bold leading-none tracking-tight md:text-[52px]">
            Your Dáil, <span className="text-primary">scored.</span>
          </h1>
          <HeroContext />
          <nav aria-label="More views" className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {isAuthenticated && (
              <Link href="/my-politics" className={pill}>
                <Heart className="h-4 w-4" aria-hidden="true" />
                My rankings
              </Link>
            )}
            <Link href="/constituencies" className={pill}>
              <Map className="h-4 w-4" aria-hidden="true" />
              Constituency map
            </Link>
          </nav>
        </header>

        <WelcomeBanner />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          <YourTDsCard className="md:col-span-2" />
          <LatestVoteCard />
          <TDScoresWidget />
          <PartyRankingsWidget className="md:col-span-2" />
        </div>

        <HomePageTabs />
      </div>
    </>
  );
}
