/**
 * Ideology: where users, TDs and parties sit on the eight dimensions. The only public
 * surface; everything else in this folder is internal.
 *
 *   recomputeProfile / getIdeologyProfile   users (called by voting and the quiz)
 *   userIdeologyDetail                      a user's position with its confidence per dimension
 *   matchesFor / userMatches                TDs and parties closest to a position / to a signed-in user
 *   recalculateAll                          rebuild every profile, no model calls
 *   recomputeTdsAndParties                  after the nightly stance rebuild (server/stances/divisions.ts)
 */
export { getIdeologyProfile, recomputeProfile, userIdeologyDetail } from './userProfile';
export { userTimeline, type TimelinePoint } from './timeline';
export { matchesFor, partyProfile, tdProfile, userMatches } from './matches';
export { deleteTdEvidence, recalculateAll, recomputeTdsAndParties, type RecalculateSummary } from './rebuild';
export type { Matches, PartyMatch, TdIdeology, TdMatch, UserIdeologyDetail } from '@shared/ideologyMatch';
export { alignment, type DimensionWeights } from './alignment';
