import { describe, expect, it } from 'vitest';
import { computePartyScores } from './party';

describe('computePartyScores', () => {
  it('averages scored members’ ELO per party and converts once', () => {
    const out = computePartyScores([
      { party: 'FG', overallElo: 1600, newsStories: 3 },
      { party: 'FG', overallElo: 1400, newsStories: 1 },
      { party: 'SF', overallElo: 1700, newsStories: 2 },
    ]);
    expect(out).toEqual([
      { party: 'SF', memberCount: 1, avgElo: 1700, overallScore: 70 },
      { party: 'FG', memberCount: 2, avgElo: 1500, overallScore: 50 },
    ]);
  });

  // Regression: an unscored member sits at the 1500 baseline, so counting them pulled every
  // party toward 50, and a party with no scored member at all got exactly 50.
  it('leaves out never-scored members, and gives a party with none no aggregate', () => {
    const out = computePartyScores([
      { party: 'FG', overallElo: 1700, newsStories: 1 },
      { party: 'FG', overallElo: 1500, newsStories: 0 },
      { party: 'Green Party', overallElo: 1500, newsStories: 0 },
    ]);
    expect(out).toEqual([{ party: 'FG', memberCount: 1, avgElo: 1700, overallScore: 70 }]);
  });

  it('skips members with no party and sorts ties by name', () => {
    const out = computePartyScores([
      { party: null, overallElo: 1900, newsStories: 1 },
      { party: 'B', overallElo: 1500, newsStories: 1 },
      { party: 'A', overallElo: 1500, newsStories: 1 },
    ]);
    expect(out.map((p) => p.party)).toEqual(['A', 'B']);
  });

  it('is empty for no input', () => {
    expect(computePartyScores([])).toEqual([]);
  });
});
