import { describe, expect, it } from 'vitest';
import { MIN_EXCHANGES, SECURED_POINTS, formatFigures, scoreExchanges, type ExchangeItem, type ExchangeMember } from './rules';

const M = (over: Partial<ExchangeMember>): ExchangeMember => ({
  exchangeId: 'x1',
  format: 'topical_issue',
  memberCode: 'A',
  tdId: null,
  inOffice: false,
  governmentSide: false,
  asked: false,
  spoke: true,
  ...over,
});
const I = (over: Partial<ExchangeItem>): ExchangeItem => ({ exchangeId: 'x1', memberCode: 'MIN', kind: 'commitment', commitmentType: 'action', ...over });
const MIN = M({ memberCode: 'MIN', inOffice: true, governmentSide: true });

describe('scoreExchanges', () => {
  it('gives the asker two points, once, when a minister commits to an action in the exchange', () => {
    expect(SECURED_POINTS).toBe(2);
    const rows = scoreExchanges([M({ asked: true }), MIN], [I({}), I({}), I({ kind: 'specific_claim', commitmentType: null })]);
    const by = Object.fromEntries(rows.map((r) => [r.memberCode, r]));
    expect(by.A).toMatchObject({ secured: 2, points: 2, answered: false });
    // The minister answered: their claims and commitments are shown, never scored.
    expect(by.MIN).toMatchObject({ answered: true, answerClaims: 1, answerCommitments: 2, points: 0 });
  });

  it('shows a follow-up for no points, and scores nothing for a government-side asker', () => {
    const rows = scoreExchanges([M({ asked: true }), M({ memberCode: 'FF', asked: true, governmentSide: true }), MIN], [I({ commitmentType: 'follow_up' })]);
    expect(rows.find((r) => r.memberCode === 'A')).toMatchObject({ secured: 0, followUps: 1, points: 0 });
    const gov = scoreExchanges([M({ memberCode: 'FF', asked: true, governmentSide: true }), MIN], [I({})]);
    expect(gov.find((r) => r.memberCode === 'FF')).toMatchObject({ secured: 1, points: 0 });
  });

  it('credits every asker of a grouped question, including one who did not speak', () => {
    const rows = scoreExchanges([M({ asked: true }), M({ memberCode: 'B', asked: true, spoke: false }), MIN], [I({})]);
    expect(rows.filter((r) => r.points === SECURED_POINTS).map((r) => r.memberCode)).toEqual(['A', 'B']);
  });

  it('ignores a commitment by someone not in office, and keeps exchanges apart', () => {
    const rows = scoreExchanges(
      [M({ asked: true }), M({ memberCode: 'B' }), MIN, M({ exchangeId: 'x2', memberCode: 'C', asked: true })],
      [I({ memberCode: 'B' }), I({ exchangeId: 'x1' })],
    );
    expect(rows.find((r) => r.memberCode === 'A')?.secured).toBe(1);
    expect(rows.find((r) => r.memberCode === 'C')).toMatchObject({ secured: 0, points: 0 });
  });
});

describe('formatFigures', () => {
  const asked = (member: string, format: ExchangeMember['format'], n: number, securedEvery: number) =>
    scoreExchanges(
      Array.from({ length: n }, (_, k) => [M({ exchangeId: `${member}-${format}-${k}`, format, memberCode: member, asked: true }), M({ exchangeId: `${member}-${format}-${k}`, format, memberCode: 'MIN', inOffice: true, governmentSide: true })]).flat(),
      Array.from({ length: n }, (_, k) => k).filter((k) => k % securedEvery === 0).map((k) => I({ exchangeId: `${member}-${format}-${k}` })),
    ).filter((r) => r.memberCode === member);

  it('gives a rate per 10 for oral PQs and Topical Issues, against backbenchers with enough exchanges, never pooled', () => {
    expect(MIN_EXCHANGES).toBe(10);
    const a = [...asked('A', 'oral_pq', 10, 2), ...asked('A', 'leaders_questions', 4, 1)];
    const everyone = [...a, ...asked('B', 'oral_pq', 20, 4), ...asked('C', 'oral_pq', 9, 1)];
    const figures = Object.fromEntries(formatFigures(a, everyone).map((f) => [f.format, f]));
    // A: 5 of 10 secured; B: 5 of 20; C has too few to be in the cohort.
    expect(figures.oral_pq).toMatchObject({ asked: 10, securedExchanges: 5, points: 10, perTen: 5, cohortSize: 2 });
    expect(figures.oral_pq?.cohortP75).toBe(4.4);
    // Leaders' Questions are shown, never given a figure.
    expect(figures.leaders_questions).toMatchObject({ asked: 4, securedExchanges: 4, perTen: null, cohortP75: null, cohortSize: 0 });
  });

  it('gives no rate below the minimum', () => {
    const c = asked('C', 'topical_issue', 9, 1);
    expect(formatFigures(c, c)[0]).toMatchObject({ asked: 9, perTen: null, cohortSize: 0 });
  });
});
