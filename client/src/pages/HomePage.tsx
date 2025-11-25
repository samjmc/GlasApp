import { useEffect, useState } from "react";
import { TodaysBiggestImpact } from "@/components/TodaysBiggestImpact";
import { HomePageTabs } from "@/components/HomePageTabs";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { WelcomeBanner } from "@/components/onboarding/WelcomeBanner";
import { FirstTimeUserTour } from "@/components/onboarding/FirstTimeUserTour";
import { useRegion } from "@/hooks/useRegion";
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

// Mock articles for demo
const mockArticles = [
  {
    id: 1,
    title: 'Minister announces €5 million funding package for local hospital expansion',
    source: 'Irish Times',
    publishedDate: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    imageUrl: '/news-images/article_0_5748.png',
    aiSummary: 'Health Minister successfully negotiated a €5 million capital funding package for expanding hospital facilities in Cork. The funding will be used to add 50 new beds and modernize equipment. Local health officials praised the achievement, noting the hospital has been overcapacity for 3 years. Construction is expected to begin within 6 months.',
    url: 'https://irishtimes.com/example',
    politicianName: 'Micheál Martin',
    impactScore: 7,
    storyType: 'achievement',
    sentiment: 'positive',
    likes: 234,
    commentCount: 45,
    comments: [
      {
        id: 1,
        author: 'Emma K.',
        avatar: 'EK',
        content: 'Finally some good news! That hospital desperately needed this.',
        likes: 12,
        timestamp: '1 hour ago'
      },
      {
        id: 2,
        author: 'Liam B.',
        avatar: 'LB',
        content: 'Great work but what about the Limerick hospital that was promised 2 years ago?',
        likes: 8,
        timestamp: '45 minutes ago'
      },
      {
        id: 3,
        author: 'Sarah M.',
        avatar: 'SM',
        content: 'Credit where credit is due. Well done Minister!',
        likes: 15,
        timestamp: '30 minutes ago'
      }
    ]
  },
  {
    id: 2,
    title: 'TD under investigation for undisclosed property dealings',
    source: 'The Journal',
    publishedDate: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    imageUrl: '/news-images/article_0_6243.png',
    aiSummary: 'Opposition TD is facing an ethics committee investigation regarding property transactions that were not properly disclosed. The TD purchased three properties through a company while voting on housing legislation. Ethics watchdogs have raised concerns about potential conflicts of interest. The TD denies any wrongdoing.',
    url: 'https://thejournal.ie/example',
    politicianName: 'Example TD',
    impactScore: -9,
    storyType: 'scandal',
    sentiment: 'negative',
    likes: 456,
    commentCount: 89,
    comments: [
      {
        id: 4,
        author: 'John D.',
        avatar: 'JD',
        content: 'This is exactly what\'s wrong with Irish politics. No accountability.',
        likes: 34,
        timestamp: '3 hours ago'
      },
      {
        id: 5,
        author: 'Mary O.',
        avatar: 'MO',
        content: 'Innocent until proven guilty. Let the investigation play out.',
        likes: 18,
        timestamp: '2 hours ago'
      },
      {
        id: 6,
        author: 'Patrick C.',
        avatar: 'PC',
        content: 'How many times have we seen this? They never face real consequences.',
        likes: 27,
        timestamp: '1 hour ago'
      }
    ]
  }
];
