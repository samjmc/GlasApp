/**
 * Response shapes of the ideology match and profile endpoints (server/routes/ideology.ts), and
 * how much evidence stands behind a position. Shared so the client and the server cannot drift.
 *
 * Type-only imports: nothing here may pull drizzle into the client bundle.
 */
import type { IdeologyDimension, IdeologyVector } from './ideology';
import type { EvidenceSource } from './schema/quiz';
import type { TdIssues } from './stancesApi';

/** How much of a position is the subject's own evidence (the party prior never counts). */
export type Confidence = 'none' | 'low' | 'medium' | 'high';

/** Own evidence equal to one party prior (PARTY_PRIOR_WEIGHT). */
export const CONFIDENCE_MEDIUM_AT = 3;
/** As much as one full quiz (QUIZ_WEIGHT). */
export const CONFIDENCE_HIGH_AT = 10;

/** `weight` = decayed evidence weight, prior excluded: a profile's totalWeight or one dimension's support. */
export function confidenceOf(weight: number): Confidence {
  if (!(weight > 0)) return 'none';
  if (weight < CONFIDENCE_MEDIUM_AT) return 'low';
  if (weight < CONFIDENCE_HIGH_AT) return 'medium';
  return 'high';
}

/** Evidence rows per source. A missing source = none. */
export type EvidenceCounts = Partial<Record<EvidenceSource, number>>;

export interface TdMatch {
  tdId: number;
  name: string;
  party: string | null;
  constituency: string | null;
  imageUrl: string | null;
  alignment: number;
  evidenceCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
  /** Signed-in matches only: the daily-vote questions both the user and this TD answered. */
  issues?: TdIssues;
  /** The TD's OWN record, from its total evidence weight. 'none' = the match is the party position. */
  confidence: Confidence;
  evidenceBySource: EvidenceCounts;
  /** Dimensions the TD has own evidence on. */
  measured: IdeologyDimension[];
  hasPartyBaseline: boolean;
}

export interface PartyMatch {
  party: string;
  alignment: number;
  tdCount: number;
  closest: IdeologyDimension[];
  furthest: IdeologyDimension[];
  /** From the evidence weight of the party's TDs, never from its TD count. */
  confidence: Confidence;
  hasPartyBaseline: boolean;
}

export interface Matches {
  tds: TdMatch[];
  parties: PartyMatch[];
}

export interface DimensionConfidence {
  level: Confidence;
  /** Answers on this dimension in the latest quiz. */
  quizAnswers: number;
  /** Daily votes that say something about this dimension. */
  votes: number;
}

/** GET /api/ideology/me */
export interface UserIdeologyDetail {
  vector: IdeologyVector;
  confidence: Record<IdeologyDimension, DimensionConfidence>;
}

/** GET /api/ideology/td/:id */
export interface TdIdeology {
  td: { id: number; name: string; party: string | null; constituency: string | null; imageUrl: string | null };
  hasPartyBaseline: boolean;
  profile: {
    vector: IdeologyVector;
    totalWeight: number;
    evidenceCount: number;
    computedAt: string;
    confidence: Confidence;
    evidenceBySource: EvidenceCounts;
    measured: IdeologyDimension[];
  } | null;
}
