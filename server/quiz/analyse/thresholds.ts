/**
 * Every gate and flag threshold of the item analysis, with its unit. All gates are reached at
 * about 200 users: each question is base for about half of them, each pair of questions on a
 * dimension for about a fifth (shared/quizPlan.ts, 6 questions per dimension, 3 in the base).
 * Re-tune after the first real report with ≥ 200 users, and write down what they were measured on.
 */
export const MIN_BASE_EXPOSURES_ITEM = 100; // per question, base exposures
export const MIN_PAIR_COEXPOSURES = 30; // per question pair, respondents with both as base
export const MIN_PAIRS_PER_ITEM = 2; // legacy dims have only 2 partners per item
export const MIN_USERS_DIMENSION_CORR = 100; // included respondents
export const MIN_REPORT_CELL = 10; // privacy: smaller cells print "<10"
export const DOMINANT_SHARE = 0.7;
export const WEAK_ITEM_R = 0.1;
export const LOW_ALPHA = 0.6;
export const ONE_CONSTRUCT_R = 0.9;
