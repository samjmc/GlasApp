/**
 * TD stances: what a TD said in a news article, with a quote that code checked against the
 * article text (docs/plans/td-stances.md). Response shapes of GET /api/stances/td/:id and of
 * the `issues` field on a signed-in user's TD matches. Shared so the client and the server
 * cannot drift.
 */

/** Direct = the TD's own words in quotation marks; paraphrase = a reporter's attribution. */
export const NEWS_QUOTE_KINDS = ['direct', 'paraphrase'] as const;
export type NewsQuoteKind = (typeof NEWS_QUOTE_KINDS)[number];
/**
 * The news kinds, plus `division`: the TD's recorded Dáil vote. Its quote is the text of the
 * proposal that was voted on, not the TD's words (docs/plans/quiz-improvements/01c).
 */
export const QUOTE_KINDS = [...NEWS_QUOTE_KINDS, 'division'] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number];

/** How a TD voted on a division stance. Staon (abstain) and absence never give one. */
export const STANCE_VOTES = ['ta', 'nil'] as const;
export type StanceVote = (typeof STANCE_VOTES)[number];

/**
 * Whether a vote was the TD's own: `free` (no party prior, a tied or split party), `rebel`
 * (against the party majority), or `whip` (with it). Only free and rebel votes move a profile.
 */
export const DISCIPLINES = ['free', 'rebel', 'whip'] as const;
export type Discipline = (typeof DISCIPLINES)[number];

/** One stance on a TD's page. */
export interface TdStanceRecord {
  id: number;
  quote: string;
  quoteKind: QuoteKind;
  /** On a Dáil vote, how the TD voted; NULL for a news quote. */
  divisionVote: StanceVote | null;
  /** The outlet that published the article. */
  outlet: string;
  url: string;
  headline: string;
  /** ISO timestamp: when the article was published. */
  statedAt: string;
  /** The article's daily-vote question, when the quote states one of its answers; else NULL. */
  questionId: number | null;
  /** That answer, as worded when it was matched. NULL = no clear answer, or no question. */
  optionText: string | null;
  /**
   * Stances of the same group (news quotes, or Dáil votes) this TD has on record on the same
   * question, this one included.
   */
  saidCount: number;
  /** News quotes only: the TD's latest quoted answer on this question differs from an earlier one. */
  changedPosition: boolean;
  /**
   * Dáil votes only: the TD's latest quoted answer on this question, when it differs from the
   * answer this vote matched; else NULL.
   */
  saidOption: string | null;
}

export interface TdStanceDomain {
  /** A POLICY_DOMAINS key, e.g. `foreign_policy`. */
  domain: string;
  /** Newest first. */
  stances: TdStanceRecord[];
}

/** GET /api/stances/td/:id */
export interface TdStances {
  tdId: number;
  domains: TdStanceDomain[];
}

/** One daily-vote question that both the signed-in user and the TD have answered. */
export interface SharedIssue {
  questionId: number;
  question: string;
  domain: string;
  /** The user's answer. */
  yours: string;
  /** The TD's answer, as worded when it was matched. */
  theirs: string;
  agrees: boolean;
  quote: string;
  quoteKind: QuoteKind;
  /** On a Dáil vote, how the TD voted; NULL for a news quote. */
  divisionVote: StanceVote | null;
  outlet: string;
  url: string;
  statedAt: string;
}

/** On a signed-in user's TD match. `items` is filled only for the TD asked about and the top 5. */
export interface TdIssues {
  agree: number;
  disagree: number;
  items: SharedIssue[];
}
