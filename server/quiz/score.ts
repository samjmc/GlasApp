/**
 * Quiz answers → a position on the eight dimensions. Pure; the server is the only scorer.
 *
 * Each question adds its chosen answer's value on the question's OWN dimension. The bank is
 * tuned so that a dimension's questions sum to at most ±10; the clamp guards future edits.
 */
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from '@shared/quiz';
import { clampIdeologyValue, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';

export class QuizInputError extends Error {}

const byId = new Map<number, QuizQuestion>(QUIZ_QUESTIONS.map((q) => [q.id, q]));

export interface QuizScore {
  vector: IdeologyVector;
  answeredCount: number;
}

export function scoreQuiz(responses: QuizResponse[], questions: Map<number, QuizQuestion> = byId): QuizScore {
  const seen = new Set<number>();
  const vector = emptyIdeologyVector();
  for (const { questionId, answerIndex } of responses) {
    const question = questions.get(questionId);
    if (!question) throw new QuizInputError(`Unknown question ${questionId}`);
    if (seen.has(questionId)) throw new QuizInputError(`Question ${questionId} answered twice`);
    const answer = question.answers[answerIndex];
    if (!Number.isInteger(answerIndex) || !answer) {
      throw new QuizInputError(`Question ${questionId} has no answer ${answerIndex}`);
    }
    seen.add(questionId);
    vector[question.dimension] += answer.vector[question.dimension];
  }
  if (seen.size === 0) throw new QuizInputError('No answers to score');
  for (const dimension of Object.keys(vector) as Array<keyof IdeologyVector>) {
    vector[dimension] = Math.round(clampIdeologyValue(vector[dimension]) * 10) / 10;
  }
  return { vector, answeredCount: seen.size };
}
