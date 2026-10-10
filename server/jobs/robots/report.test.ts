import { describe, expect, it } from 'vitest';
import { checks, percentile, type KindCounts } from './report';
import type { RobotKind } from './robot';

const zero: KindCounts = { robots: 0, quizResults: 0, quizPlans: 0, votes: 0, sessions: 0, completedSessions: 0, priorities: 0, userProfiles: 0, users: 0, consented: 0 };

function healthy(): Record<RobotKind, KindCounts> {
  return {
    finisher: { robots: 10, quizResults: 10, quizPlans: 10, votes: 50, sessions: 10, completedSessions: 10, priorities: 10, userProfiles: 10, users: 10, consented: 10 },
    // Refusers have an account and nothing else.
    refuser: { ...zero, robots: 4, users: 4 },
    withdrawer: { ...zero, robots: 2, users: 2 },
    anonymous: { ...zero, robots: 2 },
  };
}

describe('robot report checks', () => {
  it('passes a healthy run', () => {
    expect(checks(healthy(), 0).map((c) => [c.name, c.pass]).filter(([, pass]) => !pass)).toEqual([]);
  });

  it('fails each rule when its data is wrong', () => {
    const cases: Array<[string, (c: Record<RobotKind, KindCounts>) => void]> = [
      ['Refusers stored no opinion and no daily session', (c) => void (c.refuser.votes = 1)],
      ['Refusers stored no opinion and no daily session', (c) => void (c.refuser.sessions = 1)],
      ['Withdrawers have no political data left, and still have an account without consent', (c) => void (c.withdrawer.consented = 1)],
      ['Withdrawers have no political data left, and still have an account without consent', (c) => void (c.withdrawer.users = 1)],
      ['Every finisher has a planned quiz, 3 daily votes, a completed session and a profile', (c) => void (c.finisher.quizPlans = 9)],
      ['Anonymous robots stored nothing', (c) => void (c.anonymous.quizResults = 1)],
    ];
    for (const [name, spoil] of cases) {
      const counts = healthy();
      spoil(counts);
      expect(checks(counts, 0).find((c) => c.name === name)?.pass, name).toBe(false);
    }
    expect(checks(healthy(), 1).find((c) => c.name === 'No 5xx response')?.pass).toBe(false);
  });

  it('reads percentiles from a sorted list', () => {
    const ms = Array.from({ length: 100 }, (_, i) => i + 1);
    expect([percentile(ms, 50), percentile(ms, 95), percentile([], 50)]).toEqual([50, 95, 0]);
  });
});
