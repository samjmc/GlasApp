/**
 * Response shapes of /api/scores. Every response is `{ success, data, meta? }`; these are the
 * `data` types. Shared so the client and the router cannot drift.
 *
 * The score is built only from facts in the Oireachtas record (docs/scoring.md). NULL always
 * means "not expected / not measurable", never zero.
 */

export type ScoreLabel = 'Excellent' | 'Good' | 'Average' | 'Below Average' | 'Poor';

/** The four measured components, each in its own unit. */
export interface ScoreComponents {
  /** Oral + written questions asked this term. */
  questions: number | null;
  /** Dáil votes cast ÷ divisions held while a member, 0–100. */
  attendance: number | null;
  /** Committee sittings attended ÷ sittings held while a member, 0–100. */
  committees: number | null;
  /** Debate sections spoken in per sitting day, relative to the 75th percentile of TDs, 0–100. */
  debate: number | null;
}

/** The two weighted pillars the overall score is made of, 0–100. */
export interface ScorePillars {
  /** Questions, Dáil votes and committees. */
  parliamentary: number | null;
  debate: number | null;
}

/** The shape every list and card in the client works from. */
export interface TdCard {
  id: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  gender: string | null;
  /** Holds the chair (Ceann Comhairle): every component is NULL, so the TD is unranked. */
  isPresiding: boolean;
  components: ScoreComponents;
  pillars: ScorePillars;
  /** 0–100. NULL, with no rank, when fewer than 2 components are measurable. */
  overallScore: number | null;
  label: ScoreLabel | null;
  /** Shared on ties: 1, 2, 2, 4. */
  nationalRank: number | null;
  partyRank: number | null;
  constituencyRank: number | null;
  /** ISO timestamp of the last recalculation that wrote this TD's score. */
  computedAt: string | null;
}

/** Every key of `TdCard`; the router test asserts the card has exactly these. */
export const TD_CARD_FIELDS = [
  'id',
  'name',
  'party',
  'constituency',
  'imageUrl',
  'gender',
  'isPresiding',
  'components',
  'pillars',
  'overallScore',
  'label',
  'nationalRank',
  'partyRank',
  'constituencyRank',
  'computedAt',
] as const satisfies ReadonlyArray<keyof TdCard>;

/** GET /api/scores/tds  (meta: { count, researchedCount }) */
export interface TdListItem extends TdCard {
  hasResearch: boolean;
}

/** GET /api/scores/widget */
export interface ScoresWidget {
  top: TdCard[];
  bottom: TdCard[];
  stats: {
    totalTds: number;
    /** TDs with an overall score, and so a rank. */
    rankedTds: number;
    /** The most recent `computedAt` of any TD. */
    computedAt: string | null;
  };
}

/**
 * The Oireachtas record the components are measured from, as raw counts inside the TD's
 * current membership. NULL = not synced yet.
 */
export interface TdFacts {
  memberSince: string | null;
  votes: { cast: number | null; divisionsEligible: number | null };
  questions: { oral: number | null; written: number | null };
  committees: { sittingsAttended: number | null; sittingsEligible: number | null };
  debate: { sectionsSpoken: number | null; sittingDays: number | null };
  /** The TD's page on oireachtas.ie, where every count can be checked. */
  recordUrl: string | null;
}

/** GET /api/scores/td/:name */
export interface TdProfile extends TdCard {
  memberCode: string | null;
  bio: string | null;
  offices: Array<{ title: string; since?: string }>;
  committees: string[];
  facts: TdFacts;
  baseline: {
    summary: string | null;
    category: string | null;
    confidence: number | null;
    keyFindings: string[];
    researchDate: string | null;
  } | null;
}

/** GET /api/scores/td/:id/summary */
export interface TdSummary extends TdCard {
  officeCount: number;
  committeeCount: number;
  topOffice: string | null;
  topCommittee: string | null;
}

/** GET /api/scores/parties  (meta: { count }) */
export interface PartyScoreRow {
  /** Shared on ties; NULL when no member is ranked. */
  rank: number | null;
  party: string;
  /** Active TDs in the party. */
  memberCount: number;
  /** Members with an overall score: the ones the mean is taken over. */
  rankedCount: number;
  /** Mean of ranked members' overall scores, 0–100. */
  overallScore: number | null;
  label: ScoreLabel | null;
}

/** GET /api/scores/party/:name */
export interface PartyDetail {
  party: string;
  size: number;
  /** Mean of ranked members' overall scores. */
  averageScore: number | null;
  genderBreakdown: { male: number; female: number; unknown: number; femalePercentage: number };
  constituencyCount: number;
  members: TdCard[];
}
