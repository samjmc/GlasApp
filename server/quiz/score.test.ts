import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { QuizInputError, coverageOf, scoreQuiz } from './score';

const strongest = (q: QuizQuestion, side: 1 | -1) =>
  q.answers.reduce((best, a, i) => (side * a.value > side * q.answers[best]!.value ? i : best), 0);
const onDimension = (d: string) => QUIZ_QUESTIONS.filter((q) => q.dimension === d);
const question = (id: number) => QUIZ_QUESTIONS.find((q) => q.id === id)!;
/** The strong and mild magnitudes a new question uses. */
const levels = (q: QuizQuestion) => (q.dimension === 'economic' ? { strong: 2.5, mild: 1.25 } : { strong: 3.33, mild: 1.67 });
const NEW_IDS = Array.from({ length: 22 }, (_, i) => 28 + i);

/**
 * One pin per new question (ids 28–49): a fragment of its strongest answer on one side, and that
 * side. Read against DIMENSION_POLES: + is market, conservative, traditional, authoritarian,
 * pro-growth, self-reliance, nationalist, populist.
 */
const NEW_PINS: Array<[id: number, fragment: string, side: 1 | -1]> = [
  [28, 'A new state construction company', -1],
  [29, 'drop any mandatory wait', -1],
  [30, 'protect each school\'s religious ethos', 1],
  [31, 'including paid arrangements', -1],
  [32, 'should not air a Catholic call to prayer', -1],
  [33, 'teach more subjects through Irish', 1],
  [34, 'including people from newer communities', -1],
  [35, 'ban under-16s outright', 1],
  [36, 'every serious criminal trial should be heard by a jury', -1],
  [37, 'in designated high-crime areas', 1],
  [38, 'Pause new connections', -1],
  [39, 'Freeze it, then cut it', 1],
  [40, 'no bans and no push to switch', 1],
  [41, 'Lower it to 65', -1],
  [42, 'free for every child', -1],
  [43, 'one flat rate for everyone', 1],
  [44, 'More and deeper free-trade deals', -1],
  [45, 'Cut overseas aid', 1],
  [46, 'move to majority voting on both', -1],
  [47, 'appoint proven experts from outside politics', -1],
  [48, 'enough citizens\' signatures', 1],
  [49, 'The Central Bank alone', -1],
];

describe('the question bank', () => {
  it('has 48 questions, exactly 6 per dimension, unique ids, and never reuses id 26', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(48);
    for (const d of IDEOLOGY_DIMENSIONS) expect(onDimension(d), d).toHaveLength(6);
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size).toBe(QUIZ_QUESTIONS.length);
    expect(QUIZ_QUESTIONS.map((q) => q.id)).not.toContain(26);
    for (const q of QUIZ_QUESTIONS) expect(IDEOLOGY_DIMENSIONS).toContain(q.dimension);
  });

  it('gives every question 4 finite answers, both sides, at least 3 distinct values, and no 0 except legacy Q25', () => {
    for (const q of QUIZ_QUESTIONS) {
      const values = q.answers.map((a) => a.value);
      expect(values, `Q${q.id}`).toHaveLength(4);
      for (const v of values) expect(Number.isFinite(v), `Q${q.id}`).toBe(true);
      expect(Math.max(...values), `Q${q.id}`).toBeGreaterThan(0);
      expect(Math.min(...values), `Q${q.id}`).toBeLessThan(0);
      expect(new Set(values).size, `Q${q.id}`).toBeGreaterThanOrEqual(3);
      if (q.id !== 25) expect(values, `Q${q.id}`).not.toContain(0);
    }
  });

  it('gives each new question (ids 28–49) exactly −S, −M, +M, +S', () => {
    const newQuestions = QUIZ_QUESTIONS.filter((q) => q.id >= 28);
    expect(newQuestions.map((q) => q.id).sort((a, b) => a - b)).toEqual(NEW_IDS);
    for (const q of newQuestions) {
      const { strong, mild } = levels(q);
      expect(q.answers.map((a) => a.value).sort((a, b) => a - b), `Q${q.id}`).toEqual([-strong, -mild, mild, strong]);
    }
  });

  it('gives Q14, Q15 and Q16 a mild and a strong answer on each side', () => {
    for (const id of [14, 15, 16]) {
      expect(question(id).answers.map((a) => a.value).sort((a, b) => a - b), `Q${id}`).toEqual([-3.33, -1.67, 1.67, 3.33]);
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

  it('pins the sign of each new question’s strongest answer on one side', () => {
    expect(NEW_PINS.map(([id]) => id)).toEqual(NEW_IDS);
    for (const [id, fragment, side] of NEW_PINS) {
      const q = question(id);
      const found = q.answers.filter((a) => a.text.includes(fragment));
      expect(found, `Q${id} "${fragment}"`).toHaveLength(1);
      expect(found[0]!.value, `Q${id} "${fragment}"`).toBe(side * levels(q).strong);
    }
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
