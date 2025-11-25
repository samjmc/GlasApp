export type RegionCode = "IE" | "US";

export const DEFAULT_REGION_CODE: RegionCode = "IE";

export interface RegionSummaryCopy {
  title: string;
  tagline: string;
  description?: string;
}

export interface RegionAssets {
  flagEmoji: string;
  heroImage?: string;
}

export interface RegionConfig {
  code: RegionCode;
  name: string;
  shortName: string;
  defaultLocale: string;
  color: string;
  assets: RegionAssets;
  home: RegionSummaryCopy;
  onboarding: RegionSummaryCopy;
  newsCopy: RegionSummaryCopy;
  dailySessionCopy: RegionSummaryCopy;
  features: Record<RegionFeatureKey, boolean>;
}

export interface RegionNewsArticle {
  id: number;
  title: string;
  source: string;
  sourceLogoUrl?: string | null;
  publishedDate: string;
  imageUrl?: string | null;
  aiSummary?: string | null;
  url: string;
  politicianName?: string | null;
  constituency?: string | null;
  party?: string | null;
  impactScore?: number | null;
  storyType?: string | null;
  sentiment?: string | null;
  affectedTDs?: Array<{ name: string; impactScore: number }>;
}

export interface RegionNewsResponse {
  success: boolean;
  articles: RegionNewsArticle[];
  total: number;
  has_more: boolean;
  last_updated: string;
  source: string;
  sort?: string;
}

export interface RegionDailySessionItem {
  id: number;
  sessionItemId: number;
  articleId: number;
  headline: string;
  summary: string;
  policyDimension: string | null;
  policyDirection: string | null;
  orderIndex: number;
  hasVoted: boolean;
  rating?: number;
  prompt?: string;
  emoji?: string;
  highlightStats?: string[];
  contextNote?: string;
}

export interface RegionDailySessionCompletion {
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: "left" | "right" | "neutral";
  regionSummary: string;
  regionDimension?: string;
  regionPreviousRank?: number;
  regionCurrentRank?: number;
  streakCount: number;
  detailStats?: Array<{
    label: string;
    value: string;
    emoji?: string;
  }>;
}

export interface RegionDailySessionState {
  status: "pending" | "completed";
  sessionId: number;
  sessionDate: string;
  voteCount: number;
  streakCount: number;
  items: RegionDailySessionItem[];
  completion?: RegionDailySessionCompletion;
}

export type RegionFeatureKey =
  | "home"
  | "dailySession"
  | "newsFeed"
  | "politicianProfiles"
  | "partyProfiles"
  | "constituencyInsights"
  | "maps"
  | "ideas"
  | "polling"
  | "quiz"
  | "notifications"
  | "adminTools"
  | "debates"
  | "personalInsights"
  | "localRepresentatives"
  | "ratings"
  | "researchLibrary"
  | "conflictTracking"
  | "education"
  | "results"
  | "profile"
  | "activity"
  | "newsAdmin"
  | "storytelling";

const ALL_FEATURE_KEYS: RegionFeatureKey[] = [
  "home",
  "dailySession",
  "newsFeed",
  "politicianProfiles",
  "partyProfiles",
  "constituencyInsights",
  "maps",
  "ideas",
  "polling",
  "quiz",
  "notifications",
  "adminTools",
  "debates",
  "personalInsights",
  "localRepresentatives",
  "ratings",
  "researchLibrary",
  "conflictTracking",
  "education",
  "results",
  "profile",
  "activity",
  "newsAdmin",
  "storytelling",
];

const ALL_FEATURES_RECORD: Record<RegionFeatureKey, boolean> = ALL_FEATURE_KEYS.reduce(
  (acc, key) => {
    acc[key] = true;
    return acc;
  },
  {} as Record<RegionFeatureKey, boolean>,
);

export const REGION_CONFIGS: Record<RegionCode, RegionConfig> = {
  IE: {
    code: "IE",
    name: "Ireland",
    shortName: "Ireland",
    defaultLocale: "en-IE",
    color: "#008037",
    assets: {
      flagEmoji: "🇮🇪",
      heroImage: "/images/hero/ireland.jpg",
    },
    home: {
      title: "Irish Political Accountability",
      tagline: "AI-powered insights across TDs, constituencies, and live sentiment",
      description:
        "Track national and local performance across Ireland with real-time news scoring, TD rankings, and constituency analytics.",
    },
    onboarding: {
      title: "Stay on top of Irish politics",
      tagline: "Complete your daily loop to track how TDs and parties respond across Ireland.",
    },
    newsCopy: {
      title: "Irish Impact Feed",
      tagline: "Highest-impact political stories affecting TD scores and policy opportunities.",
    },
    dailySessionCopy: {
      title: "Daily Accountability Loop",
      tagline: "Vote on three Irish policy stories to keep your streak and see local shifts.",
    },
    features: { ...ALL_FEATURES_RECORD },
  },
  US: {
    code: "US",
    name: "United States",
    shortName: "USA",
    defaultLocale: "en-US",
    color: "#1a56db",
    assets: {
      flagEmoji: "🇺🇸",
      heroImage: "/images/hero/usa.jpg",
    },
    home: {
      title: "US Political Accountability",
      tagline: "Mock data preview – congressional insights and sentiment tracking coming soon.",
      description:
        "Prototype experience for the US edition. Final data integrations will cover federal lawmakers, swing districts, and localized accountability loops.",
    },
    onboarding: {
      title: "Preview the US edition",
      tagline: "Explore how the accountability loop adapts to congressional districts and national sentiment.",
    },
    newsCopy: {
      title: "US Mock Impact Feed",
      tagline: "Sample coverage highlighting bipartisan bills, committee investigations, and national sentiment pivots.",
    },
    dailySessionCopy: {
      title: "US Daily Loop",
      tagline: "Vote on three sample US political stories to preview streaks and sentiment shifts.",
    },
    features: {
      home: true,
      dailySession: true,
      newsFeed: true,
      politicianProfiles: false,
      partyProfiles: false,
      constituencyInsights: false,
      maps: false,
      ideas: false,
      polling: false,
      quiz: false,
      notifications: false,
      adminTools: false,
      debates: false,
      personalInsights: false,
      localRepresentatives: false,
      ratings: false,
      researchLibrary: false,
      conflictTracking: false,
      education: false,
      results: false,
      profile: false,
      activity: false,
      newsAdmin: false,
      storytelling: false,
    },
  },
};

export const REGION_LIST = Object.values(REGION_CONFIGS).map(({ code, name, shortName, assets, home }) => ({
  code,
  name,
  shortName,
  flagEmoji: assets.flagEmoji,
  tagline: home.tagline,
}));

export function isRegionCode(value: unknown): value is RegionCode {
  return typeof value === "string" && (value === "IE" || value === "US");
}

export const REGION_NEWS_MOCK: Record<RegionCode, RegionNewsResponse | null> = {
  IE: null,
  US: {
    success: true,
    source: "Mock Data",
    sort: "today",
    last_updated: new Date().toISOString(),
    total: 3,
    has_more: false,
    articles: [
      {
        id: 9001,
        title: "Bipartisan infrastructure bill clears key hurdle with rural broadband focus",
        source: "Associated Press",
        sourceLogoUrl: null,
        publishedDate: new Date().toISOString(),
        imageUrl: "/region/us/news/infrastructure.jpg",
        aiSummary:
          "The Senate Commerce Committee advanced a bipartisan $68B infrastructure package with targeted funds for rural broadband expansion. Lawmakers from Ohio and Arizona negotiated stricter rollout milestones after watchdogs flagged delays in earlier programs.",
        url: "https://apnews.com/mock/us-infrastructure",
        politicianName: "Sen. Maria Cantwell",
        impactScore: 6,
        storyType: "policy_win",
        sentiment: "positive",
        affectedTDs: [
          { name: "Sen. Maria Cantwell", impactScore: 4 },
          { name: "Sen. JD Vance", impactScore: 3 },
        ],
      },
      {
        id: 9002,
        title: "House ethics panel opens inquiry into undisclosed stock trades",
        source: "Politico",
        sourceLogoUrl: null,
        publishedDate: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        imageUrl: "/region/us/news/ethics.jpg",
        aiSummary:
          "A bipartisan House ethics panel initiated a preliminary probe into Rep. Caldwell following unreported trades in semiconductor stocks ahead of key committee votes. Watchdogs argue the case will set precedent ahead of a broader stock-trading reform push.",
        url: "https://www.politico.com/mock/ethics-probe",
        politicianName: "Rep. Elise Caldwell",
        impactScore: -7,
        storyType: "investigation",
        sentiment: "negative",
        affectedTDs: [{ name: "Rep. Elise Caldwell", impactScore: -7 }],
      },
      {
        id: 9003,
        title: "Midwest swing district town halls spotlight fentanyl and manufacturing",
        source: "Axios",
        sourceLogoUrl: null,
        publishedDate: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
        imageUrl: "/region/us/news/townhall.jpg",
        aiSummary:
          "Mock coverage from Michigan's 7th shows competing narratives on fentanyl trafficking and reshoring subsidies. Constituents pressed lawmakers on why overdose response funding lags despite bipartisan rhetoric.",
        url: "https://www.axios.com/mock/midwest-townhall",
        politicianName: "Rep. Priya Malhotra",
        impactScore: 2,
        storyType: "constituency",
        sentiment: "mixed",
        affectedTDs: [{ name: "Rep. Priya Malhotra", impactScore: 2 }],
      },
    ],
  },
};

export const REGION_DAILY_SESSION_MOCK: Record<RegionCode, RegionDailySessionState | null> = {
  IE: null,
  US: null,
};


