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
  /**
   * `failures`: days not yet ingested → failed attempts. Data is only complete "through"
   * the earliest of the divisions and debates feeds' dates, and not for these days.
   */
  feeds: Array<{ feed: string; throughDate: string | null; lastRunAt: string; lastResult: string | null; failures: Record<string, number> }>;
}

/** GET /api/parliament/tds/:id */
export interface TdParliamentSummary {
  tdId: number;
  memberSince: string | null;
  isPresiding: boolean;
  /** 0–100, one decimal: votes cast / divisions the TD could vote in. */
  attendancePct: number | null;
  votesCast: number | null;
  /** Divisions the TD could vote in: held while a member, not in the chair, not on documented leave. */
  divisionsEligible: number | null;
  /** Divisions left out because the TD was in the chair (the chair cannot vote). */
  divisionsChaired: number | null;
  /** Divisions left out because of documented leave. */
  divisionsExcused: number | null;
  /** The attendance that scores full marks for this TD: lower for time in government office. */
  attendanceBenchmark: number | null;
  /** Questions the TD asked this term. */
  questionsOral: number | null;
  questionsWritten: number | null;
  /**
   * How many questions score full marks, pro-rated to the time the TD was expected to ask.
   * NULL = not expected to ask (government office or the chair for nearly all the term).
   */
  questionsExpected: number | null;
  /** Every office held in the current Dáil, newest first. */
  officeHistory: TdOfficePeriod[];
  /** Publicly documented leave, newest first. Those days are left out of every count. */
  absences: TdAbsence[];
  /** Distinct Dáil debate sections spoken in, chair speeches excluded. */
  sectionsSpoken: number | null;
  sittingDays: number | null;
  /** Sitting days left out because of documented leave. */
  sittingDaysExcused: number | null;
  speeches: number | null;
  /** Share of this TD's votes that matched their party's majority, 0–100. NULL for independents. */
  partyLinePct: number | null;
  votesAgainstParty: number | null;
  /** Offices held now: Taoiseach, Minister for …, Minister of State …. Empty for most TDs. */
  offices: TdOffice[];
  /** Sittings of the TD's own committees while a member, and how many the roll call lists them at. */
  committeeSittingsEligible: number | null;
  committeeSittingsAttended: number | null;
  /** 0–100, one decimal. NULL below a minimum number of sittings. */
  committeeAttendancePct: number | null;
  /** Bills this TD is named as a sponsor of, this term. */
  /** NULL until the bills feed has run once. */
  billsSponsored: number | null;
}

export interface TdOffice {
  title: string;
  since: string | null;
}

export type OfficeKind = 'cabinet' | 'minister_of_state' | 'ceann_comhairle' | 'leas_cheann_comhairle' | 'other';

export interface TdOfficePeriod {
  title: string;
  type: OfficeKind;
  start: string;
  end: string | null;
}

/** The Register of Members' Interests' nine statutory categories, by number. */
export const INTEREST_CATEGORIES: Record<number, string> = {
  1: 'Occupations',
  2: 'Shares',
  3: 'Directorships',
  4: 'Land and property',
  5: 'Gifts',
  6: 'Property or services supplied',
  7: 'Travel facilities',
  8: 'Remunerated positions',
  9: 'Contracts',
};

/** GET /api/parliament/tds/:id/interests: the newest register that lists the TD. */
export interface TdInterests {
  /** The year the register covers. */
  year: number;
  sourceUrl: string;
  /** All nine categories. NULL = declared nothing. */
  categories: Array<{ number: number; declared: string | null }>;
}

/** GET /api/parliament/tds/:id/allowances: Parliamentary Standard Allowance payments. */
export interface TdAllowances {
  /** The first and last month published, first days. */
  from: string;
  to: string;
  /** Months in that range the Oireachtas has not published (not the same as "not paid"). */
  unpublishedMonths: string[];
  totalCents: number;
  /** Newest first. A published month with no row was not paid to this TD. */
  months: Array<{ month: string; amountCents: number }>;
}

export type AbsenceKind = 'parental_leave' | 'medical_leave' | 'bereavement' | 'other_leave';

export interface TdAbsence {
  from: string;
  /** NULL while ongoing. */
  to: string | null;
  reason: AbsenceKind;
  sourceUrl: string;
}

/** GET /api/parliament/tds/:id/committees */
export interface TdCommittee {
  committeeId: string;
  name: string;
  committeeType: string | null;
  /** "Cathaoirleach" (chair), "Leas-Chathaoirleach" (vice-chair) or NULL. */
  role: string | null;
  start: string;
  end: string | null;
  sittingsEligible: number;
  sittingsAttended: number;
}

/** GET /api/parliament/tds/:id/question-topics — who the TD's questions went to, this term. */
export interface TdQuestionTopic {
  department: string;
  oral: number;
  written: number;
}

/** GET /api/parliament/bills?status=&source=&limit=&offset=  (meta: { total }) */
export interface BillSummary {
  id: string;
  shortTitle: string;
  /** "Government" | "Private Member". */
  source: string;
  status: string;
  mostRecentStage: string | null;
  /** "27/2026" once enacted. */
  act: string | null;
  lastUpdated: string | null;
  /** Sponsor names or offices, primary sponsor first. */
  sponsors: string[];
}

/** GET /api/parliament/tds/:id/bills */
export interface TdBill extends BillSummary {
  isPrimary: boolean;
}

/** GET /api/parliament/bills/:id */
export interface BillDetail extends BillSummary {
  uri: string;
  longTitle: string | null;
  originHouse: string | null;
  latestVersionPdf: string | null;
  memoPdf: string | null;
  sponsorList: Array<{ label: string; memberCode: string | null; tdId: number | null; name: string | null; party: string | null; isPrimary: boolean }>;
  stages: Array<{ stage: string; chamber: string | null; date: string | null }>;
  debates: Array<{ debateSectionId: string; date: string; chamber: string | null; title: string | null }>;
  /** Dáil divisions held in this bill's debates; open one for how every TD voted. */
  divisions: DivisionSummary[];
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

export const LEADERBOARD_METRICS = ['attendance', 'participation', 'questions', 'committees'] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];

/** GET /api/parliament/leaderboard?metric=&order=desc|asc&limit= */
export interface LeaderboardEntry {
  tdId: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  /** attendance: %; participation: sections spoken per 10 sitting days; questions: oral + written; committees: committee attendance %. */
  value: number;
}

/** GET /api/parliament/parties */
export interface PartyParliamentSummary {
  party: string;
  members: number;
  avgAttendancePct: number | null;
  partyLinePct: number | null;
  avgSectionsSpoken: number | null;
  avgCommitteeAttendancePct: number | null;
}
