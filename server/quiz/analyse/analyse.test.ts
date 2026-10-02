/**
 * The item analysis on synthetic respondents (./synthetic: the shared respondent model through
 * the real adaptive planner), one planted defect per test, plus the gates at their boundaries.
 * Fixed seeds throughout; no database.
 */
import { describe, expect, it } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { mulberry32, symmetricQuestion } from '../testing/respondents';
import { analyse, type AnalysisResult } from './analyse';
import { toRespondent, type ExclusionReason, type Respondent } from './exposures';
import { pearson, poolCorrelations, standardisedAlpha } from './stats';
import { REALISTIC_NOISE, synthesise, type Synthetic, type SyntheticOptions } from './synthetic';
import { MIN_BASE_EXPOSURES_ITEM, MIN_PAIR_COEXPOSURES, MIN_USERS_DIMENSION_CORR } from './thresholds';

const SEED = 20260925;
const NONE: Record<ExclusionReason, number> = { 'no-answers': 0, unscorable: 0, incomplete: 0, 'unknown-exposure': 0 };

/** Synthesise, send every row through toRespondent like a stored one, and analyse. */
function analysed(o: SyntheticOptions): { s: Synthetic; result: AnalysisResult } {
  const s = synthesise(o);
  const respondents = s.rows.map((row) => {
    const out = toRespondent(row, s.bank);
    if (!out.ok) throw new Error(`a synthetic row was excluded as ${out.reason}`);
    return out.r;
  });
  return { s, result: analyse(respondents, s.bank, NONE) };
}

/** How many rows had the question in their plan's base, counted straight from the plans. */
const baseCount = (s: Synthetic, id: number) => s.rows.filter((row) => row.plan!.base.includes(id)).length;
const question = (result: AnalysisResult, id: number) => result.questions.find((q) => q.id === id)!;
const flagsOf = (result: AnalysisResult, id: number) => result.findings.flatMap((f) => ('questionId' in f && f.questionId === id ? [f.kind] : []));

/** The standardised alpha of a 3-question form from every respondent's answers to every question. */
function trueAlpha(s: Synthetic, dimension: string): number {
  const qs = s.bank.filter((q) => q.dimension === dimension);
  const pairs: Array<{ r: number; n: number }> = [];
  for (let i = 0; i < qs.length; i++) {
    for (let j = i + 1; j < qs.length; j++) {
      const xs = s.full.map((f) => qs[i].answers[f[qs[i].id]].value);
      const ys = s.full.map((f) => qs[j].answers[f[qs[j].id]].value);
      pairs.push({ r: pearson(xs, ys)!, n: xs.length });
    }
  }
  return standardisedAlpha(poolCorrelations(pairs).r, 3);
}

describe('flags on synthetic respondents', () => {
  it('a clean bank at 300 users raises no flag of any kind, with every section past its gate', () => {
    const { result } = analysed({ n: 300, seed: SEED });
    expect(result.questions.filter((q) => !q.base.ok || !q.quality.ok)).toEqual([]);
    expect(result.dimensions.filter((d) => !d.alpha.ok)).toEqual([]);
    expect(result.correlations.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('flags a pure-noise question weak, not reversed, from its base exposures only', () => {
    const { s, result } = analysed({ n: 300, seed: SEED, badItem: 9 });
    expect(flagsOf(result, 9)).toEqual(['weak']);
    const q = question(result, 9);
    expect(q.baseExposures).toBe(baseCount(s, 9));
    // It had follow-up exposures too, and they stayed out.
    expect(q.followUpExposures).toBeGreaterThan(0);
  });

  it('flags a question whose values run the wrong way reversed', () => {
    const { result } = analysed({ n: 300, seed: SEED, reversedItem: 15 });
    expect(flagsOf(result, 15)).toEqual(['reversed']);
  });

  it("estimates each dimension's base-form alpha within 0.03 of the true alpha at 1000 users", () => {
    const { s, result } = analysed({ n: 1000, seed: SEED });
    for (const d of result.dimensions) {
      if (!d.alpha.ok) throw new Error(`${d.dimension} alpha is under its gate`);
      expect(Math.abs(d.alpha.value.alpha - trueAlpha(s, d.dimension)), d.dimension).toBeLessThan(0.03);
    }
    expect(result.dimensions).toHaveLength(8);
  });

  it('flags a dominant answer and a dead one at 300 users, counting base exposures only', () => {
    const { s, result } = analysed({ n: 300, seed: SEED, dominant: { id: 21, answer: 2 }, dead: { id: 28, answer: 3 } });
    // Forcing one answer also leaves Q21 little to correlate with, so it may read weak as well.
    expect(flagsOf(result, 21)).toContain('dominant');
    expect(flagsOf(result, 28)).toEqual(['dead']);
    expect(result.findings).toContainEqual(expect.objectContaining({ kind: 'dominant', questionId: 21, answerIndex: 2 }));
    expect(result.findings).toContainEqual(expect.objectContaining({ kind: 'dead', questionId: 28, answerIndex: 3 }));
    for (const id of [21, 28]) {
      expect(question(result, id).baseExposures).toBe(baseCount(s, id));
      expect(question(result, id).followUpExposures).toBeGreaterThan(0);
    }
  });

  it.each([1, -1])('calls two copies of one latent (r = %d) one construct on the disattenuated r, while |observed r| is under 0.7', (r) => {
    const { result } = analysed({ n: 1000, seed: SEED, noise: REALISTIC_NOISE, sharedLatent: { a: 'economic', b: 'social', r } });
    if (!result.correlations.ok) throw new Error('correlations are under their gate');
    const pair = result.correlations.value.find((c) => c.a === 'economic' && c.b === 'social')!;
    expect(Math.abs(pair.observed!)).toBeLessThan(0.7);
    expect(Math.sign(pair.observed!)).toBe(r);
    expect(result.findings.filter((f) => f.kind === 'oneConstruct')).toEqual([
      expect.objectContaining({ kind: 'oneConstruct', a: 'economic', b: 'social' }),
    ]);
  });

  it('is deterministic per seed', () => {
    expect(analysed({ n: 300, seed: SEED }).result).toEqual(analysed({ n: 300, seed: SEED }).result);
    expect(analysed({ n: 300, seed: SEED + 1 }).result).not.toEqual(analysed({ n: 300, seed: SEED }).result);
  });
});

const respondent = (base: Record<number, number>, vector: IdeologyVector = emptyIdeologyVector()): Respondent => ({
  base: new Map(Object.entries(base).map(([id, answer]) => [Number(id), answer])),
  followUp: new Map(),
  vector,
});
const ONE_QUESTION = [symmetricQuestion(1, 'economic')];

describe('gates', () => {
  it('5 users: every section is under its gate, with no number and no flag', () => {
    const { result } = analysed({ n: 5, seed: SEED });
    for (const q of result.questions) {
      expect(q.base).toEqual({ ok: false, n: q.baseExposures, need: MIN_BASE_EXPOSURES_ITEM, unit: 'base exposures' });
      expect(q.quality).toEqual({ ok: false, n: 0, need: 2, unit: 'qualifying pairs' });
    }
    for (const d of result.dimensions) expect(d.alpha).toMatchObject({ ok: false, n: 0, unit: 'qualifying pairs' });
    expect(result.correlations).toEqual({ ok: false, n: 5, need: MIN_USERS_DIMENSION_CORR, unit: 'respondents' });
    expect(result.findings).toEqual([]);
  });

  it('shows a distribution at exactly MIN_BASE_EXPOSURES_ITEM base exposures, and not at one fewer', () => {
    const people = (n: number) => Array.from({ length: n }, (_, i) => respondent({ 1: i % 4 }));
    expect(analyse(people(MIN_BASE_EXPOSURES_ITEM - 1), ONE_QUESTION, NONE).questions[0].base).toEqual({
      ok: false, n: MIN_BASE_EXPOSURES_ITEM - 1, need: MIN_BASE_EXPOSURES_ITEM, unit: 'base exposures',
    });
    expect(analyse(people(MIN_BASE_EXPOSURES_ITEM), ONE_QUESTION, NONE).questions[0].base).toEqual({ ok: true, value: [25, 25, 25, 25] });
  });

  it('a pair counts from MIN_PAIR_COEXPOSURES co-exposures, an item from 2 such pairs, alpha from ⅔ of them', () => {
    const three = [1, 2, 3].map((id) => symmetricQuestion(id, 'social'));
    const rng = mulberry32(5);
    const both = (ids: number[], n: number) =>
      Array.from({ length: n }, () => respondent(Object.fromEntries(ids.map((id) => [id, Math.floor(rng() * 4)]))));
    const alphaOf = (r: AnalysisResult) => r.dimensions.find((d) => d.dimension === 'social')!.alpha;

    // Q1–Q2 and Q1–Q3 at the gate; Q2 and Q3 never together.
    let result = analyse([...both([1, 2], MIN_PAIR_COEXPOSURES), ...both([1, 3], MIN_PAIR_COEXPOSURES)], three, NONE);
    expect(result.questions.map((q) => q.quality.ok)).toEqual([true, false, false]);
    expect(result.questions[1].quality).toEqual({ ok: false, n: 1, need: 2, unit: 'qualifying pairs' });
    expect(alphaOf(result)).toMatchObject({ ok: true, value: { pairs: 2, possible: 3 } });

    // One co-exposure fewer on Q1–Q3: that pair drops out, and with it Q1 and alpha.
    result = analyse([...both([1, 2], MIN_PAIR_COEXPOSURES), ...both([1, 3], MIN_PAIR_COEXPOSURES - 1)], three, NONE);
    expect(result.questions.map((q) => q.quality.ok)).toEqual([false, false, false]);
    expect(alphaOf(result)).toEqual({ ok: false, n: 1, need: 2, unit: 'qualifying pairs' });
  });

  it('correlates dimensions from MIN_USERS_DIMENSION_CORR respondents, and not from one fewer', () => {
    const rng = mulberry32(6);
    const people = (n: number) =>
      Array.from({ length: n }, () => respondent({}, Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, rng()])) as IdeologyVector));
    expect(analyse(people(MIN_USERS_DIMENSION_CORR - 1), ONE_QUESTION, NONE).correlations).toEqual({
      ok: false, n: MIN_USERS_DIMENSION_CORR - 1, need: MIN_USERS_DIMENSION_CORR, unit: 'respondents',
    });
    const at = analyse(people(MIN_USERS_DIMENSION_CORR), ONE_QUESTION, NONE).correlations;
    expect(at.ok && at.value.filter((c) => c.observed !== null)).toHaveLength(28);
  });
});
