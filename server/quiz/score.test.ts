import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import { QUIZ_QUESTIONS } from '@shared/quiz';
import { QuizInputError, scoreQuiz } from './score';

const answerAll = (index: number) => QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, answerIndex: index }));

describe('the question bank', () => {
  it('has 25 questions of four answers, each with a full eight-axis vector', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(25);
    for (const q of QUIZ_QUESTIONS) {
      expect(IDEOLOGY_DIMENSIONS).toContain(q.dimension);
      expect(q.answers).toHaveLength(4);
      for (const a of q.answers) expect(Object.keys(a.vector).sort()).toEqual([...IDEOLOGY_DIMENSIONS].sort());
    }
  });

  it('covers every dimension, with unique question ids', () => {
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.dimension)).size).toBe(8);
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size).toBe(QUIZ_QUESTIONS.length);
  });

  it('can reach at most ±10 on each dimension (the clamp is a guard, not a crutch)', () => {
    for (const d of IDEOLOGY_DIMENSIONS) {
      const own = QUIZ_QUESTIONS.filter((q) => q.dimension === d);
      const max = own.reduce((s, q) => s + Math.max(...q.answers.map((a) => a.vector[d])), 0);
      const min = own.reduce((s, q) => s + Math.min(...q.answers.map((a) => a.vector[d])), 0);
      expect(max).toBeLessThanOrEqual(10.01);
      expect(min).toBeGreaterThanOrEqual(-10.01);
    }
  });

  // Pins the 2026-09-24 sign flip: + is the right-coded pole on every dimension.
  it('follows the shared sign rule on the dimensions that used to be inverted', () => {
    const answer = (fragment: string) => {
      const found = QUIZ_QUESTIONS.flatMap((q) => q.answers).find((a) => a.text.includes(fragment));
      if (!found) throw new Error(`no answer containing "${fragment}"`);
      return found.vector;
    };
    expect(answer('broad-based tax relief').welfare).toBeGreaterThan(0); // self-reliance
    expect(answer('targeted social supports').welfare).toBeLessThan(0); // expand welfare
    expect(answer('offshore wind').environmental).toBeLessThan(0); // ecological
    expect(answer('Relax timelines').environmental).toBeGreaterThan(0); // pro-growth
    expect(answer('Join fully; collective security').globalism).toBeLessThan(0); // internationalist
    expect(answer('national resources are already stretched').globalism).toBeGreaterThan(0); // nationalist
    expect(answer('let expert teams steer').technocratic).toBeLessThan(0); // expert-led
    expect(answer('opaque algorithms').technocratic).toBeGreaterThan(0); // populist
    expect(answer('binding power').technocratic).toBeGreaterThan(0); // people power
  });
});

describe('scoreQuiz', () => {
  it('adds only each question\'s own dimension', () => {
    const q = QUIZ_QUESTIONS[0]!;
    const { vector, answeredCount } = scoreQuiz([{ questionId: q.id, answerIndex: 2 }]);
    expect(answeredCount).toBe(1);
    expect(vector[q.dimension]).toBe(Math.round(q.answers[2]!.vector[q.dimension] * 10) / 10);
    for (const d of IDEOLOGY_DIMENSIONS.filter((x) => x !== q.dimension)) expect(vector[d]).toBe(0);
  });

  it('scores a full quiz inside ±10 on every dimension', () => {
    for (const index of [0, 1, 2, 3]) {
      const { vector, answeredCount } = scoreQuiz(answerAll(index));
      expect(answeredCount).toBe(25);
      for (const d of IDEOLOGY_DIMENSIONS) expect(Math.abs(vector[d])).toBeLessThanOrEqual(10);
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
