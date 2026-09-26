/**
 * Ideology: where users, TDs and parties sit on the eight dimensions. The only public
 * surface; everything else in this folder is internal.
 *
 *   recomputeProfile / getIdeologyProfile   users (called by voting and the quiz)
 *   recordTdEvidence                        a stance by a TD (verified news stances, debates)
 *   matchesFor / userMatches                TDs and parties closest to a position / to a signed-in user
 *   recalculateAll                          rebuild every profile, no model calls
 */
export {
  deleteTdEvidence,
  getIdeologyProfile,
  matchesFor,
  partyProfile,
  recalculateAll,
  recomputeProfile,
  recordTdEvidence,
  tdProfile,
  unknownTdCount,
  userMatches,
  userTimeline,
  type PartyMatch,
  type RecalculateSummary,
  type RecordResult,
  type TdEvidenceInput,
  type TdMatch,
  type TimelinePoint,
} from './service';
export { alignment, type DimensionWeights } from './alignment';
