import { describe, expect, it } from 'vitest';
import { computePartyScores } from './party';

describe('computePartyScores', () => {
  it('averages member ELO per party and converts once', () => {
    const out = computePartyScores([
      { party: 'FG', overallElo: 1600 },
      { party: 'FG', overallElo: 1400 },
      { party: 'SF', overallElo: 1700 },
    ]);
    expect(out).toEqual([
      { party: 'SF', memberCount: 1, avgElo: 1700, overallScore: 70 },
      { party: 'FG', memberCount: 2, avgElo: 1500, overallScore: 50 },
    ]);
  });

  it('skips members with no party and sorts ties by name', () => {
    const out = computePartyScores([
      { party: null, overallElo: 1900 },
      { party: 'B', overallElo: 1500 },
      { party: 'A', overallElo: 1500 },
    ]);
    expect(out.map((p) => p.party)).toEqual(['A', 'B']);
  });

  it('is empty for no input', () => {
    expect(computePartyScores([])).toEqual([]);
  });
});
