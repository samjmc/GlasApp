/**
 * Ideology: where users, TDs and parties sit on the eight dimensions. The only public
 * surface; everything else in this folder is internal.
 *
 *   recomputeProfile / getIdeologyProfile   users (called by voting and the quiz)
 *   recordTdEvidence                        a stance by a TD (scoring panel, debates)
 *   matchesFor                              TDs and parties closest to a position
 *   recalculateAll                          rebuild every profile, no model calls
 */
export {
  getIdeologyProfile,
  matchesFor,
  partyProfile,
  recalculateAll,
  recomputeProfile,
  recordTdEvidence,
  tdProfile,
  unknownTdCount,
  userTimeline,
  type PartyMatch,
  type RecalculateSummary,
  type RecordResult,
  type TdEvidenceInput,
  type TdMatch,
  type TimelinePoint,
} from './service';
export { alignment, type DimensionWeights } from './alignment';
