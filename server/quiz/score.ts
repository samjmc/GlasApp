/**
 * Quiz answers → a position on the eight dimensions. Pure; the server is the only scorer.
 *
 * Each question measures one dimension. A dimension's score is the sum of the chosen answers'
 * values, scaled by the most extreme sum the user could have reached ON THAT SIDE with the
 * same questions:
 *
 *   score = 10 × Σ chosen / Σ (most positive answer)    when Σ chosen ≥ 0
 *   score = 10 × Σ chosen / Σ |most negative answer|    when Σ chosen < 0
 *
 * So picking the strongest answer on a side always reaches ±10, whichever questions were
 * answered. Two defects of a plain sum are gone:
 * - Lopsided banks. The bank's strongest libertarian answers sum to −8.33 but its strongest
 *   authoritarian ones to +9.99. A plain sum could never call anyone strongly libertarian.
 * - Partial quizzes. One strongly pro-market answer summed to 2.5 ("centrist"), not a
 *   strong stance. `coverage` says how much of each dimension was asked, so the model can
 *   weigh a partial quiz for what it is.
 */
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from '@shared/quiz';
import { IDEOLOGY_DIMENSIONS, IDEOLOGY_LIMIT, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';

export class QuizInputError extends Error {}

const BANK = new Map<number, QuizQuestion>(QUIZ_QUESTIONS.map((q) => [q.id, q]));

/**
 * Answers on a dimension that count as fully covering it. A complete legacy quiz asked 3 per
 * dimension; never tie this to the plan's base size (shared/quizPlan.ts), or a change of plan
 * config would re-weight every stored result.
 */
export const FULL_COVERAGE_ANSWERS = 3;

export interface QuizScore {
  vector: IdeologyVector;
  /** Per dimension, min(1, answers on it / FULL_COVERAGE_ANSWERS). Follow-ups sharpen the score but add no weight. */
  coverage: IdeologyVector;
  answeredCount: number;
  /** Per dimension, how many of the answers were questions on it. */
  answeredByDimension: IdeologyVector;
}

export function scoreQuiz(responses: QuizResponse[], bank: Map<number, QuizQuestion> = BANK): QuizScore {
  const sum = emptyIdeologyVector();
  const reachUp = emptyIdeologyVector();
  const reachDown = emptyIdeologyVector();
  const seen = new Set<number>();

  for (const { questionId, answerIndex } of responses) {
    const question = bank.get(questionId);
    if (!question) throw new QuizInputError(`Unknown question ${questionId}`);
    if (seen.has(questionId)) throw new QuizInputError(`Question ${questionId} answered twice`);
    const answer = Number.isInteger(answerIndex) ? question.answers[answerIndex] : undefined;
    if (!answer) throw new QuizInputError(`Question ${questionId} has no answer ${answerIndex}`);
    seen.add(questionId);

    const d = question.dimension;
    const values = question.answers.map((a) => a.value);
    sum[d] += answer.value;
    reachUp[d] += Math.max(0, ...values);
    reachDown[d] += Math.max(0, ...values.map((v) => -v));
  }
  if (seen.size === 0) throw new QuizInputError('No answers to score');

  const answered = answeredCountsOf(responses, bank);
  const vector = emptyIdeologyVector();
  for (const d of IDEOLOGY_DIMENSIONS) {
    const reach = sum[d] >= 0 ? reachUp[d] : reachDown[d];
    vector[d] = reach > 0 ? Math.round((IDEOLOGY_LIMIT * sum[d] / reach) * 10) / 10 : 0;
  }
  return { vector, coverage: coverageFrom(answered), answeredCount: seen.size, answeredByDimension: answered };
}

function coverageFrom(answered: IdeologyVector): IdeologyVector {
  const coverage = emptyIdeologyVector();
  for (const d of IDEOLOGY_DIMENSIONS) coverage[d] = Math.min(1, answered[d] / FULL_COVERAGE_ANSWERS);
  return coverage;
}

/** Per dimension, the coverage of the given answers. For stored results. */
export function coverageOf(responses: QuizResponse[], bank: Map<number, QuizQuestion> = BANK): IdeologyVector {
  return coverageFrom(answeredCountsOf(responses, bank));
}

/** Per dimension, how many of the given answers were questions on it. Skips unknown ids; never throws. */
export function answeredCountsOf(responses: QuizResponse[], bank: Map<number, QuizQuestion> = BANK): IdeologyVector {
  const counts = emptyIdeologyVector();
  for (const { questionId } of responses) {
    const q = bank.get(questionId);
    if (q) counts[q.dimension] += 1;
  }
  return counts;
}
