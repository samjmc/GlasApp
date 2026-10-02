/**
 * Response shapes of the ideology match and profile endpoints (server/routes/ideology.ts), and
 * how much evidence stands behind a position. Shared so the client and the server cannot drift.
 *
 * Type-only imports: nothing here may pull drizzle into the client bundle.
 */
import type { IdeologyDimension, IdeologyVector } from './ideology';
import type { AbstainReason, Election } from './partyQuiz';
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
  /** The party's approved manifesto answers, blended into what it is matched on. null = none yet. */
  manifesto: PartyManifesto | null;
}

/**
 * A party's position from its approved manifesto answers (server/partyQuiz/position), scored by
 * the same scoreQuiz as users.
 */
export interface ManifestoPosition {
  vector: IdeologyVector;
  /** Per dimension, approved answered items ÷ bank questions on it, 0..1: its weight in the blend. */
  coverage: IdeologyVector;
  answeredCount: number;
  /** Questions in the bank: the denominator of coverage. */
  askedCount: number;
}

export type PartyManifesto = Pick<ManifestoPosition, 'coverage' | 'answeredCount'>;

/** GET /api/ideology/party/:name, and the party compared on the timeline. */
export interface PartyIdeology {
  party: string;
  /** What the party is matched on: per dimension c·m + (1−c)·tdMean, c = the manifesto's coverage. */
  vector: IdeologyVector;
  /** The stored party row: the weighted mean of its TDs' profiles. */
  tdMean: IdeologyVector;
  tdCount: number;
  computedAt: string;
  hasPartyBaseline: boolean;
  /** Dimensions with a position: all with a baseline, else its TDs' evidence plus the manifesto's. */
  measured: IdeologyDimension[];
  manifesto: PartyManifesto | null;
}

/** A quote from a manifesto, linked to its page. */
export interface ManifestoCitation {
  /** Registry slug. */
  document: string;
  title: string;
  url: string | null;
  /** The page ordinal in a PDF; null for an HTML document. */
  pdfPage: number | null;
  /** The page as printed on it, else its ordinal. */
  page: string;
  /** The document at the quote (`#page=` for a PDF, a text fragment for HTML); null with no url. */
  href: string | null;
  quote: string;
}

/** One party's reviewed answer to one quiz question. Only approved, current items are served. */
export interface PartyQuizAnswer {
  party: string;
  questionId: number;
  /** false = an approved abstention: the manifesto takes no position the answers can express. */
  answered: boolean;
  answerIndex: number | null;
  value: number | null;
  rationale: string;
  abstainReason: AbstainReason | null;
  modelConfidence: number;
  citations: ManifestoCitation[];
}

/** GET /api/ideology/party/:name/answers */
export interface PartyAnswers {
  party: string;
  election: Election;
  documents: { slug: string; title: string; url: string | null }[];
  position: ManifestoPosition | null;
  /** Items still waiting for review; never served. */
  pendingCount: number;
  answers: PartyQuizAnswer[];
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
