/**
 * TD stances: what a TD said in a news article, with a quote that code checked against the
 * article text (docs/plans/td-stances.md). Response shapes of GET /api/stances/td/:id and of
 * the `issues` field on a signed-in user's TD matches. Shared so the client and the server
 * cannot drift.
 */

/** Direct = the TD's own words in quotation marks; paraphrase = a reporter's attribution. */
export const QUOTE_KINDS = ['direct', 'paraphrase'] as const;
export type QuoteKind = (typeof QUOTE_KINDS)[number];

/** One stance on a TD's page. */
export interface TdStanceRecord {
  id: number;
  quote: string;
  quoteKind: QuoteKind;
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
  /** Stances this TD has on record on the same question, this one included. */
  saidCount: number;
  /** The TD's latest answer on this question differs from an earlier one. */
  changedPosition: boolean;
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
