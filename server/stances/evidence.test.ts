import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector } from '@shared/ideology';
import type { QuestionPositions } from '../voting';
import { stanceEvidenceRows, stanceEvidenceWeight, type StanceForEvidence } from './evidence';

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);
const question: QuestionPositions = {
  id: 10,
  articleId: 1,
  question: 'How should the State meet housing demand?',
  policyDomain: 'housing',
  policyTopic: 'public_housing_targets',
  options: [
    { key: 'option_a', label: 'Build public homes', vector: { ...emptyIdeologyVector(), economic: -2 }, weight: 1.5, confidence: 0.8 },
    { key: 'option_b', label: 'Leave it to the market', vector: { ...emptyIdeologyVector(), economic: 2 }, weight: 1, confidence: null },
    { key: 'option_c', label: 'No view', vector: emptyIdeologyVector(), weight: 1, confidence: null },
  ],
};

let nextId = 1;
const row = (over: Partial<StanceForEvidence>): StanceForEvidence => ({
  id: nextId++,
  tdId: 7,
  questionId: 10,
  optionKey: 'option_a',
  quoteKind: 'direct',
  discipline: null,
  statedAt: at('2026-09-20'),
  ...over,
});

describe('stanceEvidenceWeight', () => {
  it('option weight × confidence × quote kind × discipline', () => {
    const option = { weight: 1.5, confidence: 0.8 };
    expect(stanceEvidenceWeight(option, 'direct', null)).toBeCloseTo(1.2, 10);
    expect(stanceEvidenceWeight(option, 'paraphrase', null)).toBeCloseTo(0.72, 10);
    expect(stanceEvidenceWeight(option, 'division', 'free')).toBeCloseTo(0.72, 10);
    expect(stanceEvidenceWeight(option, 'division', 'rebel')).toBeCloseTo(1.08, 10);
    expect(stanceEvidenceWeight({ weight: 1, confidence: null }, 'division', 'whip')).toBe(0);
  });
});

describe('stanceEvidenceRows', () => {
  const one = (rows: StanceForEvidence[]) => stanceEvidenceRows(rows, [question]);

  it('one row per TD and question: source stance, question:<id>, the option vector on −10..+10', () => {
    expect(one([row({})])).toEqual([
      {
        tdId: 7,
        source: 'stance',
        sourceRef: 'question:10',
        policyTopic: 'public_housing_targets',
        economic: -10,
        weight: expect.closeTo(1.2, 10),
        observedAt: at('2026-09-20'),
      },
    ]);
  });

  it('a whipped vote newer than a news quote leaves the quote as the evidence', () => {
    const quote = row({ statedAt: at('2026-09-20') });
    const whip = row({ quoteKind: 'division', discipline: 'whip', optionKey: 'option_b', statedAt: at('2026-09-25') });
    expect(one([quote, whip]).map((r) => [r.economic, r.observedAt])).toEqual([[-10, at('2026-09-20')]]);
  });

  it('a free vote newer than a news quote replaces it', () => {
    const quote = row({ statedAt: at('2026-09-20') });
    const free = row({ quoteKind: 'division', discipline: 'free', optionKey: 'option_b', statedAt: at('2026-09-25') });
    expect(one([free, quote]).map((r) => [r.economic, r.weight])).toEqual([[10, 0.6]]);
  });

  it('weights: paraphrase 0.6, free vote 0.6, rebel 0.9 (option weight 1, no confidence)', () => {
    const b = { optionKey: 'option_b' };
    expect(one([row({ ...b, quoteKind: 'paraphrase' })])[0]!.weight).toBeCloseTo(0.6, 10);
    expect(one([row({ ...b, quoteKind: 'division', discipline: 'free' })])[0]!.weight).toBeCloseTo(0.6, 10);
    expect(one([row({ ...b, quoteKind: 'division', discipline: 'rebel' })])[0]!.weight).toBeCloseTo(0.9, 10);
  });

  it('a TD and question with only whipped votes gives no row', () => {
    expect(one([row({ quoteKind: 'division', discipline: 'whip' }), row({ quoteKind: 'division', discipline: 'whip', statedAt: at('2026-09-01') })])).toEqual([]);
  });

  it('the latest eligible row wins; on the same time, the higher id', () => {
    const old = row({ id: 50, optionKey: 'option_b', statedAt: at('2026-09-01') });
    const newer = row({ id: 40, statedAt: at('2026-09-20') });
    expect(one([newer, old]).map((r) => r.economic)).toEqual([-10]);
    const tieLow = row({ id: 60, optionKey: 'option_b', statedAt: at('2026-09-20') });
    expect(one([tieLow, newer]).map((r) => r.economic)).toEqual([10]);
    expect(one([newer, tieLow]).map((r) => r.economic)).toEqual([10]);
  });

  it('no row for an option with no signal, an option or question that is gone, or no option', () => {
    expect(one([row({ optionKey: 'option_c' })])).toEqual([]);
    expect(one([row({ optionKey: 'option_z' })])).toEqual([]);
    expect(stanceEvidenceRows([row({})], [])).toEqual([]);
  });

  it('keeps TDs and questions apart', () => {
    const rows = one([row({ tdId: 7 }), row({ tdId: 8, optionKey: 'option_b' })]);
    expect(rows.map((r) => [r.tdId, r.economic])).toEqual([[7, -10], [8, 10]]);
  });
});
