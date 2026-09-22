/**
 * Response shapes of /api/parliament. Every response is `{ success, data, meta? }`;
 * these are the `data` types. Shared so the client and the router cannot drift.
 *
 * NULL always means "not measurable" (no record yet, or the TD holds the chair and does
 * not vote), never zero.
 */
import type { DivisionVote } from './schema/parliament';

export type { DivisionVote };

/** GET /api/parliament/status */
export interface ParliamentStatus {
  feeds: Array<{ feed: string; throughDate: string | null; lastRunAt: string; lastResult: string | null }>;
}

/** GET /api/parliament/tds/:id */
export interface TdParliamentSummary {
  tdId: number;
  memberSince: string | null;
  isPresiding: boolean;
  /** 0–100, one decimal. */
  attendancePct: number | null;
  votesCast: number | null;
  divisionsEligible: number | null;
  questionsOral: number | null;
  questionsWritten: number | null;
  /** Distinct Dáil debate sections spoken in, chair speeches excluded. */
  sectionsSpoken: number | null;
  sittingDays: number | null;
  speeches: number | null;
  /** Share of this TD's votes that matched their party's majority, 0–100. NULL for independents. */
  partyLinePct: number | null;
  votesAgainstParty: number | null;
}

/** GET /api/parliament/tds/:id/votes?limit=&againstParty=true */
export interface TdVote {
  divisionId: string;
  date: string;
  subject: string | null;
  debateTitle: string | null;
  outcome: string | null;
  vote: DivisionVote;
  /** How most of the TD's party voted. NULL for independents or a tie. */
  partyMajority: DivisionVote | null;
  withParty: boolean | null;
}

/** GET /api/parliament/tds/:id/debates?limit= */
export interface TdDebateContribution {
  sectionId: string;
  date: string;
  title: string;
  speeches: number;
  words: number;
  /** First ~300 characters of the TD's first speech in the section. */
  excerpt: string;
}

/** GET /api/parliament/divisions?limit=&offset=  (meta: { total }) */
export interface DivisionSummary {
  id: string;
  date: string;
  subject: string | null;
  debateTitle: string | null;
  outcome: string | null;
  isBill: boolean;
  taCount: number;
  nilCount: number;
  staonCount: number;
}

/** GET /api/parliament/divisions/:id */
export interface DivisionDetail extends DivisionSummary {
  uri: string;
  votes: Array<{ memberCode: string; tdId: number | null; name: string | null; party: string | null; vote: DivisionVote }>;
  byParty: Array<{ party: string; ta: number; nil: number; staon: number }>;
}

/** GET /api/parliament/debates?limit=&offset=  (meta: { total }) */
export interface DebateSectionSummary {
  id: string;
  date: string;
  title: string;
  speechCount: number;
  speakerCount: number;
}

/** GET /api/parliament/debates/:id */
export interface DebateSectionDetail extends DebateSectionSummary {
  speakers: Array<{ tdId: number | null; memberCode: string | null; name: string | null; party: string | null; speeches: number; words: number }>;
}

export const LEADERBOARD_METRICS = ['attendance', 'participation', 'questions'] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

/** GET /api/parliament/leaderboard?metric=&order=desc|asc&limit= */
export interface LeaderboardEntry {
  tdId: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  /** attendance: %; participation: sections spoken per 10 sitting days; questions: oral + written. */
  value: number;
}

/** GET /api/parliament/parties */
export interface PartyParliamentSummary {
  party: string;
  members: number;
  avgAttendancePct: number | null;
  partyLinePct: number | null;
  avgSectionsSpoken: number | null;
}
