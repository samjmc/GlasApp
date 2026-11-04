/**
 * Central query-key factory. The first element of a key is the API path or a stable namespace,
 * so `invalidateQueries` on that prefix reaches every variant.
 */
export const queryKeys = {
  td: {
    scoresWidget: () => ["td-scores-widget-v3"] as const,
    quickInfo: (tdId: number) => ["td-quick-info", tdId] as const,
    /** GET /api/scores/td/:name. v4: the score is built from Oireachtas facts only. */
    profile: (name: string | undefined) => ["td-profile-v4", name] as const,
    rankings: () => ["td-rankings"] as const,
    news: (name: string) => ["td-news-v3", name] as const,
    /** GET /api/stances/td/:id */
    stances: (tdId: number) => ["/api/stances/td", tdId] as const,
  },
  party: {
    /** GET /api/scores/party/:name plus its row from /api/scores/parties. */
    profile: (name: string | undefined) => ["party-profile-v2", name] as const,
  },
  constituency: {
    summary: () => ["constituencies-summary"] as const,
    /** The map's side panel and the constituency page read the same endpoint under their own keys. */
    detail: (name: string | null) => ["constituency-detail", name] as const,
    profile: (name: string | undefined) => ["constituency-profile", name] as const,
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
    tdInterests: (tdId: number) => ["parliament-td-interests", tdId] as const,
    tdAllowances: (tdId: number) => ["parliament-td-allowances", tdId] as const,
    tdDebateRecord: (tdId: number) => ["parliament-td-debate-record", tdId] as const,
    debateRecord: (debateId: string) => ["parliament-debate-record", debateId] as const,
    tdQuestionRecord: (tdId: number) => ["parliament-td-question-record", tdId] as const,
    questionRecord: (sectionId: string) => ["parliament-question-record", sectionId] as const,
    bills: (status: string, source: string, limit: number, offset: number) =>
      ["parliament-bills", status, source, limit, offset] as const,
    bill: (id: string) => ["parliament-bill", id] as const,
  },
  quiz: {
    all: () => ["/api/quiz/me"] as const,
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
    /** Same endpoint with `?td=`, so that TD's shared-issue items are filled. */
    myMatchesForTd: (userId: string | undefined, tdId: number) =>
      ["/api/ideology", "me", userId, "matches", null, "td", tdId] as const,
    vectorMatches: (vector: unknown, weights: unknown) =>
      ["/api/ideology", "matches", vector, weights] as const,
    /** GET /api/ideology/td/:id */
    td: (tdId: number) => ["/api/ideology", "td", tdId] as const,
    /** GET /api/ideology/party/:name and its /answers */
    party: (name: string) => ["/api/ideology", "party", name] as const,
  },
  globalSearch: {
    data: (regionCode: string) => ["global-search-data", regionCode] as const,
  },
  pledges: {
    all: () => ["/api/pledges"] as const,
    /** GET /api/pledges?party= */
    list: (party: string) => ["/api/pledges", "party", party] as const,
    /** GET /api/pledges/:id, with its evidence. */
    detail: (id: number) => ["/api/pledges", id] as const,
    /** GET /api/pledges/priorities: `mine` is the caller's ranking, so it is scoped by user. */
    priorities: (userId: string | undefined) => ["/api/pledges/priorities", userId] as const,
    partiesAll: () => ["/api/pledges/parties"] as const,
    /** GET /api/pledges/parties: the delivery rate is weighted by the caller's ranking, so scoped by user. */
    parties: (userId: string | undefined) => ["/api/pledges/parties", userId] as const,
  },
  leaveWatch: {
    all: () => ["/api/parliament/admin/leave-alerts"] as const,
    list: (scope: "open" | "all") => ["/api/parliament/admin/leave-alerts", scope] as const,
  },
  /** GET /api/daily-session: the signed-in user's own session. */
  dailySession: (regionCode: string | null, userId: string | undefined) =>
    ["daily-session-state", regionCode, userId] as const,
  /** Every region's and user's daily session, for invalidation. */
  dailySessionAll: () => ["daily-session-state"] as const,
  votes: {
    /** GET /api/votes/articles/:id: the tally and, signed in, the caller's own answer. */
    article: (articleId: number, userId: string | undefined) => ["/api/votes/articles", articleId, userId] as const,
  },
};

/**
 * What a saved vote makes stale. Every vote recomputes the user's ideology (server/voting/service.ts),
 * which moves their position, timeline and matches. An article vote also answers that question in
 * today's session if it is there.
 */
export function keysStaleAfterVote(kind: "daily" | "article") {
  return kind === "article" ? [queryKeys.ideology.all(), queryKeys.dailySessionAll()] : [queryKeys.ideology.all()];
}
