import { describe, expect, it } from 'vitest';
import { computeRollup, type RollupInput } from './rollup';

const td = (over: Partial<RollupInput> & { tdId: number }): RollupInput => ({
  party: 'Fine Gael',
  constituency: 'Dublin Bay North',
  overallElo: 1500,
  newsStories: 1,
  questions: null,
  attendancePct: null,
  committeeAttendancePct: null,
  debateScore: null,
  ...over,
});

describe('computeRollup', () => {
  it('derives pillars from the inputs and stores the overall', () => {
    const [r] = computeRollup([td({ tdId: 1, overallElo: 1700, questions: 200, attendancePct: 95, debateScore: 0.5 })]);
    expect(r.newsScore).toBe(70);
    expect(r.parliamentaryScore).toBe(100);
    expect(r.debateScore).toBe(50);
    expect(r.overallScore).toBe(Math.round(70 * 0.45 + 100 * 0.3 + 50 * 0.25));
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

  it('a TD with no parliamentary or debate data is still scored on news alone', () => {
    const [r] = computeRollup([td({ tdId: 1, overallElo: 1600 })]);
    expect(r.parliamentaryScore).toBeNull();
    expect(r.debateScore).toBeNull();
    expect(r.overallScore).toBe(60);
    expect(r.nationalRank).toBe(1);
  });

  it('ranks nationally, within party and within constituency', () => {
    const rows = computeRollup([
      td({ tdId: 1, overallElo: 1800, party: 'FG', constituency: 'A' }),
      td({ tdId: 2, overallElo: 1700, party: 'FF', constituency: 'A' }),
      td({ tdId: 3, overallElo: 1600, party: 'FG', constituency: 'B' }),
      td({ tdId: 4, overallElo: 1500, party: null, constituency: null }),
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

  it('breaks ties on ELO then id so ranks never collide', () => {
    const rows = computeRollup([
      td({ tdId: 7, overallElo: 1501 }),
      td({ tdId: 3, overallElo: 1501 }),
      td({ tdId: 5, overallElo: 1504 }),
    ]);
    const ranks = rows.map((r) => r.nationalRank).sort();
    expect(ranks).toEqual([1, 2, 3]);
    expect(rows.find((r) => r.tdId === 5)!.nationalRank).toBe(1);
    expect(rows.find((r) => r.tdId === 3)!.nationalRank).toBe(2);
  });

  // Regression: every TD used to score 50 with no evidence at all, because an unscored
  // TD's ELO is the 1500 baseline and 1500 converts to 50.
  it('a TD with no scored article and no other data has no score and no rank', () => {
    const rows = computeRollup([td({ tdId: 1, newsStories: 0 }), td({ tdId: 2, overallElo: 1600 })]);
    const unscored = rows.find((r) => r.tdId === 1)!;
    expect(unscored).toMatchObject({ newsScore: null, overallScore: null, nationalRank: null, partyRank: null, constituencyRank: null });
    expect(rows.find((r) => r.tdId === 2)!.nationalRank).toBe(1);
  });

  it('a TD with no scored article is scored on the pillars that do have data', () => {
    const [r] = computeRollup([td({ tdId: 1, newsStories: 0, questions: 200, attendancePct: 95 })]);
    expect(r.newsScore).toBeNull();
    expect(r.parliamentaryScore).toBe(100);
    expect(r.overallScore).toBe(100);
  });

  it('returns one result per input, in input order', () => {
    const rows = computeRollup([td({ tdId: 9 }), td({ tdId: 2 }), td({ tdId: 5 })]);
    expect(rows.map((r) => r.tdId)).toEqual([9, 2, 5]);
  });

  it('handles an empty list', () => {
    expect(computeRollup([])).toEqual([]);
  });
});
