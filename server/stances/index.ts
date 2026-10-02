/**
 * TD stances (docs/plans/td-stances.md): what a TD said in a news article, with a quote checked
 * against the text, matched to an answer of the article's own daily-vote question.
 *
 *   recordStances   the news pipeline and the rebuild job: extract → verify → map → save → evidence
 *
 * server/ideology reads `repository.mappedStancesOn` and `agreement.ts` directly rather than
 * through this file, because record.ts imports server/ideology and the two would form a cycle.
 * The HTTP router is imported from ./routes by server/routes.ts.
 */
export { emptyStanceStats, recordStances, toCandidate, type RecordDeps, type StanceStats } from './record';
export { rebuildArticles, type RebuildArticle } from './repository';
