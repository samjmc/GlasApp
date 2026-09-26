/**
 * TD scoring. The only public surface; everything else in this folder is internal.
 *
 *   recalculateAll()   derived scores and ranks from the Oireachtas facts
 *   repository         reads for the API
 */
export { recalculateAll, type RecalculateSummary } from './recalculate';
export * as repository from './repository';
export { scoreLabel, PILLAR_WEIGHTS } from './weights';
export { questionsAsked, scoredComponents } from './rollup';
export { computePartyScores } from './party';
