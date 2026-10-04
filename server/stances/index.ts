/**
 * TD stances (docs/plans/td-stances.md): what a TD said in a news article, with a quote checked
 * against the text, matched to an answer of the article's own daily-vote question; and how a TD
 * voted in the Dáil, when the division matches a daily-vote question (docs/plans/quiz-improvements/01c).
 *
 *   recordStances        the news pipeline and the rebuild job: extract → verify → position check (Jev)
 *                        → map → save → evidence
 *   classifyDivisions    Dáil divisions → readings (model calls; `npm run stances -- --divisions`)
 *   syncDivisionStances  readings × roll call → td_stances, then all stance evidence (no model)
 *   runDivisionStances   the nightly run (scheduler, only when DIVISION_STANCES=on)
 *   runDivisionAudit     the matches against the lobbies' party baselines (no model, no writes)
 *
 * server/ideology reads `repository.mappedStancesOn` and `agreement.ts` directly rather than
 * through this file, because record.ts imports server/ideology and the two would form a cycle.
 * The HTTP router is imported from ./routes by server/routes.ts.
 */
export { emptyStanceStats, recordStances, toCandidate, type RecordDeps, type StanceStats } from './record';
export { isJevConfigured, positionProbability } from './position';
export { rebuildArticles, type RebuildArticle } from './repository';
export type { ClassifySummary, DivisionAudit, DivisionReading, MatchedForReview, StanceSyncSummary } from './divisions';

// The division modes load on first use: they read the parliament tables, which the news
// pipeline (this file's other importer) never needs. DivisionStancesAlreadyRunning is in ./divisions.
type Divisions = typeof import('./divisions');
export const classifyDivisions: Divisions['classifyDivisions'] = async (options) => (await import('./divisions')).classifyDivisions(options);
export const syncDivisionStances: Divisions['syncDivisionStances'] = async (now) => (await import('./divisions')).syncDivisionStances(now);
export const runDivisionStances: Divisions['runDivisionStances'] = async (options) => (await import('./divisions')).runDivisionStances(options);
export const runDivisionAudit: Divisions['runDivisionAudit'] = async () => (await import('./divisions')).runDivisionAudit();
