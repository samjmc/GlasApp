import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import {
  DEFAULT_PLAN_CONFIG,
  FALLBACK_PLAN_CONFIG,
  answerOrder,
  isQuizSeed,
  newQuizSeed,
  planQuiz,
  rankOf,
  responsesFor,
  verifyPlan,
  type QuizPlan,
} from '@shared/quizPlan';
import { BANK_48, mulberry32, symmetricQuestion } from './testing/respondents';

type Answers = Record<number, number>;

const SEEDS = Array.from({ length: 200 }, (_, i) => i);

/** 6 symmetric questions per dimension: answer 0 is the strongest −, 1 mild −, 2 mild +, 3 the strongest +. */
const SYMMETRIC = IDEOLOGY_DIMENSIONS.flatMap((d, k) => [0, 1, 2, 3, 4, 5].map((j) => symmetricQuestion(100 + 6 * k + j, d)));
// Base answer patterns (answer indexes, in rank order) on SYMMETRIC, by |mean position|.
const DECISIVE = [3, 3, 3]; // +10 +10 +10: not flagged
const EVEN = [3, 1, 1]; //     +10 −5 −5:  ≈ 0, the most balanced
const MILD = [3, 0, 2]; //     +10 −10 +5: 1.67
const MIXED = [3, 0, 3]; //    +10 −10 +10: 3.33
const LOPSIDED = [3, 3, 1]; // +10 +10 −5:  5, the least balanced

const dimensions = new WeakMap<readonly QuizQuestion[], Map<number, IdeologyDimension>>();
const idsOn = (ids: number[], d: IdeologyDimension, bank: readonly QuizQuestion[] = BANK_48) => {
  let byId = dimensions.get(bank);
  if (!byId) dimensions.set(bank, (byId = new Map(bank.map((q) => [q.id, q.dimension]))));
  return ids.filter((id) => byId!.get(id) === d);
};
/** The rule, restated: a dimension's questions in rank order. */
const ranked = (seed: number, d: IdeologyDimension, bank: readonly QuizQuestion[]) =>
  bank.filter((q) => q.dimension === d).map((q) => q.id).sort((a, b) => rankOf(seed, a) - rankOf(seed, b));
const planIds = (plan: QuizPlan) => [...plan.base, ...plan.followUps];
const strongest = (q: QuizQuestion, side: 1 | -1) =>
  q.answers.reduce((best, a, i) => (side * a.value > side * q.answers[best]!.value ? i : best), 0);

/** SYMMETRIC base answers by pattern; a dimension without one is answered DECISIVE. */
function answersFor(seed: number, patterns: Partial<Record<IdeologyDimension, number[]>>): Answers {
  const { base } = planQuiz(seed, {}, SYMMETRIC);
  const answers: Answers = {};
  for (const d of IDEOLOGY_DIMENSIONS) {
    const pattern = patterns[d] ?? DECISIVE;
    idsOn(base, d, SYMMETRIC).forEach((id, i) => (answers[id] = pattern[i]!));
  }
  return answers;
}

/** Every question answered: the first-ranked base question of each dimension strongest +, the rest strongest −. */
function firstPositiveRestNegative(seed: number, bank: readonly QuizQuestion[]): Answers {
  const { base } = planQuiz(seed, {}, bank);
  const first = new Set(IDEOLOGY_DIMENSIONS.map((d) => idsOn(base, d, bank)[0]));
  return Object.fromEntries(bank.map((q) => [q.id, strongest(q, first.has(q.id) ? 1 : -1)]));
}

describe('rankOf', () => {
  it('matches the golden values (murmur3 fmix32, the same in every engine)', () => {
    expect(rankOf(0, 1)).toBe(301794027);
    expect(rankOf(42, 1)).toBe(862081050);
    expect(rankOf(4294967295, 49)).toBe(3111777362);
    expect(rankOf(2 ** 31, 7)).toBe(2796906469);
  });
});

describe('planQuiz: the base', () => {
  it('asks exactly 3 distinct questions per dimension, all on that dimension, the same on every call', () => {
    for (const bank of [QUIZ_QUESTIONS, BANK_48]) {
      for (const seed of SEEDS) {
        const { base } = planQuiz(seed, {}, bank);
        expect(base).toHaveLength(24);
        for (const d of IDEOLOGY_DIMENSIONS) {
          const ids = idsOn(base, d, bank);
          expect(new Set(ids).size, `${d} seed ${seed}`).toBe(3);
        }
        expect(planQuiz(seed, {}, bank).base).toEqual(base);
      }
    }
  });

  it('shows each question to 50% ± 3% of seeds on the 48-question pool', () => {
    expect(new Set(BANK_48.map((q) => q.id)).size).toBe(48);
    for (const d of IDEOLOGY_DIMENSIONS) expect(BANK_48.filter((q) => q.dimension === d), d).toHaveLength(6);
    const shown = new Map<number, number>();
    for (let seed = 0; seed < 5000; seed++) {
      for (const id of planQuiz(seed, {}, BANK_48).base) shown.set(id, (shown.get(id) ?? 0) + 1);
    }
    for (const q of BANK_48) {
      const share = (shown.get(q.id) ?? 0) / 5000;
      expect(share, `Q${q.id}`).toBeGreaterThanOrEqual(0.47);
      expect(share, `Q${q.id}`).toBeLessThanOrEqual(0.53);
    }
  });

  it('leaves every other dimension alone when one dimension gains a question', () => {
    for (const d of IDEOLOGY_DIMENSIONS) {
      const grown = [...BANK_48, symmetricQuestion(50, d)];
      for (const seed of SEEDS) {
        const before = planQuiz(seed, {}, BANK_48).base;
        const after = planQuiz(seed, {}, grown).base;
        for (const other of IDEOLOGY_DIMENSIONS.filter((x) => x !== d)) {
          expect(idsOn(after, other, grown), `${d} added, ${other} seed ${seed}`).toEqual(idsOn(before, other));
        }
      }
    }
  });
});

describe('planQuiz: follow-ups', () => {
  it('adds none until every base question has a valid answer', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const all = answersFor(seed, Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, MIXED])));
      expect(planQuiz(seed, all, SYMMETRIC).followUps).toHaveLength(6);
      expect(planQuiz(seed, {}, SYMMETRIC).followUps).toEqual([]);
      for (const id of Object.keys(all).map(Number)) {
        const missing = { ...all };
        delete missing[id];
        expect(planQuiz(seed, missing, SYMMETRIC), `without Q${id}`).toMatchObject({ followUps: [], followUpDimensions: [] });
        for (const bad of [4, -1, 0.5]) {
          expect(planQuiz(seed, { ...all, [id]: bad }, SYMMETRIC).followUps, `Q${id} = ${bad}`).toEqual([]);
        }
      }
    }
  });

  it('adds none when every dimension is decisive, and flags a dimension with a 0 answer', () => {
    for (const seed of SEEDS) {
      for (const pattern of [DECISIVE, [0, 0, 0], [2, 2, 3], [1, 0, 1]]) {
        const answers = answersFor(seed, Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, pattern])));
        expect(planQuiz(seed, answers, SYMMETRIC).followUps, `${pattern} seed ${seed}`).toEqual([]);
      }
    }
    // Q25 (technocratic) has a 0 answer, index 2.
    expect(QUIZ_QUESTIONS.find((q) => q.id === 25)!.answers[2]!.value).toBe(0);
    let withQ25 = 0;
    for (const seed of SEEDS) {
      const { base } = planQuiz(seed, {}, BANK_48);
      if (!base.includes(25)) continue;
      withQ25 += 1;
      const answers: Answers = Object.fromEntries(BANK_48.map((q) => [q.id, strongest(q, 1)]));
      answers[25] = 2;
      expect(planQuiz(seed, answers, BANK_48).followUpDimensions, `seed ${seed}`).toEqual(['technocratic']);
    }
    expect(withQ25).toBeGreaterThan(50);
  });

  it('gives one flagged dimension its 2 candidates in rank order', () => {
    for (const seed of SEEDS) {
      const plan = planQuiz(seed, answersFor(seed, { welfare: MIXED }), SYMMETRIC);
      expect(plan.followUps).toEqual(ranked(seed, 'welfare', SYMMETRIC).slice(3, 5));
      expect(plan.followUpDimensions).toEqual(['welfare']);
    }
  });

  it('with 5 flagged, spends 6: one each, and the second to the most balanced', () => {
    for (const seed of SEEDS) {
      const plan = planQuiz(
        seed,
        answersFor(seed, { economic: MIXED, social: MIXED, cultural: MIXED, authority: EVEN, environmental: MIXED }),
        SYMMETRIC,
      );
      expect(plan.followUps).toHaveLength(6);
      expect(plan.followUpDimensions).toEqual(['economic', 'social', 'cultural', 'authority', 'environmental']);
      expect(idsOn(plan.followUps, 'authority', SYMMETRIC)).toEqual(ranked(seed, 'authority', SYMMETRIC).slice(3, 5));
      for (const d of ['economic', 'social', 'cultural', 'environmental'] as const) {
        expect(idsOn(plan.followUps, d, SYMMETRIC)).toEqual(ranked(seed, d, SYMMETRIC).slice(3, 4));
      }
      // Grouped by dimension in bank order, not in the order they were allocated.
      expect(plan.followUps).toEqual(plan.followUpDimensions.flatMap((d) => idsOn(plan.followUps, d, SYMMETRIC)));
    }
  });

  it('with all 8 flagged, spends 6 and the 2 least balanced get none', () => {
    for (const seed of SEEDS) {
      const patterns = { economic: MILD, social: LOPSIDED, cultural: MIXED, authority: MILD, environmental: MIXED, welfare: LOPSIDED, globalism: EVEN, technocratic: MILD };
      const plan = planQuiz(seed, answersFor(seed, patterns), SYMMETRIC);
      expect(plan.followUps).toHaveLength(6);
      expect(plan.followUpDimensions).toEqual(['economic', 'cultural', 'authority', 'environmental', 'globalism', 'technocratic']);
    }
  });

  it('spends no budget on a flagged dimension without candidates: the 26 bank gives 24 or 26', () => {
    const rng = mulberry32(26);
    const lengths = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      const answers: Answers = Object.fromEntries(QUIZ_QUESTIONS.map((q) => [q.id, Math.floor(rng() * 4)]));
      const length = planIds(planQuiz(seed, answers)).length;
      expect([24, 26], `seed ${seed}`).toContain(length);
      lengths.add(length);
    }
    expect(lengths.size).toBe(2);
    for (const seed of SEEDS) {
      const plan = planQuiz(seed, firstPositiveRestNegative(seed, QUIZ_QUESTIONS));
      expect(plan.followUpDimensions).toEqual(['economic']);
      expect(planIds(plan)).toHaveLength(26);
    }
  });

  it('ignores follow-up answers: changing or adding them never moves the plan', () => {
    const rng = mulberry32(7);
    for (const seed of SEEDS) {
      const { base } = planQuiz(seed, {}, BANK_48);
      const answers: Answers = Object.fromEntries(base.map((id) => [id, Math.floor(rng() * 4)]));
      const plan = planQuiz(seed, answers, BANK_48);
      for (let k = 0; k < 3; k++) {
        const more: Answers = { ...answers };
        for (const q of BANK_48) if (!base.includes(q.id)) more[q.id] = Math.floor(rng() * 4);
        expect(planQuiz(seed, more, BANK_48), `seed ${seed}`).toEqual(plan);
      }
    }
  });

  it('under FALLBACK_PLAN_CONFIG asks 4 per dimension (32) and no follow-ups', () => {
    for (const seed of SEEDS) {
      const plan = planQuiz(seed, firstPositiveRestNegative(seed, BANK_48), BANK_48, FALLBACK_PLAN_CONFIG);
      expect(plan.base).toHaveLength(32);
      for (const d of IDEOLOGY_DIMENSIONS) expect(idsOn(plan.base, d), d).toHaveLength(4);
      expect(plan.followUps).toEqual([]);
    }
  });

  // The seams plan 07's e2e relies on.
  it('predicts the flow: all strongest − gives 24; first-ranked + and the rest − flags all 8 and gives 30', () => {
    for (const seed of SEEDS) {
      const negative: Answers = Object.fromEntries(BANK_48.map((q) => [q.id, strongest(q, -1)]));
      expect(planIds(planQuiz(seed, negative, BANK_48))).toHaveLength(24);
      const mixed = firstPositiveRestNegative(seed, BANK_48);
      expect(planIds(planQuiz(seed, mixed, BANK_48))).toHaveLength(30);
      const unlimited = { ...DEFAULT_PLAN_CONFIG, followUpBudget: 16 };
      expect(planQuiz(seed, mixed, BANK_48, unlimited).followUpDimensions).toHaveLength(8);
    }
  });
});

describe('answerOrder', () => {
  it('reaches all 24 orders evenly, puts each answer first 25% ± 2% of the time, and is deterministic', () => {
    const seeds = 24000;
    const orders = new Map<string, number>();
    const first = [0, 0, 0, 0];
    for (let seed = 0; seed < seeds; seed++) {
      const order = answerOrder(seed, 1);
      expect([...order].sort()).toEqual([0, 1, 2, 3]);
      orders.set(order.join(''), (orders.get(order.join('')) ?? 0) + 1);
      first[order[0]!] += 1;
    }
    expect(orders.size).toBe(24);
    for (const [order, count] of Array.from(orders)) {
      expect(count / seeds, order).toBeGreaterThanOrEqual(0.035);
      expect(count / seeds, order).toBeLessThanOrEqual(0.048);
    }
    for (const count of first) {
      expect(count / seeds).toBeGreaterThanOrEqual(0.23);
      expect(count / seeds).toBeLessThanOrEqual(0.27);
    }
    expect(answerOrder(42, 7)).toEqual(answerOrder(42, 7));
  });
});

describe('responsesFor', () => {
  it('sends the plan’s answers in plan order and drops a follow-up that left the plan', () => {
    for (const seed of SEEDS) {
      const answers = answersFor(seed, { welfare: MIXED });
      const before = planQuiz(seed, answers, SYMMETRIC);
      const [f1, f2] = before.followUps;
      answers[f1!] = 0;
      answers[f2!] = 3;
      expect(responsesFor(before, answers)).toEqual(planIds(before).map((id) => ({ questionId: id, answerIndex: answers[id] })));

      // The user goes back and makes welfare decisive: its follow-ups leave the plan.
      idsOn(before.base, 'welfare', SYMMETRIC).forEach((id) => (answers[id] = 3));
      const after = planQuiz(seed, answers, SYMMETRIC);
      expect(after.followUps).toEqual([]);
      expect(responsesFor(after, answers)).toEqual(after.base.map((id) => ({ questionId: id, answerIndex: answers[id] })));
    }
  });
});

describe('verifyPlan', () => {
  it('returns the record only when the answered set is exactly the plan', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const answers = answersFor(seed, { welfare: MIXED });
      const plan = planQuiz(seed, answers, SYMMETRIC);
      for (const id of plan.followUps) answers[id] = 1;
      const responses = responsesFor(plan, answers);
      expect(verifyPlan(seed, responses, SYMMETRIC)).toEqual({ v: 1, seed, base: plan.base, followUps: plan.followUps });
      expect(verifyPlan(seed, responses.slice(0, -1), SYMMETRIC), 'a follow-up missing').toBeNull();
      const stale = ranked(seed, 'welfare', SYMMETRIC)[5]!;
      expect(verifyPlan(seed, [...responses, { questionId: stale, answerIndex: 0 }], SYMMETRIC), 'an extra id').toBeNull();

      const decisive = responsesFor(planQuiz(seed, answersFor(seed, {}), SYMMETRIC), answersFor(seed, {}));
      expect(verifyPlan(seed, decisive, SYMMETRIC)).toEqual({ v: 1, seed, base: plan.base, followUps: [] });
      expect(verifyPlan(seed, decisive.slice(1), SYMMETRIC), 'a base id missing').toBeNull();
      expect(verifyPlan(1.5, decisive, SYMMETRIC), 'a bad seed').toBeNull();
    }
  });
});

describe('isQuizSeed and newQuizSeed', () => {
  it('accepts integers 0..2^32−1 only', () => {
    expect(isQuizSeed(0)).toBe(true);
    expect(isQuizSeed(2 ** 32 - 1)).toBe(true);
    for (const bad of [-1, 1.5, 2 ** 32, NaN, '42', null, undefined]) expect(isQuizSeed(bad), String(bad)).toBe(false);
  });

  it('draws valid, varied seeds', () => {
    const seeds = Array.from({ length: 50 }, newQuizSeed);
    for (const seed of seeds) expect(isQuizSeed(seed)).toBe(true);
    expect(new Set(seeds).size).toBeGreaterThan(45);
  });
});
