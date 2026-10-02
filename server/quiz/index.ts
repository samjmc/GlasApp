/**
 * The quiz. The only public surface; everything else in this folder is internal.
 *
 * The server scores every quiz: the client sends answer choices, never scores. Anyone can
 * take it; a result is saved only for a signed-in user, and saving it moves their profile.
 */
import type { IdeologyDimension } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizResponse, type QuizResult } from '@shared/quiz';
import { verifyPlan, type QuizPlanRecord } from '@shared/quizPlan';
import type { QuizResultRow } from '@shared/schema/quiz';
import { recomputeProfile } from '../ideology';
import * as repo from '../ideology/repository';
import { ideologyLabel } from './label';
import { answeredCountsOf, scoreQuiz } from './score';

export { QuizInputError } from './score';

/** The dimensions of a plan's follow-ups, in bank order (follow-ups are grouped that way). */
function followUpDimensionsOf(plan: QuizPlanRecord | null): IdeologyDimension[] {
  const dimensions = (plan?.followUps ?? []).map((id) => QUIZ_QUESTIONS.find((q) => q.id === id)?.dimension);
  return Array.from(new Set(dimensions.filter((d): d is IdeologyDimension => d !== undefined)));
}

function toResult(row: QuizResultRow): QuizResult {
  return {
    id: row.id,
    vector: repo.vectorOf(row),
    ideology: row.ideology,
    description: row.description,
    answeredCount: row.answers.length,
    answeredByDimension: answeredCountsOf(row.answers),
    followUpDimensions: followUpDimensionsOf(row.plan),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Score the answers; save them when there is a user. Throws QuizInputError on bad input.
 *
 * `seed` is the one the client planned the quiz from. The plan is stored only when the answers
 * are exactly that plan's questions. A mismatch (a stale bundle, a scripted call) is still
 * scored and saved, with plan null: losing someone's quiz is worse than an unverified plan.
 */
export async function submitQuiz(userId: string | null, answers: QuizResponse[], seed?: number): Promise<QuizResult> {
  const { vector, answeredCount, answeredByDimension } = scoreQuiz(answers);
  const plan = seed === undefined ? null : verifyPlan(seed, answers);
  if (seed !== undefined && !plan) console.warn('[quiz] plan mismatch', { seed, answered: answers.map((a) => a.questionId) });
  const followUpDimensions = followUpDimensionsOf(plan);
  const { name, description } = ideologyLabel(vector);
  if (!userId) return { id: null, vector, ideology: name, description, answeredCount, answeredByDimension, followUpDimensions, createdAt: null };
  const row = await repo.insertQuizResult({ userId, answers, plan, vector, ideology: name, description });
  // The result is saved; a failed recompute must not turn that into an error the client
  // retries (a duplicate row). The next vote, quiz or `npm run ideology -- --recalculate` heals it.
  await recomputeProfile(userId).catch((error) => {
    console.error(`[quiz] saved result ${row.id} but profile recompute failed:`, error instanceof Error ? error.message : error);
  });
  return toResult(row);
}

/** Newest first. */
export async function quizHistory(userId: string): Promise<QuizResult[]> {
  return (await repo.listQuizResults(userId)).map(toResult);
}
