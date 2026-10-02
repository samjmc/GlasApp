/**
 * One stored quiz → which questions were BASE (the response-independent part of the plan) and
 * which were follow-ups, or the reason it cannot be used. Only base exposures feed a flag:
 * follow-ups go only to users whose base answers were mixed, so they are not a random sample.
 */
import type { IdeologyVector } from '@shared/ideology';
import type { QuizQuestion, QuizResponse } from '@shared/quiz';
import type { QuizPlanRecord } from '@shared/quizPlan';
import { scoreQuiz } from '../score';

/** One row as the loader returns it: no user id, no timestamp. */
export interface QuizRow {
  answers: QuizResponse[];
  plan: QuizPlanRecord | null;
}

/** The fixed quiz before the 48 pool: every legacy result answered exactly these. */
export const LEGACY_QUESTION_IDS: readonly number[] = [...Array.from({ length: 25 }, (_, i) => i + 1), 27];

export const EXCLUSION_REASONS = ['no-answers', 'unscorable', 'incomplete', 'unknown-exposure'] as const;
export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export interface Respondent {
  /** Question id → answer index. */
  base: Map<number, number>;
  followUp: Map<number, number>;
  /** scoreQuiz of the answers: the real product score, follow-ups included. */
  vector: IdeologyVector;
}

const sameIds = (answered: Set<number>, ids: readonly number[]) => answered.size === ids.length && ids.every((id) => answered.has(id));

export function toRespondent(
  row: QuizRow,
  bank: readonly QuizQuestion[],
): { ok: true; r: Respondent } | { ok: false; reason: ExclusionReason } {
  if (row.answers.length === 0) return { ok: false, reason: 'no-answers' };
  let vector: IdeologyVector;
  try {
    // Re-scored from the answers: the stored columns can be stale until a recalculate.
    vector = scoreQuiz(row.answers, new Map(bank.map((q) => [q.id, q]))).vector;
  } catch {
    return { ok: false, reason: 'unscorable' };
  }
  const answered = new Set(row.answers.map((a) => a.questionId));
  const pick = (ids: readonly number[]) => new Map(row.answers.filter((a) => ids.includes(a.questionId)).map((a) => [a.questionId, a.answerIndex]));
  if (row.plan) {
    const { base, followUps } = row.plan;
    if (!sameIds(answered, base.concat(followUps))) return { ok: false, reason: 'incomplete' };
    return { ok: true, r: { base: pick(base), followUp: pick(followUps), vector } };
  }
  if (!sameIds(answered, LEGACY_QUESTION_IDS)) return { ok: false, reason: 'unknown-exposure' };
  return { ok: true, r: { base: pick(LEGACY_QUESTION_IDS), followUp: new Map(), vector } };
}
