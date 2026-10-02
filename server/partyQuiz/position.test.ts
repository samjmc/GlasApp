import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import type { PartyQuizItem, PartyQuizSheet } from '@shared/partyQuiz';
import type { QuizQuestion } from '@shared/quiz';
import { questionFingerprint } from '../quiz/fingerprint';
import { scoreQuiz } from '../quiz/score';
import { blendPartyTarget, manifestoPosition, type ManifestoPosition } from './position';

// The default SHEETS, for the memo test: one party whose sheet cannot be scored.
vi.mock('./sheets', async () => {
  const { QUIZ_QUESTIONS } = await import('@shared/quiz');
  const { questionFingerprint: fp } = await import('../quiz/fingerprint');
  const q = QUIZ_QUESTIONS[0]!;
  const twice = { questionId: q.id, fingerprint: fp(q), status: 'answered', answerIndex: 0, abstainReason: null, quotes: [], rationale: '', modelConfidence: 0.9, review: 'approved' };
  return { SHEETS: [{ party: 'Labour Party', election: 'ge2024', documents: [], model: 'm', promptVersion: 'v1', items: [twice, twice] }] };
});

// Invented bank: six questions on every dimension, answers valued −2, −1, +1, +2.
const BANK: QuizQuestion[] = IDEOLOGY_DIMENSIONS.flatMap((dimension, d) =>
  Array.from({ length: 6 }, (_, i) => {
    const id = d * 10 + i + 1;
    return {
      id, dimension, text: `Invented question ${id}?`,
      answers: [-2, -1, 1, 2].map((value, a) => ({ value, text: `Answer ${a} to ${id}`, description: `Reason ${a}` })),
    };
  }),
);
const byId = new Map(BANK.map((q) => [q.id, q]));
const onDimension = (d: string) => BANK.filter((q) => q.dimension === d);

const item = (questionId: number, answerIndex: number, over: Partial<PartyQuizItem> = {}): PartyQuizItem => ({
  questionId, fingerprint: byId.has(questionId) ? questionFingerprint(byId.get(questionId)!) : '00000000',
  status: 'answered', answerIndex, abstainReason: null, quotes: [], rationale: '', modelConfidence: 0.9, review: 'approved', ...over,
});
const sheetOf = (items: PartyQuizItem[], party = 'Fine Gael'): PartyQuizSheet => ({
  party, election: 'ge2024', documents: [], model: 'deepseek-flash', promptVersion: 'v1', items,
});

afterEach(() => vi.restoreAllMocks());

describe('manifestoPosition', () => {
  it('scores approved answers with the same scoreQuiz as users, found by partyKey', () => {
    const [e1, e2] = onDimension('economic');
    const [s1] = onDimension('social');
    const items = [item(e1!.id, 3), item(e2!.id, 1), item(s1!.id, 0)];
    const pos = manifestoPosition('fine gael', [sheetOf(items)], BANK)!;
    const expected = scoreQuiz(items.map((i) => ({ questionId: i.questionId, answerIndex: i.answerIndex! })), byId).vector;
    expect(pos.vector).toEqual(expected);
    expect(pos.vector.economic).not.toBe(0);
    expect(pos.answeredCount).toBe(3);
    expect(pos.askedCount).toBe(BANK.length);
  });

  it('counts coverage as answered ÷ bank questions on each dimension: 3 of 6 is 0.5', () => {
    const items = onDimension('economic').slice(0, 3).map((q) => item(q.id, 3));
    const { coverage } = manifestoPosition('Fine Gael', [sheetOf(items)], BANK)!;
    expect(coverage.economic).toBe(0.5);
    for (const d of IDEOLOGY_DIMENSIONS.filter((x) => x !== 'economic')) expect(coverage[d]).toBe(0);
  });

  it('scores only approved, answered, current items with a bank id and an answer in range', () => {
    const [good, pending, rejected, abstained, stale, outOfRange] = onDimension('welfare');
    const items = [
      item(good!.id, 3),
      item(pending!.id, 0, { review: 'pending' }),
      item(rejected!.id, 0, { review: 'rejected' }),
      item(abstained!.id, 0, { status: 'abstained', abstainReason: 'silent' }),
      item(stale!.id, 0, { fingerprint: 'deadbeef' }),
      item(999, 0),
      item(outOfRange!.id, 4),
    ];
    const pos = manifestoPosition('Fine Gael', [sheetOf(items)], BANK)!;
    expect(pos.answeredCount).toBe(1);
    expect(pos.vector.welfare).toBe(10);
    expect(pos.coverage.welfare).toBeCloseTo(1 / 6);
  });

  it('is null when nothing qualifies, or the party has no sheet', () => {
    const q = onDimension('cultural')[0]!;
    expect(manifestoPosition('Fine Gael', [sheetOf([item(q.id, 0, { review: 'pending' })])], BANK)).toBeNull();
    expect(manifestoPosition('Sinn Féin', [sheetOf([item(q.id, 0)])], BANK)).toBeNull();
  });

  it('never throws: an unscorable sheet gives null and one log line', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const q = onDimension('cultural')[0]!;
    expect(manifestoPosition('Fine Gael', [sheetOf([item(q.id, 0), item(q.id, 1)])], BANK)).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('memoises the compiled-in sheets per party, so a broken sheet logs once, not on every request', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(manifestoPosition('Labour Party')).toBeNull();
    expect(manifestoPosition('The Labour Party')).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe('blendPartyTarget', () => {
  const t: IdeologyVector = { economic: 2, social: 4, cultural: 6, authority: -2, environmental: 0, welfare: 1, globalism: -8, technocratic: 3 };
  const m: IdeologyVector = { economic: -6, social: 8, cultural: -4, authority: 9, environmental: 5, welfare: -1, globalism: 2, technocratic: -3 };
  const position = (coverage: Partial<IdeologyVector>): ManifestoPosition => ({
    vector: m, coverage: { ...emptyIdeologyVector(), ...coverage }, answeredCount: 1, askedCount: 48,
  });

  it('is the stored party row when there is no manifesto position', () => {
    const { vector, measured } = blendPartyTarget(t, null, 'all');
    expect(vector).toEqual(t);
    expect(Array.from(measured).sort()).toEqual([...IDEOLOGY_DIMENSIONS].sort());
  });

  it('weights the manifesto by its coverage: c = 0 keeps t, c = 1 is m, c = 0.5 the midpoint', () => {
    const { vector } = blendPartyTarget(t, position({ economic: 1, social: 0.5, authority: 1 / 3 }), 'all');
    expect(vector.economic).toBe(-6);
    expect(vector.social).toBe(6);
    expect(vector.authority).toBe(1.67); // (9 + 2·(−2)) / 3, to 2 dp
    for (const d of ['cultural', 'environmental', 'welfare', 'globalism', 'technocratic'] as const) expect(vector[d]).toBe(t[d]);
  });

  it('uses m alone on a dimension the party row has not measured, and counts it as measured', () => {
    const { vector, measured } = blendPartyTarget(t, position({ economic: 0.5, cultural: 0.5 }), new Set(['economic', 'social'] as const));
    expect(vector.economic).toBe(-2);
    expect(vector.cultural).toBe(-4);
    expect(vector.welfare).toBe(t.welfare);
    expect(Array.from(measured).sort()).toEqual(['cultural', 'economic', 'social']);
  });
});
