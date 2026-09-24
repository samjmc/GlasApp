/**
 * The seam to the ideology domain (`server/ideology`), which owns a user's profile and
 * computes it from quiz answers plus `listUserVoteVectors()`.
 */
export { getIdeologyProfile, recomputeProfile } from '../ideology';
