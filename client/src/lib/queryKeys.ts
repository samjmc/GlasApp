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
/** Central query-key factory for all React Query cache keys. */
export const queryKeys = {
  td: {
    scoresWidget: () => ["td-scores-widget-v3"] as const,
    quickInfo: (tdId: number) => ["td-quick-info", tdId] as const,
    constituencyScores: (constituency: string) =>
      ["constituency-scores", constituency] as const,
    profile: (name: string) => ["td-profile", name] as const,
    profileV3: (name: string) => ["td-profile-v3", name] as const,
    consistency: (politicianName: string | undefined) =>
      ["td-consistency", politicianName] as const,
    forChat: () => ["tds-for-chat"] as const,
    rankings: () => ["td-rankings"] as const,
    news: (name: string) => ["td-news-v3", name] as const,
  },
  party: {
    rankings: () => ["party-rankings-v4"] as const,
    quickInfo: (partyName: string) => ["party-quick-info", partyName] as const,
    profile: (name: string) => ["party-profile", name] as const,
    tds: (partyName: string) => ["party-tds", partyName] as const,
    polling: (party: string | undefined) => ["party-polling", party] as const,
  },
  news: {
    feed: (sortBy: string, page: number) => ["news-feed-v7", sortBy, page] as const,
    topStoryToday: (regionCode: string | null) =>
      ["top-story-today-v1", regionCode] as const,
  },
  parliament: {
    status: () => ["parliament-status"] as const,
    divisions: (limit: number, offset: number) => ["parliament-divisions", limit, offset] as const,
    division: (id: string) => ["parliament-division", id] as const,
    debates: (limit: number, offset: number) => ["parliament-debates", limit, offset] as const,
    debate: (id: string) => ["parliament-debate", id] as const,
    leaderboard: (metric: string, order: string, limit: number) =>
      ["parliament-leaderboard", metric, order, limit] as const,
    parties: () => ["parliament-parties"] as const,
    tdSummary: (tdId: number) => ["parliament-td-summary", tdId] as const,
    tdVotes: (tdId: number, limit: number, againstParty: boolean) =>
      ["parliament-td-votes", tdId, limit, againstParty] as const,
    tdDebates: (tdId: number, limit: number) => ["parliament-td-debates", tdId, limit] as const,
    tdCommittees: (tdId: number) => ["parliament-td-committees", tdId] as const,
    tdBills: (tdId: number, limit: number) => ["parliament-td-bills", tdId, limit] as const,
    tdQuestionTopics: (tdId: number) => ["parliament-td-question-topics", tdId] as const,
    bills: (status: string, source: string, limit: number, offset: number) =>
      ["parliament-bills", status, source, limit, offset] as const,
    bill: (id: string) => ["parliament-bill", id] as const,
  },
  constituencies: {
    list: () => ["constituencies-list"] as const,
    detail: (name: string) => ["constituency-detail", name] as const,
    profile: (name: string) => ["constituency-profile", name] as const,
    apiList: () => ["/api/constituencies"] as const,
  },
  quiz: {
    /** GET /api/quiz/me — scoped by user so a sign-out/sign-in never shows the last user's rows. */
    mine: (userId: string | undefined) => ["/api/quiz/me", userId] as const,
  },
  ideology: {
    all: () => ["/api/ideology"] as const,
    mine: (userId: string | undefined) => ["/api/ideology", "me", userId] as const,
    timeline: (userId: string | undefined, party: string | null) =>
      ["/api/ideology", "me", userId, "timeline", party] as const,
    myMatches: (userId: string | undefined, weights: unknown) =>
      ["/api/ideology", "me", userId, "matches", weights] as const,
    vectorMatches: (vector: unknown, weights: unknown) =>
      ["/api/ideology", "matches", vector, weights] as const,
  },
  globalSearch: {
    data: (regionCode: string) => ["global-search-data", regionCode] as const,
  },
};
