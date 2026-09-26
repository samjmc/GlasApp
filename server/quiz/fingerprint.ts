/**
 * A short hash of what a respondent reads: the dimension, the question text, and each answer's
 * text and description, in order. Answer values are left out on purpose: re-weighting a
 * question rescores stored answers, while any edit to its wording makes them stale.
 */
import { createHash } from 'node:crypto';
import type { QuizQuestion } from '@shared/quiz';

export function questionFingerprint(q: QuizQuestion): string {
  const input = JSON.stringify([q.dimension, q.text, q.answers.map((a) => [a.text, a.description])]);
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}
