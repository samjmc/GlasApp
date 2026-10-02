/**
 * A party's position from its manifesto answers, and its blend into the party match target.
 * Pure.
 *
 * Approved answers are scored by the same scoreQuiz as users, giving the manifesto vector m.
 * Coverage c is counted here, per dimension: approved answered current items ÷ bank questions.
 * `scoreQuiz` coverage is not used, because it may change for users (a partial-quiz floor).
 * At read time the match target is v = c·m + (1−c)·t, with t the stored party row, so the
 * manifesto enters once and TD profiles are untouched.
 */
import {
  IDEOLOGY_DIMENSIONS,
  emptyIdeologyVector,
  type IdeologyDimension,
  type IdeologyVector,
} from '@shared/ideology';
import type { PartyQuizItem, PartyQuizSheet } from '@shared/partyQuiz';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { partyKey } from '../ideology/partyBaselines';
import { questionFingerprint } from '../quiz/fingerprint';
import { scoreQuiz } from '../quiz/score';
import { SHEETS } from './sheets';

export interface ManifestoPosition {
  vector: IdeologyVector;
  /** Per dimension, approved answered items ÷ bank questions on it, 0..1. */
  coverage: IdeologyVector;
  answeredCount: number;
  /** Questions in the bank: the denominator of coverage. */
  askedCount: number;
}

/** True when the item was answered for the question as the bank has it now. */
export function isCurrent(item: PartyQuizItem, bank: Map<number, QuizQuestion>): boolean {
  const question = bank.get(item.questionId);
  return !!question && item.fingerprint === questionFingerprint(question);
}

const MEMO = new Map<string, ManifestoPosition | null>();

/**
 * Null when no item qualifies. Never throws, because it runs on every match request: an
 * error is logged and gives null. The compiled-in sheets are memoised per party key.
 */
export function manifestoPosition(
  party: string,
  sheets: PartyQuizSheet[] = SHEETS,
  bank: QuizQuestion[] = QUIZ_QUESTIONS,
): ManifestoPosition | null {
  const key = partyKey(party);
  const memo = sheets === SHEETS && bank === QUIZ_QUESTIONS;
  if (memo && MEMO.has(key)) return MEMO.get(key)!;
  let position: ManifestoPosition | null = null;
  try {
    position = compute(key, sheets, bank);
  } catch (error) {
    console.error(`[partyQuiz] no manifesto position for ${party}:`, error instanceof Error ? error.message : error);
  }
  if (memo) MEMO.set(key, position);
  return position;
}

function compute(key: string, sheets: PartyQuizSheet[], bank: QuizQuestion[]): ManifestoPosition | null {
  const byId = new Map(bank.map((q) => [q.id, q] as const));
  const scored = sheets
    .filter((s) => partyKey(s.party) === key)
    .flatMap((s) => s.items)
    .filter((item) => {
      const answers = byId.get(item.questionId)?.answers.length ?? 0;
      return item.review === 'approved' && item.status === 'answered' && Number.isInteger(item.answerIndex)
        && item.answerIndex! >= 0 && item.answerIndex! < answers && isCurrent(item, byId);
    });
  if (scored.length === 0) return null;

  const { vector } = scoreQuiz(scored.map((i) => ({ questionId: i.questionId, answerIndex: i.answerIndex! })), byId);
  const answered = emptyIdeologyVector();
  const totals = emptyIdeologyVector();
  for (const q of bank) totals[q.dimension] += 1;
  for (const i of scored) answered[byId.get(i.questionId)!.dimension] += 1;
  const coverage = emptyIdeologyVector();
  for (const d of IDEOLOGY_DIMENSIONS) coverage[d] = totals[d] ? answered[d] / totals[d] : 0;
  return { vector, coverage, answeredCount: scored.length, askedCount: bank.length };
}

/**
 * The party match target. Per dimension: no position or c = 0 keeps t; a dimension t has
 * measured blends to c·m + (1−c)·t (2 dp); one t has not measured (a party with no baseline)
 * takes m. `measured` is t's measured dimensions plus every one the manifesto covers.
 */
export function blendPartyTarget(
  t: IdeologyVector,
  pos: ManifestoPosition | null,
  tMeasured: 'all' | Set<IdeologyDimension>,
): { vector: IdeologyVector; measured: Set<IdeologyDimension> } {
  const vector = { ...t };
  const measured = new Set<IdeologyDimension>(tMeasured === 'all' ? IDEOLOGY_DIMENSIONS : Array.from(tMeasured));
  if (!pos) return { vector, measured };
  for (const d of IDEOLOGY_DIMENSIONS) {
    const c = pos.coverage[d];
    if (c === 0) continue;
    const tHas = tMeasured === 'all' || tMeasured.has(d);
    vector[d] = tHas ? Math.round((c * pos.vector[d] + (1 - c) * t[d]) * 100) / 100 : pos.vector[d];
    measured.add(d);
  }
  return { vector, measured };
}
