/**
 * Ideology: where users, TDs and parties sit on the eight dimensions. The only public
 * surface; everything else in this folder is internal.
 *
 *   recomputeProfile / getIdeologyProfile   users (called by voting and the quiz)
 *   userIdeologyDetail                      a user's position with its confidence per dimension
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
  userIdeologyDetail,
  userMatches,
  userTimeline,
  type RecalculateSummary,
  type RecordResult,
  type TdEvidenceInput,
  type TimelinePoint,
} from './service';
export type { Matches, PartyMatch, TdIdeology, TdMatch, UserIdeologyDetail } from '@shared/ideologyMatch';
export { alignment, type DimensionWeights } from './alignment';
