/**
 * Central query-key factory.
 *
 * Every key here reproduces a literal query-key shape that is already used by a
 * `useQuery` call site in this app (verified by grep), so migrating a call site
 * to these functions is a drop-in refactor that does NOT invalidate existing
 * query-cache entries. `getQueryFn` fetches `queryKey[0]` as the URL, so the
 * first element of each key is the API path (or a stable namespace) exactly as
 * used today.
 */
export const queryKeys = {
  td: {
    stats: () => ["td-stats"] as const,
    scoresWidget: () => ["td-scores-widget-v2"] as const,
    quickInfo: (tdId: number) => ["td-quick-info", tdId] as const,
    scores: (constituency: string) => ["td-scores", constituency] as const,
    scoresFull: (
      viewMode: string,
      sortMode: string,
      constituency: string,
      party: string
    ) => ["td-scores-full", viewMode, sortMode, constituency, party] as const,
    leaderboard: () => ["td-leaderboard-v2"] as const,
    profile: (name: string) => ["td-profile", name] as const,
    profileV2: (name: string) => ["td-profile-v2", name] as const,
    consistency: (politicianName: string | undefined) =>
      ["td-consistency", politicianName] as const,
    forChat: () => ["tds-for-chat"] as const,
    researched: () => ["researched-tds"] as const,
    news: (name: string) => ["td-news-v2", name] as const,
    debateMetrics: (politicianName: string) =>
      ["td-debate-metrics", politicianName] as const,
    debateHistory: (politicianName: string) =>
      ["td-debate-history", politicianName] as const,
    debateAlerts: (politicianName: string) =>
      ["td-debate-alerts", politicianName] as const,
    votingStats: (politicianName: string) =>
      ["td-voting-stats", politicianName] as const,
    rebelVotes: (politicianName: string) => ["td-rebel-votes", politicianName] as const,
    recentVotes: (politicianName: string) => ["td-recent-votes", politicianName] as const,
  },
  party: {
    rankings: () => ["party-rankings-v3"] as const,
    quickInfo: (partyName: string) => ["party-quick-info", partyName] as const,
    profile: (name: string) => ["party-profile", name] as const,
    tds: (partyName: string) => ["party-tds", partyName] as const,
    polling: (party: string | undefined) => ["party-polling", party] as const,
  },
  news: {
    feed: (sortBy: string, page: number) => ["news-feed-v5", sortBy, page] as const,
    biggestImpact: (regionCode: string | null) =>
      ["biggest-impact-today-v4", regionCode] as const,
  },
  debates: {
    leaderboard: (periodKey: string) => ["debates", "leaderboard", periodKey] as const,
    partyMetrics: (periodKey: string) => ["debates", "party-metrics", periodKey] as const,
    topicLeaders: (periodKey: string) => ["debates", "topic-leaders", periodKey] as const,
    alerts: (periodKey: string) => ["debates", "alerts", periodKey] as const,
    weekly: (periodKey: string) => ["debates", "weekly", periodKey] as const,
    history: (tdName: string, periodKey: string) =>
      ["debates", "history", tdName, periodKey] as const,
    highlights: (periodKey: string) => ["debate-highlights", periodKey] as const,
  },
  constituencies: {
    list: () => ["constituencies-list"] as const,
    detail: (name: string) => ["constituency-detail", name] as const,
    profile: (name: string) => ["constituency-profile", name] as const,
    apiList: () => ["/api/constituencies"] as const,
  },
  quiz: {
    history: () => ["/api/quiz-history/all"] as const,
    results: (userId: string | undefined) => ["/api/quiz-results/user", userId] as const,
  },
  personalized: {
    insights: (
      userId: string | undefined,
      constituencyName: string | undefined,
      economicScore: number | undefined,
      socialScore: number | undefined
    ) =>
      [
        "/api/personalized-insights",
        userId,
        constituencyName,
        economicScore,
        socialScore,
      ] as const,
  },
  politicalEvolution: {
    all: () => ["/api/political-evolution"] as const,
  },
  globalSearch: {
    data: (regionCode: string) => ["global-search-data", regionCode] as const,
  },
};
