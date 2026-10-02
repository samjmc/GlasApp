import { describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS, type QuizResponse } from '@shared/quiz';
import { scoreQuiz } from '../score';
import { LEGACY_QUESTION_IDS, toRespondent, type QuizRow } from './exposures';

const answer = (ids: readonly number[], index = 0): QuizResponse[] => ids.map((questionId) => ({ questionId, answerIndex: index }));

function included(row: QuizRow) {
  const out = toRespondent(row, QUIZ_QUESTIONS);
  if (!out.ok) throw new Error(`excluded as ${out.reason}`);
  return out.r;
}

describe('toRespondent', () => {
  it('splits a planned row into base and follow-up exactly as its plan says', () => {
    const answers = [
      { questionId: 1, answerIndex: 0 },
      { questionId: 2, answerIndex: 1 },
      { questionId: 3, answerIndex: 2 },
      { questionId: 4, answerIndex: 3 },
    ];
    const r = included({ answers, plan: { v: 1, seed: 7, base: [1, 2, 3], followUps: [4] } });
    expect([...r.base]).toEqual([[1, 0], [2, 1], [3, 2]]);
    expect([...r.followUp]).toEqual([[4, 3]]);
  });

  it('reads a null plan with exactly the 26 legacy ids as all base', () => {
    expect(LEGACY_QUESTION_IDS).toEqual([...Array.from({ length: 25 }, (_, i) => i + 1), 27]);
    const r = included({ answers: answer([...LEGACY_QUESTION_IDS].reverse(), 1), plan: null });
    expect([...r.base.keys()].sort((a, b) => a - b)).toEqual([...LEGACY_QUESTION_IDS]);
    expect(r.followUp.size).toBe(0);
  });

  it('excludes a null plan with any other id set as unknown-exposure', () => {
    for (const ids of [[1], LEGACY_QUESTION_IDS.slice(1), LEGACY_QUESTION_IDS.filter((id) => id !== 27)]) {
      expect(toRespondent({ answers: answer(ids), plan: null }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'unknown-exposure' });
    }
  });

  it('names every other exclusion, and never throws', () => {
    const plan = { v: 1 as const, seed: 7, base: [1, 2, 3], followUps: [4] };
    // An id missing from the plan, and one the plan never showed.
    expect(toRespondent({ answers: answer([1, 2, 3]), plan }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'incomplete' });
    expect(toRespondent({ answers: answer([1, 2, 3, 4, 5]), plan }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'incomplete' });
    expect(toRespondent({ answers: [], plan: null }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'no-answers' });
    expect(toRespondent({ answers: answer([1, 999]), plan: null }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'unscorable' });
    expect(toRespondent({ answers: [{ questionId: 1, answerIndex: 9 }], plan: null }, QUIZ_QUESTIONS)).toEqual({ ok: false, reason: 'unscorable' });
  });

  it("scores the answers afresh rather than trusting a row's stored columns", () => {
    const answers = answer(LEGACY_QUESTION_IDS, 3);
    const stale = { economic: 9, social: 9, cultural: 9, authority: 9, environmental: 9, welfare: 9, globalism: 9, technocratic: 9 };
    const r = included({ answers, plan: null, ...stale } as QuizRow);
    expect(r.vector).toEqual(scoreQuiz(answers).vector);
    expect(r.vector).not.toEqual(stale);
  });
});
