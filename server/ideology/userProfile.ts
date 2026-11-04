/**
 * A user's position: computed from their latest quiz and every vote, stored on recompute, and
 * read with its confidence per dimension.
 */
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyDimension } from '@shared/ideology';
import { confidenceOf, type DimensionConfidence, type UserIdeologyDetail } from '@shared/ideologyMatch';
import type { QuizResultRow } from '@shared/schema/quiz';
import { ConsentRequiredError } from '../account/consentError';
import type { Db } from '../db';
import { answeredCountsOf, coverageOf } from '../quiz/score';
import { listUserVoteVectors, type UserVoteVector } from '../voting';
import { computeProfile, type Observation, type Profile } from './model';
import * as repo from './repository';
import { QUIZ_WEIGHT, toObservationVector } from './sources';

export function voteObservation(vote: UserVoteVector): Observation {
  return {
    vector: toObservationVector('vote', vote.vector),
    weight: vote.weight * (vote.confidence ?? 1),
    observedAt: vote.votedAt,
  };
}

/**
 * A quiz speaks only to the dimensions it asked (a 0 elsewhere is "not asked"), and on each
 * one in proportion to how many of that dimension's questions were answered.
 */
export function quizObservation(quiz: QuizResultRow): Observation {
  const coverage = coverageOf(quiz.answers);
  const full = repo.vectorOf(quiz);
  const asked = IDEOLOGY_DIMENSIONS.filter((d) => coverage[d] > 0);
  return {
    vector: Object.fromEntries(asked.map((d) => [d, full[d]])),
    dimensionWeight: Object.fromEntries(asked.map((d) => [d, coverage[d]])),
    weight: QUIZ_WEIGHT,
    observedAt: quiz.createdAt,
  };
}

/** The latest quiz as of `until` (quizzes are newest first) plus every vote up to it. */
function userObservations(quizzes: QuizResultRow[], votes: UserVoteVector[], until: Date): Observation[] {
  const quiz = quizzes.find((q) => q.createdAt <= until);
  const observations = votes.filter((v) => v.votedAt <= until).map(voteObservation);
  if (quiz) observations.push(quizObservation(quiz));
  return observations;
}

export function userProfileOf(quizzes: QuizResultRow[], votes: UserVoteVector[], now: Date): Profile | null {
  const observations = userObservations(quizzes, votes, now);
  if (observations.length === 0) return null;
  return computeProfile(null, observations, { now, halfLifeDays: null });
}

/** A user's position from their latest quiz and every vote. null = no quiz and no votes yet. */
export async function computeUserProfile(userId: string, database?: Pick<Db, 'select'>): Promise<Profile | null> {
  const [quiz, votes] = await Promise.all([repo.latestQuizResult(userId, database), listUserVoteVectors(userId, undefined, database)]);
  return userProfileOf(quiz ? [quiz] : [], votes, new Date());
}

/**
 * Called by voting after each vote and by the quiz after each save. Reads and writes under the
 * user's consent (withPoliticalConsent), so a withdrawal cannot slip in between and leave a profile
 * behind. Without consent there is no basis to keep a profile, so it is deleted, never written.
 * The user's profile lock, taken in the same transaction, makes concurrent recomputes run one
 * after the other, so the last one to write has read every vote committed before it.
 */
export async function recomputeProfile(userId: string): Promise<void> {
  try {
    await repo.withPoliticalConsent(userId, async (tx) => {
      await repo.lockUserProfile(userId, tx);
      const profile = await computeUserProfile(userId, tx);
      if (profile) await repo.upsertProfile('user', userId, profile, tx);
      else await repo.deleteProfile('user', userId, tx);
    });
  } catch (error) {
    if (!(error instanceof ConsentRequiredError)) throw error;
    await repo.deleteProfile('user', userId);
  }
}

export async function getIdeologyProfile(userId: string): Promise<Record<IdeologyDimension, number> | null> {
  const row = await repo.getProfile('user', userId);
  return row ? repo.vectorOf(row) : null;
}

/**
 * The user's position and, per dimension, how much evidence is behind it: the support the model
 * used (rounded, so a full quiz is exactly QUIZ_WEIGHT = high), the latest quiz's answers on it
 * and the votes that speak to it. Computed on read, as userMatches is. null = no quiz, no votes.
 */
export async function userIdeologyDetail(userId: string): Promise<UserIdeologyDetail | null> {
  const now = new Date();
  const [quizzes, votes] = await Promise.all([repo.listQuizResults(userId), listUserVoteVectors(userId)]);
  const profile = userProfileOf(quizzes, votes, now);
  if (!profile) return null;
  const quiz = quizzes.find((q) => q.createdAt <= now);
  const quizAnswers = quiz ? answeredCountsOf(quiz.answers) : emptyIdeologyVector();
  // The same observations the model counted, so the two cannot drift apart.
  const voteVectors = votes
    .filter((v) => v.votedAt <= now)
    .map(voteObservation)
    .filter((o) => o.weight > 0)
    .map((o) => o.vector);
  const confidence = Object.fromEntries(
    IDEOLOGY_DIMENSIONS.map((d): [IdeologyDimension, DimensionConfidence] => [
      d,
      { level: confidenceOf(profile.support[d]), quizAnswers: quizAnswers[d], votes: voteVectors.filter((v) => v[d] !== undefined).length },
    ]),
  ) as Record<IdeologyDimension, DimensionConfidence>;
  return { vector: profile.vector, confidence };
}
