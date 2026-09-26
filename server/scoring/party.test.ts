import { describe, expect, it } from 'vitest';
import { computePartyScores } from './party';

describe('computePartyScores', () => {
  it('is the mean of ranked members’ overall scores, and counts every member', () => {
    const out = computePartyScores([
      { party: 'FG', overallScore: 70 },
      { party: 'FG', overallScore: 51 },
      { party: 'FG', overallScore: null },
      { party: 'SF', overallScore: 80 },
    ]);
    expect(out).toEqual([
      { rank: 1, party: 'SF', memberCount: 1, rankedCount: 1, overallScore: 80 },
      { rank: 2, party: 'FG', memberCount: 3, rankedCount: 2, overallScore: 61 },
    ]);
  });

  // An unranked member (the chair, or fewer than two measurable components) says nothing
  // about the party, so counting them as 0 would drag it down.
  it('gives a party with no ranked member no score and no rank, and lists it last', () => {
    const out = computePartyScores([
      { party: 'Green Party', overallScore: null },
      { party: 'FG', overallScore: 40 },
    ]);
    expect(out).toEqual([
      { rank: 1, party: 'FG', memberCount: 1, rankedCount: 1, overallScore: 40 },
      { rank: null, party: 'Green Party', memberCount: 1, rankedCount: 0, overallScore: null },
    ]);
  });

  it('shares ranks on ties, sorts ties by name, and skips members with no party', () => {
    const out = computePartyScores([
      { party: null, overallScore: 99 },
      { party: 'C', overallScore: 40 },
      { party: 'B', overallScore: 60 },
      { party: 'A', overallScore: 60 },
    ]);
    expect(out.map((p) => [p.rank, p.party])).toEqual([
      [1, 'A'],
      [1, 'B'],
      [3, 'C'],
    ]);
  });

  it('is empty for no input', () => {
    expect(computePartyScores([])).toEqual([]);
  });
});
