/**
 * TD scoring. The only public surface; everything else in this folder is internal.
 *
 *   runPipeline()      score new articles, then recalculate
 *   recalculateAll()   derived scores, ranks, trends, party aggregates
 *   repository         reads for the API
 */
export { runPipeline, scoreArticleById, type PipelineOptions, type PipelineStats } from './pipeline';
export { recalculateAll, type RecalculateSummary } from './recalculate';
export * as repository from './repository';
export { eloToPercent, scoreLabel, PILLAR_WEIGHTS } from './weights';
export { DIMENSIONS, type Dimension } from './elo';
