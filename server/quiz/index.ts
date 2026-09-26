/**
 * The quiz. The only public surface; everything else in this folder is internal.
 *
 * The server scores every quiz: the client sends answer choices, never scores. Anyone can
 * take it; a result is saved only for a signed-in user, and saving it moves their profile.
 */
import type { QuizResponse, QuizResult } from '@shared/quiz';
import type { QuizResultRow } from '@shared/schema/quiz';
import { recomputeProfile } from '../ideology';
import * as repo from '../ideology/repository';
import { ideologyLabel } from './label';
import { answeredCountsOf, scoreQuiz } from './score';

export { QuizInputError } from './score';

function toResult(row: QuizResultRow): QuizResult {
  return {
    id: row.id,
    vector: repo.vectorOf(row),
    ideology: row.ideology,
    description: row.description,
    answeredCount: row.answers.length,
    answeredByDimension: answeredCountsOf(row.answers),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Score the answers; save them when there is a user. Throws QuizInputError on bad input. */
export async function submitQuiz(userId: string | null, answers: QuizResponse[]): Promise<QuizResult> {
  const { vector, answeredCount, answeredByDimension } = scoreQuiz(answers);
  const { name, description } = ideologyLabel(vector);
  if (!userId) return { id: null, vector, ideology: name, description, answeredCount, answeredByDimension, createdAt: null };
  const row = await repo.insertQuizResult({ userId, answers, vector, ideology: name, description });
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
