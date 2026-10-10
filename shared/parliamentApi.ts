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
  /** False while some months of questions are not loaded: the counts are then a lower bound. */
  questionsComplete: boolean;
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

/** 'party_leader' is not an Oireachtas office: it comes from server/parliament/partyLeaders.ts. */
export type OfficeKind = 'cabinet' | 'minister_of_state' | 'ceann_comhairle' | 'leas_cheann_comhairle' | 'party_leader' | 'other';

export interface TdOfficePeriod {
  title: string;
  type: OfficeKind;
  start: string;
  end: string | null;
  /** The public source, for a party leadership. */
  sourceUrl?: string;
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
  /**
   * Published months with no row for this TD whose file had a name that matched nobody: that
   * name could be this TD, so these are not "not paid".
   */
  uncertainMonths: string[];
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

/** A news article that may explain a silence. A pointer for the reviewer, never a reason. */
export interface LeaveHintView {
  title: string;
  url: string;
  publishedAt: string;
}

export type LeaveAlertState = 'open' | 'confirmed' | 'dismissed' | 'closed';

/** GET /api/parliament/admin/leave-alerts: a run of sitting days with no vote and no speech. */
export interface LeaveAlertView {
  id: number;
  memberCode: string;
  tdId: number | null;
  name: string;
  party: string | null;
  from: string;
  to: string;
  sittingDays: number;
  status: LeaveAlertState;
  hints: LeaveHintView[];
  firstSeenAt: string;
  resolvedAt: string | null;
  /** An admin's email, or "watch" when the weekly job closed it itself. */
  resolvedBy: string | null;
  resolutionNote: string | null;
}

/** POST /api/parliament/admin/leave-alerts/:id/confirm. The source is required, never inferred. */
export interface ConfirmLeaveInput {
  reason: AbsenceKind;
  from: string;
  /** NULL while the leave is ongoing. */
  to: string | null;
  sourceUrl: string;
  /** What the source says, with no medical detail. */
  note: string | null;
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
  /** The debate this section belongs to (several sections when it ran over days); NULL before grouping. */
  debateId: string | null;
}

// ---------------------------------------------------------------------------
// Debate record (docs/plans/debate-analysis.md, Steps 4–5). Code gives every point from the
// published rules; the model only found and quoted the items. Not part of the TD score.
// ---------------------------------------------------------------------------
export type DebateItemShown = 'specific_claim' | 'concession' | 'response' | 'question' | 'commitment';

export interface DebateItemView {
  kind: DebateItemShown;
  /** A specific claim: what makes it specific. */
  claimType: 'figure' | 'named_source' | 'cost' | 'date' | null;
  /** The words as spoken. For a reply, the reply's own words (they name the point taken up). */
  quote: string;
  /** Who said it. */
  speaker: string;
  /** A concession or a reply: who it was made to. */
  to: string | null;
  /** A concession: whether it crosses the House, so scores. */
  crossesHouse: boolean;
  /** A reply: why it scores nothing (same party, or the closing speech), or null when it scores. */
  replyNoPoints: 'same_party' | 'closing_speech' | null;
  /** A question: who it was put to, as said. */
  addressee: string | null;
  /** A commitment: the time given, as said. */
  due: string | null;
}

export interface DebateRecordParticipant {
  memberCode: string;
  tdId: number | null;
  name: string;
  party: string | null;
  role: 'office' | 'backbench';
  speeches: number;
  words: number;
  claims: number;
  claimPoints: number;
  concessionsReceived: number;
  concessionPoints: number;
  replies: number;
  /** Distinct speakers from another party who took up this member's point by name. */
  takenUp: number;
  takenUpPoints: number;
  questions: number;
  commitments: number;
  points: number;
  /** What this member said (claims, questions, commitments, concessions and replies they made). */
  items: DebateItemView[];
}

/** GET /api/parliament/debate-records/:debateId. NULL data when the debate has not been read. */
export interface DebateRecordView {
  debateId: string;
  title: string;
  kind: string;
  firstDate: string;
  lastDate: string;
  rulesVersion: string;
  /** Most points first. */
  participants: DebateRecordParticipant[];
}

/** GET /api/parliament/tds/:id/debate-record. NULL data when the TD took part in no debate read yet. */
export interface TdDebateRecord {
  rulesVersion: string;
  /** The role the figure is for: the one the TD spoke in most debates in. */
  role: 'office' | 'backbench';
  debates: number;
  points: number;
  /** NULL below `minDebates` debates in that role. */
  pointsPerDebate: number | null;
  /** The 75th percentile of TDs in the same role with at least `minDebates` debates. */
  cohortP75: number | null;
  cohortSize: number;
  minDebates: number;
  totals: {
    claims: number;
    claimPoints: number;
    concessionsReceived: number;
    concessionPoints: number;
    replies: number;
    takenUp: number;
    takenUpPoints: number;
    questions: number;
    commitments: number;
  };
  /** The TD's most recent debates read, newest first: what they said, and the concessions and replies made to them. */
  recent: Array<{ debateId: string; title: string; kind: string; date: string; points: number; items: DebateItemView[]; toThem: DebateItemView[] }>;
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
