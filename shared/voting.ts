/**
 * Voting: the one contract between the server and the client.
 *
 * A policy question is made from one news article. Each option carries a position on the
 * eight ideology axes, so a vote needs no interpretation: choosing an option IS the signal.
 * There is no 1–5 slider. A rating only acquired an ideology meaning through keyword
 * guessing, so it was removed rather than ported.
 */

/** Option keys, in display order. A question has three or four. */
export const OPTION_KEYS = ['option_a', 'option_b', 'option_c', 'option_d'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

/** Where a vote was cast. One table holds both; this says which surface wrote it. */
export const VOTE_SOURCES = ['daily_session', 'article'] as const;
export type VoteSource = (typeof VOTE_SOURCES)[number];

export const SESSION_STATUSES = ['pending', 'completed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** Questions offered per daily session. Fewer when fewer exist. */
export const DAILY_ITEM_COUNT = 3;

export type ShiftDirection = 'left' | 'right' | 'neutral';

/** A question as the article card shows it. */
export interface ArticleQuestion {
  id: number;
  question: string;
  options: Record<string, string>;
  domain: string;
  topic: string;
}

/** Vote counts per option, for one question. */
export interface QuestionTally {
  total: number;
  byOption: Record<string, number>;
}

export interface DailySessionItem {
  sessionItemId: number;
  questionId: number;
  articleId: number;
  headline: string;
  summary: string;
  prompt: string;
  answerOptions: Record<string, string>;
  /** The axis the question was designed to reveal, when the model named one. */
  policyDimension: string | null;
  contextNote: string;
  orderIndex: number;
  hasVoted: boolean;
  selectedOption: string | null;
  articleUrl: string | null;
  imageUrl: string | null;
}

export interface DailySessionDimensionShift {
  ideologyDimension: string;
  axisLabel: string;
  /**
   * Today's movement on this axis, in the profile's −10..+10 units. A shift exists only
   * when the ideology domain reported a profile both before and after the session.
   */
  delta: number;
  deltaPercent: number;
  before: number;
  after: number;
  direction: ShiftDirection;
}

export interface DailySessionCompletion {
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: ShiftDirection;
  regionSummary: string;
  regionDimension?: string;
  regionPreviousRank?: number;
  regionCurrentRank?: number;
  streakCount: number;
  dimensionShifts: DailySessionDimensionShift[];
  detailStats: Array<{ label: string; value: string; emoji?: string }>;
}

export interface DailySessionState {
  status: SessionStatus;
  sessionId: number;
  sessionDate: string;
  voteCount: number;
  streakCount: number;
  items: DailySessionItem[];
  completion?: DailySessionCompletion;
}

