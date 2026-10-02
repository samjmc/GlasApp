import { describe, expect, it } from 'vitest';
import { emptyIdeologyVector, type IdeologyVector } from '@shared/ideology';
import { QUOTE_KIND_WEIGHT, TD_HALF_LIFE_DAYS } from '../ideology/sources';
import {
  AXIS_PRIOR_WEIGHT,
  agreementFor,
  itemAgreement,
  latestStances,
  stanceWeight,
  type AgreementItem,
  type OptionPositions,
} from './agreement';

const NOW = new Date('2026-09-25T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const at = (partial: Partial<IdeologyVector>): IdeologyVector => ({ ...emptyIdeologyVector(), ...partial });

// option_a and option_c are the two most distant options (8 apart); option_b is halfway (4).
const OPTIONS: OptionPositions = {
  option_a: at({ economic: -2, welfare: -2 }),
  option_b: at({ economic: 0, welfare: 0 }),
  option_c: at({ economic: 2, welfare: 2 }),
};

const item = (userOption: string, tdOption: string, extra: Partial<AgreementItem> = {}): AgreementItem => ({
  questionId: 1,
  options: OPTIONS,
  userOption,
  tdOption,
  quoteKind: 'direct',
  statedAt: NOW,
  ...extra,
});

describe('itemAgreement', () => {
  it('is 1 for the same option and 0 for the question’s two most distant options', () => {
    expect(itemAgreement(OPTIONS, 'option_a', 'option_a')).toBe(1);
    expect(itemAgreement(OPTIONS, 'option_a', 'option_c')).toBe(0);
    expect(itemAgreement(OPTIONS, 'option_c', 'option_a')).toBe(0);
  });

  it('is linear in distance between the extremes', () => {
    expect(itemAgreement(OPTIONS, 'option_a', 'option_b')).toBe(0.5);
  });

  it('counts only an exact match when the options do not differ', () => {
    expect(itemAgreement({ option_a: at({ social: 1 }) }, 'option_a', 'option_a')).toBe(1);
    const same = { option_a: at({ social: 1 }), option_b: at({ social: 1 }) };
    expect(itemAgreement(same, 'option_a', 'option_b')).toBe(0);
  });

  it('is null for a key the question no longer has', () => {
    expect(itemAgreement(OPTIONS, 'option_a', 'option_d')).toBeNull();
    expect(itemAgreement(OPTIONS, 'constructor', 'option_a')).toBeNull();
  });
});

describe('stanceWeight', () => {
  it('halves every TD_HALF_LIFE_DAYS', () => {
    expect(stanceWeight('direct', NOW, NOW)).toBe(1);
    expect(stanceWeight('direct', daysAgo(TD_HALF_LIFE_DAYS), NOW)).toBeCloseTo(0.5, 10);
    expect(stanceWeight('direct', daysAgo(2 * TD_HALF_LIFE_DAYS), NOW)).toBeCloseTo(0.25, 10);
  });

  it('weights a paraphrase below a direct quote', () => {
    expect(QUOTE_KIND_WEIGHT).toEqual({ direct: 1, paraphrase: 0.6 });
    expect(stanceWeight('paraphrase', NOW, NOW)).toBe(0.6);
  });
});

describe('agreementFor', () => {
  it('with no items is exactly the axis number', () => {
    expect(agreementFor(63, [], NOW)).toEqual({ alignment: 63, issues: { agree: 0, disagree: 0, items: [] } });
    expect(agreementFor(71.5, [], NOW).alignment).toBe(71.5);
  });

  it('leaves out items whose options no longer match, so the axis stands', () => {
    expect(agreementFor(40, [item('option_a', 'option_z')], NOW).alignment).toBe(40);
  });

  it('blends items with the axis prior', () => {
    expect(AXIS_PRIOR_WEIGHT).toBe(2);
    // (1·100·1 + 2·50) / (1 + 2)
    expect(agreementFor(50, [item('option_a', 'option_a')], NOW).alignment).toBe(67);
    // (1·100·0 + 2·50) / (1 + 2)
    expect(agreementFor(50, [item('option_a', 'option_c')], NOW).alignment).toBe(33);
  });

  it('gives a paraphrase less pull than a direct quote', () => {
    // (0.6·100 + 2·50) / (0.6 + 2) = 61.5
    expect(agreementFor(50, [item('option_a', 'option_a', { quoteKind: 'paraphrase' })], NOW).alignment).toBe(62);
  });

  it('gives an old stance less pull than a new one', () => {
    // weight 0.5: (0.5·100 + 2·50) / 2.5 = 60
    const old = item('option_a', 'option_a', { statedAt: daysAgo(TD_HALF_LIFE_DAYS) });
    expect(agreementFor(50, [old], NOW).alignment).toBe(60);
  });

  it('counts agreements and disagreements and returns each scored item', () => {
    const result = agreementFor(50, [item('option_a', 'option_a'), item('option_a', 'option_c'), item('option_a', 'option_b')], NOW);
    expect(result.issues.agree).toBe(2);
    expect(result.issues.disagree).toBe(1);
    expect(result.issues.items.map((i) => i.agreement)).toEqual([1, 0, 0.5]);
    expect(result.issues.items[0]).toMatchObject({ userOption: 'option_a', tdOption: 'option_a', weight: 1 });
  });
});

describe('latestStances', () => {
  it('keeps the latest statedAt per TD and question', () => {
    const stances = [
      { id: 1, tdId: 1, questionId: 10, statedAt: daysAgo(30) },
      { id: 2, tdId: 1, questionId: 10, statedAt: daysAgo(2) },
      { id: 3, tdId: 1, questionId: 10, statedAt: daysAgo(10) },
      { id: 4, tdId: 1, questionId: 11, statedAt: daysAgo(40) },
      { id: 5, tdId: 2, questionId: 10, statedAt: daysAgo(40) },
    ];
    expect(latestStances(stances).map((s) => s.id).sort()).toEqual([2, 4, 5]);
  });

  it('keeps the first seen on a tie', () => {
    const stances = [
      { id: 1, tdId: 1, questionId: 10, statedAt: NOW },
      { id: 2, tdId: 1, questionId: 10, statedAt: NOW },
    ];
    expect(latestStances(stances).map((s) => s.id)).toEqual([1]);
  });
});
