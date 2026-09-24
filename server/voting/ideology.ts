/**
 * The seam to the ideology domain (the quiz/ideology rebuild, `server/ideology`).
 *
 * That domain owns a user's ideology profile and computes it from quiz answers plus
 * `listUserVoteVectors()`. Voting only asks it two things. Until `server/ideology` merges,
 * the profile is unknown and recompute does nothing: votes are still recorded, and the
 * completion summary shows which way today's answers leaned instead of a before/after.
 *
 * When it merges, replace these two bodies with re-exports from '../ideology'.
 * Nothing else in server/voting changes.
 */
import type { IdeologyDimension } from '../constants/ideology';

export async function getIdeologyProfile(_userId: string): Promise<Record<IdeologyDimension, number> | null> {
  return null;
}

export async function recomputeProfile(_userId: string): Promise<void> {}
