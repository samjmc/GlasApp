import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { QuizInputError, answeredCountsOf, coverageOf, scoreQuiz } from './score';

const strongest = (q: QuizQuestion, side: 1 | -1) =>
  q.answers.reduce((best, a, i) => (side * a.value > side * q.answers[best]!.value ? i : best), 0);
const onDimension = (d: string) => QUIZ_QUESTIONS.filter((q) => q.dimension === d);

describe('the question bank', () => {
  it('has 26 questions of four answers, one value each, and at least 3 per dimension', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(26);
    for (const d of IDEOLOGY_DIMENSIONS) expect(onDimension(d).length, d).toBeGreaterThanOrEqual(3);
    for (const q of QUIZ_QUESTIONS) {
      expect(IDEOLOGY_DIMENSIONS).toContain(q.dimension);
      expect(q.answers).toHaveLength(4);
      for (const a of q.answers) expect(Number.isFinite(a.value)).toBe(true);
    }
  });

  it('covers every dimension, with unique question ids', () => {
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.dimension)).size).toBe(8);
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size).toBe(QUIZ_QUESTIONS.length);
  });

  it('offers both sides and at least 3 distinct stances on every question', () => {
    for (const q of QUIZ_QUESTIONS) {
      const values = q.answers.map((a) => a.value);
      expect(Math.max(...values), `Q${q.id}`).toBeGreaterThan(0);
      expect(Math.min(...values), `Q${q.id}`).toBeLessThan(0);
      expect(new Set(values).size, `Q${q.id}`).toBeGreaterThanOrEqual(3);
    }
  });

  // Pins the 2026-09-24 sign flip: + is the right-coded pole on every dimension.
  it('follows the shared sign rule on the dimensions that used to be inverted', () => {
    const answer = (fragment: string) => {
      const found = QUIZ_QUESTIONS.flatMap((q) => q.answers).find((a) => a.text.includes(fragment));
      if (!found) throw new Error(`no answer containing "${fragment}"`);
      return found.value;
    };
    expect(answer('broad-based tax relief')).toBeGreaterThan(0); // economic: market
    expect(answer('Adopt UBI nationwide')).toBeLessThan(0); // welfare: expand
    expect(answer('Deregulate rent entirely')).toBeGreaterThan(0); // welfare: self-reliance
    expect(answer('offshore wind')).toBeLessThan(0); // environmental: ecological
    expect(answer('Relax timelines')).toBeGreaterThan(0); // environmental: pro-growth
    expect(answer('Join fully; collective security')).toBeLessThan(0); // globalism: internationalist
    expect(answer('national resources are already stretched')).toBeGreaterThan(0); // globalism: nationalist
    expect(answer('let expert teams steer')).toBeLessThan(0); // technocratic: expert-led
    expect(answer('opaque algorithms')).toBeGreaterThan(0); // technocratic: populist
    expect(answer('binding power')).toBeGreaterThan(0); // technocratic: people power
    expect(answer('Legislate now for terminally ill adults')).toBeLessThan(0); // social: progressive
    expect(answer('Keep the current ban')).toBeGreaterThan(0); // social: conservative
    expect(answer('fully public system')).toBeLessThan(0); // Q6 is economic: collective
    expect(QUIZ_QUESTIONS.find((q) => q.id === 6)!.dimension).toBe('economic');
  });
});

describe('scoreQuiz', () => {
  it('reaches ±10 on every dimension with the strongest answers on that side, even where the bank is lopsided', () => {
    for (const d of IDEOLOGY_DIMENSIONS) {
      for (const side of [1, -1] as const) {
        const answers = onDimension(d).map((q) => ({ questionId: q.id, answerIndex: strongest(q, side) }));
        expect(scoreQuiz(answers).vector[d], `${d} ${side}`).toBe(10 * side);
      }
    }
  });

  it('scores a partial quiz for what it says, and reports the coverage', () => {
    const q = onDimension('economic')[0]!;
    const { vector, coverage, answeredCount } = scoreQuiz([{ questionId: q.id, answerIndex: strongest(q, 1) }]);
    expect(answeredCount).toBe(1);
    expect(vector.economic).toBe(10); // the strongest market answer available, not "2.5 = centrist"
    expect(coverage.economic).toBe(1 / onDimension('economic').length);
    for (const d of IDEOLOGY_DIMENSIONS.filter((x) => x !== 'economic')) {
      expect(vector[d]).toBe(0);
      expect(coverage[d]).toBe(0);
    }
  });

  it('keeps answer strength: a milder answer scores below the strongest', () => {
    const q = QUIZ_QUESTIONS.find((x) => x.id === 1)!; // values −2.5, −2.5, +2.5, +1.25
    expect(scoreQuiz([{ questionId: 1, answerIndex: 3 }]).vector.economic).toBe(5);
    expect(q.answers[3]!.value).toBe(1.25);
  });

  it('balances mixed answers toward the centre', () => {
    const [a, b] = onDimension('welfare');
    const v = scoreQuiz([
      { questionId: a!.id, answerIndex: strongest(a!, 1) },
      { questionId: b!.id, answerIndex: strongest(b!, -1) },
    ]).vector.welfare;
    expect(Math.abs(v)).toBeLessThan(10);
  });

  it('scores a full quiz inside ±10 with full coverage', () => {
    for (const index of [0, 1, 2, 3]) {
      const { vector, coverage, answeredCount } = scoreQuiz(QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, answerIndex: index })));
      expect(answeredCount).toBe(QUIZ_QUESTIONS.length);
      for (const d of IDEOLOGY_DIMENSIONS) {
        expect(Math.abs(vector[d])).toBeLessThanOrEqual(10);
        expect(coverage[d]).toBe(1);
      }
    }
  });

  it('rejects unknown questions, repeats, bad answer indexes and empty input', () => {
    expect(() => scoreQuiz([])).toThrow(QuizInputError);
    expect(() => scoreQuiz([{ questionId: 999, answerIndex: 0 }])).toThrow(/Unknown question/);
    expect(() => scoreQuiz([{ questionId: 1, answerIndex: 4 }])).toThrow(/no answer 4/);
    expect(() => scoreQuiz([{ questionId: 1, answerIndex: 0.5 }])).toThrow(/no answer/);
    expect(() =>
      scoreQuiz([
        { questionId: 1, answerIndex: 0 },
        { questionId: 1, answerIndex: 1 },
      ]),
    ).toThrow(/answered twice/);
  });
});

describe('coverageOf', () => {
  it('matches scoreQuiz coverage for stored answers', () => {
    const answers = [{ questionId: 1, answerIndex: 0 }, { questionId: 2, answerIndex: 0 }, { questionId: 17, answerIndex: 1 }];
    expect(coverageOf(answers)).toEqual(scoreQuiz(answers).coverage);
  });
});

describe('answeredCountsOf', () => {
  const wholeBank = QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, answerIndex: 0 }));
  const bankCounts = { economic: 5, social: 3, cultural: 3, authority: 3, environmental: 3, welfare: 3, globalism: 3, technocratic: 3 };

  it('counts the answers on each dimension', () => {
    expect(answeredCountsOf(wholeBank)).toEqual(bankCounts);
  });

  it('skips an id the bank does not have instead of throwing, as coverageOf does', () => {
    expect(answeredCountsOf([...wholeBank, { questionId: 999, answerIndex: 0 }])).toEqual(bankCounts);
  });

  it('is what scoreQuiz reports as answeredByDimension', () => {
    const answers = [{ questionId: 1, answerIndex: 2 }, { questionId: 2, answerIndex: 3 }, { questionId: 20, answerIndex: 1 }];
    expect(scoreQuiz(answers).answeredByDimension).toEqual(answeredCountsOf(answers));
    expect(scoreQuiz(wholeBank).answeredByDimension).toEqual(bankCounts);
  });
});
