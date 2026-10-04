/**
 * The planner go/no-go, on the real 48-question pool. Simulated respondents
 * (./testing/respondents) answer every question; each condition asks a different subset of
 * those same answers, so conditions differ only in which questions were asked.
 *
 *   A  the fixed 26 legacy questions      D  the base 24 only
 *   B  adaptive (DEFAULT_PLAN_CONFIG)     E  all 48
 *   C  base 24 + as many random extras    F  FALLBACK_PLAN_CONFIG (32 fixed-random)
 *      as B asked, from the non-base 24
 *
 * QUIZ_SIM_N=<n> simulates more respondents (default 2,000); QUIZ_SIM_REPORT=1 prints the tables.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from '@shared/quiz';
import { DEFAULT_PLAN_CONFIG, FALLBACK_PLAN_CONFIG, planQuiz, responsesFor, type QuizPlanConfig } from '@shared/quizPlan';
import { partyBaseline } from '../ideology/partyBaselines';
import { scoreQuiz } from './score';
import { LEGACY_BANK, chooseAnswer, itemOffsets, makeRespondents, mulberry32, symmetricQuestion, type Rng } from './testing/respondents';

const N = Number(process.env.QUIZ_SIM_N) || 2000;
const REPORT = process.env.QUIZ_SIM_REPORT === '1';
const CONDITIONS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
type Condition = (typeof CONDITIONS)[number];
const LEGACY_IDS = LEGACY_BANK.map((q) => q.id);
/** The most a noise-free respondent at ±2 may be put on the wrong side, on any dimension. */
const MAX_WRONG_SIDE_AT_2 = 0.25;

const PARTY_NAMES = [
  'Fianna Fáil', 'Fine Gael', 'Sinn Féin', 'Aontú', 'Green Party', 'People Before Profit–Solidarity', 'Labour Party',
  'Independent Ireland', 'Social Democrats', 'The Irish People', 'Irish Freedom Party', 'National Party',
];
const PARTIES = PARTY_NAMES.map((name) => ({ name, at: partyBaseline(name) }));

/** Q14 before the 2026-09-26 rebalance: three ecological answers and only a strong pro-growth one. */
const lopsided = (id: number): QuizQuestion => ({
  id,
  dimension: 'environmental',
  text: `Lopsided Q${id}`,
  answers: [-3.33, -1.67, -1.67, 3.33].map((value) => ({ value, text: String(value), description: '' })),
});

/** 1 when the estimate is on the wrong side of the truth, ½ when it is 0, else 0. */
const wrongSide = (estimate: number, truth: number) => (estimate === 0 ? 0.5 : Math.sign(estimate) === Math.sign(truth) ? 0 : 1);
/** alignment()'s ordering, without its rounding to whole percent. */
const distance = (a: IdeologyVector, b: IdeologyVector) => IDEOLOGY_DIMENSIONS.reduce((s, d) => s + Math.abs(a[d] - b[d]), 0);
const topParty = (v: IdeologyVector) => PARTIES.reduce((best, p) => (distance(v, p.at!) < distance(v, best.at!) ? p : best)).name;
const scorer = (bank: readonly QuizQuestion[]) => {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return (responses: QuizResponse[]) => scoreQuiz(responses, byId).vector;
};
const asResponses = (ids: number[], answers: Record<number, number>) => ids.map((id) => ({ questionId: id, answerIndex: answers[id]! }));

function sample<T>(items: T[], k: number, rng: Rng): T[] {
  const pool = items.slice();
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, k);
}

function simulate(n: number) {
  const rng = mulberry32(20260925);
  const score = scorer(QUIZ_QUESTIONS);
  const offsets = itemOffsets(QUIZ_QUESTIONS, rng);
  const all = QUIZ_QUESTIONS.map((q) => q.id);
  const tally = Object.fromEntries(
    CONDITIONS.map((c) => [c, { sq: 0, cells: 0, wrong: 0, sided: 0, agree: 0, length: 0, min: Infinity, max: 0 }]),
  ) as Record<Condition, { sq: number; cells: number; wrong: number; sided: number; agree: number; length: number; min: number; max: number }>;

  for (const { latent, noise } of makeRespondents(n, rng)) {
    const answers: Record<number, number> = Object.fromEntries(
      QUIZ_QUESTIONS.map((q) => [q.id, chooseAnswer(q, latent[q.dimension], offsets.get(q.id)!, noise, rng)]),
    );
    const seed = Math.floor(rng() * 2 ** 32);
    const adaptive = planQuiz(seed, answers);
    const extras = sample(all.filter((id) => !adaptive.base.includes(id)), adaptive.followUps.length, rng);
    const asked: Record<Condition, QuizResponse[]> = {
      A: asResponses(LEGACY_IDS, answers),
      B: responsesFor(adaptive, answers),
      C: asResponses(adaptive.base.concat(extras), answers),
      D: asResponses(adaptive.base, answers),
      E: asResponses(all, answers),
      F: responsesFor(planQuiz(seed, answers, QUIZ_QUESTIONS, FALLBACK_PLAN_CONFIG), answers),
    };
    const top = topParty(latent);
    for (const c of CONDITIONS) {
      const estimate = score(asked[c]);
      const t = tally[c];
      for (const d of IDEOLOGY_DIMENSIONS) {
        t.sq += (estimate[d] - latent[d]) ** 2;
        t.cells += 1;
        if (Math.abs(latent[d]) >= 1.5) {
          t.wrong += wrongSide(estimate[d], latent[d]);
          t.sided += 1;
        }
      }
      if (topParty(estimate) === top) t.agree += 1;
      t.length += asked[c].length;
      t.min = Math.min(t.min, asked[c].length);
      t.max = Math.max(t.max, asked[c].length);
    }
  }
  return Object.fromEntries(
    CONDITIONS.map((c) => {
      const t = tally[c];
      return [c, { rmse: Math.sqrt(t.sq / t.cells), wrongSide: t.wrong / t.sided, topParty: t.agree / n, meanLength: t.length / n, minLength: t.min, maxLength: t.max, cells: t.cells }];
    }),
  ) as Record<Condition, { rmse: number; wrongSide: number; topParty: number; meanLength: number; minLength: number; maxLength: number; cells: number }>;
}

/**
 * A respondent at `truth` on every dimension, with no noise and no item offsets, over quiz
 * seeds: per dimension, the wrong-side rate and the lowest and highest score. Only the seed
 * varies, so this is the planner's own spread. `ids` fixes the questions (condition A).
 */
function noiseFree(truth: number, bank: readonly QuizQuestion[], seeds: number, ids?: number[], config: QuizPlanConfig = DEFAULT_PLAN_CONFIG) {
  const rng = mulberry32(1);
  const answers: Record<number, number> = Object.fromEntries(bank.map((q) => [q.id, chooseAnswer(q, truth, 0, 0, rng)]));
  const score = scorer(bank);
  const wrong = emptyIdeologyVector();
  const low = emptyIdeologyVector();
  const high = emptyIdeologyVector();
  for (let seed = 0; seed < seeds; seed++) {
    const v = score(ids ? asResponses(ids, answers) : responsesFor(planQuiz(seed, answers, bank, config), answers));
    for (const d of IDEOLOGY_DIMENSIONS) {
      wrong[d] += wrongSide(v[d], truth) / seeds;
      low[d] = seed === 0 ? v[d] : Math.min(low[d], v[d]);
      high[d] = seed === 0 ? v[d] : Math.max(high[d], v[d]);
    }
  }
  return { wrong, low, high };
}

describe('the respondent model', () => {
  it('is deterministic per seed, and with no noise chooseAnswer picks the closest answer position', () => {
    const people = makeRespondents(200, mulberry32(3));
    expect(makeRespondents(200, mulberry32(3))).toEqual(people);
    expect(makeRespondents(200, mulberry32(4))).not.toEqual(people);
    for (const { latent, noise } of people) {
      expect([3, 6]).toContain(noise);
      for (const d of IDEOLOGY_DIMENSIONS) expect(Math.abs(latent[d])).toBeLessThanOrEqual(10);
    }

    const rng = mulberry32(1);
    // −3.33 −1.67 −1.67 +3.33 sits at −10 −5 −5 +10. At +2 the closest is −5; raw values would pick +3.33.
    expect(chooseAnswer(lopsided(14), 2, 0, 0, rng)).toBe(1);
    expect(chooseAnswer(lopsided(14), 2, 1, 0, rng)).toBe(3); // the offset moves the target to 3: +10 is closer
    // Q1 −2.5 −2.5 +2.5 +1.25 sits at −10 −10 +10 +5. At +4 the closest is +5; raw values would pick +2.5.
    expect(QUIZ_QUESTIONS.find((q) => q.id === 1)!.answers.map((a) => a.value)).toEqual([-2.5, -2.5, 2.5, 1.25]);
    expect(chooseAnswer(QUIZ_QUESTIONS.find((q) => q.id === 1)!, 4, 0, 0, rng)).toBe(3);
  });
});

describe('the wrong-side metric', () => {
  it('can fail: three lopsided questions put a mild +2 on the wrong side, three symmetric ones do not', () => {
    const symmetric = [1, 2, 3].map((id) => symmetricQuestion(id, 'environmental'));
    expect(noiseFree(2, [1, 2, 3].map(lopsided), 200).wrong.environmental).toBeGreaterThan(0.5);
    expect(noiseFree(2, symmetric, 200).wrong.environmental).toBeLessThan(0.1);
    // An estimate of 0 has picked no side: half wrong, never right.
    expect([wrongSide(0, 2), wrongSide(0, -2), wrongSide(-0.1, 2), wrongSide(0.1, 2)]).toEqual([0.5, 0.5, 1, 0]);
  });
});

/** Per dimension: noise-free wrong-side rates at ±2 for A, B and F, and B's score range over seeds at +2. */
function perDimensionTable() {
  const aUp = noiseFree(2, QUIZ_QUESTIONS, 1, LEGACY_IDS);
  const bUp = noiseFree(2, QUIZ_QUESTIONS, 1000);
  const fUp = noiseFree(2, QUIZ_QUESTIONS, 1000, undefined, FALLBACK_PLAN_CONFIG);
  const aDown = noiseFree(-2, QUIZ_QUESTIONS, 1, LEGACY_IDS);
  const bDown = noiseFree(-2, QUIZ_QUESTIONS, 1000);
  const fDown = noiseFree(-2, QUIZ_QUESTIONS, 1000, undefined, FALLBACK_PLAN_CONFIG);
  return IDEOLOGY_DIMENSIONS.map((d) => ({
    dimension: d,
    'A +2': aUp.wrong[d], 'B +2': bUp.wrong[d], 'F +2': fUp.wrong[d],
    'A −2': aDown.wrong[d], 'B −2': bDown.wrong[d], 'F −2': fDown.wrong[d],
    'B +2 score range': `${bUp.low[d]}..${bUp.high[d]}`,
  }));
}

describe(`the planner go/no-go (${N} simulated respondents, the real 48 pool)`, () => {
  let results: ReturnType<typeof simulate>;
  let perDimension: ReturnType<typeof perDimensionTable>;
  beforeAll(() => {
    results = simulate(N);
    perDimension = perDimensionTable();
    if (!REPORT) return;
    const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
    console.table(Object.fromEntries(CONDITIONS.map((c) => {
      const r = results[c];
      return [c, { RMSE: r.rmse.toFixed(2), 'wrong side': pct(r.wrongSide), 'top party': pct(r.topParty), 'mean length': r.meanLength.toFixed(1), 'min..max': `${r.minLength}..${r.maxLength}` }];
    })));
    console.table(perDimension.map((r) => ({
      ...r, 'A +2': pct(r['A +2']), 'B +2': pct(r['B +2']), 'F +2': pct(r['F +2']), 'A −2': pct(r['A −2']), 'B −2': pct(r['B −2']), 'F −2': pct(r['F −2']),
    })));
  });

  it('scores every respondent on every dimension in every condition', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(48);
    expect(LEGACY_IDS).toHaveLength(26);
    for (const c of CONDITIONS) expect(results[c].cells, c).toBe(N * 8);
    expect(PARTIES.filter((p) => !p.at).map((p) => p.name)).toEqual([]);
  });

  it('B puts at most 0.85× as many on the wrong side as A, and 0.9× as many as C', () => {
    expect(results.B.wrongSide).toBeLessThanOrEqual(0.85 * results.A.wrongSide);
    expect(results.B.wrongSide).toBeLessThanOrEqual(0.9 * results.C.wrongSide);
  });

  it('B is no less accurate than A (RMSE within 1%)', () => {
    expect(results.B.rmse).toBeLessThanOrEqual(1.01 * results.A.rmse);
  });

  it('B asks 24 to 30 questions, 29.5 or fewer on average', () => {
    expect(results.B.minLength).toBeGreaterThanOrEqual(24);
    expect(results.B.maxLength).toBeLessThanOrEqual(30);
    expect(results.B.meanLength).toBeLessThanOrEqual(29.5);
  });

  it(`B puts a noise-free respondent at ±2 on the wrong side at most ${100 * MAX_WRONG_SIDE_AT_2}% of the time, on every dimension`, () => {
    expect(perDimension.map((r) => r.dimension)).toEqual([...IDEOLOGY_DIMENSIONS]);
    for (const row of perDimension) {
      for (const k of ['B +2', 'B −2'] as const) expect(row[k], `${row.dimension} ${k}`).toBeLessThanOrEqual(MAX_WRONG_SIDE_AT_2);
    }
  });
});
