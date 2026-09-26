/**
 * Oireachtas data: Dáil divisions, debates, questions and attendance.
 * The only public surface; everything else in this folder is internal.
 *
 *   runSync()     ingest everything new, recompute the counts, feed scoring
 *   repository    reads for the API and other areas (votesOf: "TD X voted Y on division Z")
 *   client        api.oireachtas.ie, for the roster (sync-tds, historical baselines)
 */
export { isSyncRunning, runSync, rosterToSeeds, SyncAlreadyRunning, syncHadFailures, type SyncOptions, type SyncSummary } from './sync';
export { OireachtasClient, type RosterMember } from './client';
export { debateScores } from './metrics';
export * as repository from './repository';
export type { DivisionContext, DivisionVoteRecord } from './repo/divisions';
