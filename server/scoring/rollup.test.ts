import { describe, expect, it } from 'vitest';
import { computeRollup, type RollupInput } from './rollup';

const td = (over: Partial<RollupInput> & { tdId: number }): RollupInput => ({
  party: 'Fine Gael',
  constituency: 'Dublin Bay North',
  questions: null,
  attendancePct: null,
  committeeAttendancePct: null,
  debateScore: null,
  isPresiding: false,
  ...over,
});

describe('computeRollup', () => {
  it('derives both pillars from the facts and weights them 0.55 / 0.45', () => {
    const [r] = computeRollup([td({ tdId: 1, questions: 200, attendancePct: 95, debateScore: 0.5 })]);
    expect(r.parliamentaryScore).toBe(100);
    expect(r.debateScore).toBe(50);
    expect(r.overallScore).toBe(Math.round(100 * 0.55 + 50 * 0.45));
  });

  it('committee attendance counts in the parliamentary pillar when it is measured', () => {
    const [low, none] = computeRollup([
      td({ tdId: 1, questions: 200, attendancePct: 95, committeeAttendancePct: 42.5 }),
      td({ tdId: 2, questions: 200, attendancePct: 95, committeeAttendancePct: null }),
    ]);
    // 100 × 0.5 + 100 × 0.3 + 50 × 0.2
    expect(low.parliamentaryScore).toBe(90);
    // No committee measure: scored on questions and votes alone, not as 0.
    expect(none.parliamentaryScore).toBe(100);
  });

  // NULL is "not expected" (e.g. questions while in government office), never 0.
  it('a TD whose questions are NULL is scored on the rest, not given 0', () => {
    const [exempt, zero] = computeRollup([
      td({ tdId: 1, questions: null, attendancePct: 95, committeeAttendancePct: 85, debateScore: 0.5 }),
      td({ tdId: 2, questions: 0, attendancePct: 95, committeeAttendancePct: 85, debateScore: 0.5 }),
    ]);
    expect(exempt.parliamentaryScore).toBe(100);
    expect(exempt.overallScore).toBe(Math.round(100 * 0.55 + 50 * 0.45));
    expect(zero.parliamentaryScore).toBe(50);
  });

  it('the Ceann Comhairle has no components, no score and no rank', () => {
    const rows = computeRollup([
      td({ tdId: 1, isPresiding: true, questions: 0, committeeAttendancePct: 90 }),
      td({ tdId: 2, questions: 100, attendancePct: 90 }),
    ]);
    expect(rows[0]).toEqual({
      tdId: 1,
      parliamentaryScore: null,
      debateScore: null,
      overallScore: null,
      nationalRank: null,
      partyRank: null,
      constituencyRank: null,
    });
    expect(rows[1].nationalRank).toBe(1);
  });

  it('a TD with only one component is not scored or ranked', () => {
    const [one, two] = computeRollup([
      td({ tdId: 1, attendancePct: 95 }),
      td({ tdId: 2, attendancePct: 95, debateScore: 0.2 }),
    ]);
    expect(one.parliamentaryScore).toBe(100);
    expect(one).toMatchObject({ overallScore: null, nationalRank: null, partyRank: null, constituencyRank: null });
    expect(two.overallScore).toBe(Math.round(100 * 0.55 + 20 * 0.45));
    expect(two.nationalRank).toBe(1);
  });

  it('a TD with no data has no score and no rank', () => {
    const [r] = computeRollup([td({ tdId: 1 })]);
    expect(r).toMatchObject({ parliamentaryScore: null, debateScore: null, overallScore: null, nationalRank: null });
  });

  it('ranks nationally, within party and within constituency', () => {
    const rows = computeRollup([
      td({ tdId: 1, attendancePct: 95, debateScore: 0.9, party: 'FG', constituency: 'A' }),
      td({ tdId: 2, attendancePct: 95, debateScore: 0.7, party: 'FF', constituency: 'A' }),
      td({ tdId: 3, attendancePct: 95, debateScore: 0.5, party: 'FG', constituency: 'B' }),
      td({ tdId: 4, attendancePct: 95, debateScore: 0.3, party: null, constituency: null }),
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.tdId, r]));
    expect([by[1].nationalRank, by[2].nationalRank, by[3].nationalRank, by[4].nationalRank]).toEqual([1, 2, 3, 4]);
    expect([by[1].partyRank, by[3].partyRank]).toEqual([1, 2]);
    expect(by[2].partyRank).toBe(1);
    expect(by[4].partyRank).toBeNull();
    expect([by[1].constituencyRank, by[2].constituencyRank]).toEqual([1, 2]);
    expect(by[3].constituencyRank).toBe(1);
    expect(by[4].constituencyRank).toBeNull();
  });

  it('equal scores share a rank and the next rank skips (1, 2, 2, 4)', () => {
    const rows = computeRollup([
      td({ tdId: 7, attendancePct: 95, debateScore: 0.6, constituency: 'A' }),
      td({ tdId: 3, attendancePct: 95, debateScore: 0.6, constituency: 'A' }),
      td({ tdId: 5, attendancePct: 95, debateScore: 0.9, constituency: 'A' }),
      td({ tdId: 9, attendancePct: 95, debateScore: 0.1, constituency: 'A' }),
    ]);
    const rank = (id: number) => rows.find((r) => r.tdId === id)!;
    expect([5, 7, 3, 9].map((id) => rank(id).nationalRank)).toEqual([1, 2, 2, 4]);
    expect([5, 7, 3, 9].map((id) => rank(id).partyRank)).toEqual([1, 2, 2, 4]);
    expect([5, 7, 3, 9].map((id) => rank(id).constituencyRank)).toEqual([1, 2, 2, 4]);
  });

  it('returns one result per input, in input order', () => {
    const rows = computeRollup([td({ tdId: 9 }), td({ tdId: 2 }), td({ tdId: 5 })]);
    expect(rows.map((r) => r.tdId)).toEqual([9, 2, 5]);
  });

  it('handles an empty list', () => {
    expect(computeRollup([])).toEqual([]);
  });
});
