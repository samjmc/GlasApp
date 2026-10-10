import { describe, expect, it } from 'vitest';
import { kindOf, parseRobotArgs, robotAddress } from './robots';
import { routeLabel } from './robots/robot';

describe('robot run', () => {
  it('parses its flags and refuses anything else', () => {
    expect(parseRobotArgs([])).toEqual({ robots: 400, concurrency: 20, seed: 1 });
    expect(parseRobotArgs(['--robots', '50', '--seed', '9'])).toEqual({ robots: 50, concurrency: 20, seed: 9 });
    for (const bad of [['--robot', '5'], ['--robots'], ['--robots', '0'], ['--robots', '2.5'], ['--robots', '200000']]) {
      expect(() => parseRobotArgs(bad), bad.join(' ')).toThrow();
    }
  });

  it('mixes 5% anonymous, 10% refusers, 5% withdrawers and 80% finishers', () => {
    const counts: Record<string, number> = {};
    for (let n = 1; n <= 400; n++) counts[kindOf(n)] = (counts[kindOf(n)] ?? 0) + 1;
    expect(counts).toEqual({ anonymous: 20, refuser: 40, withdrawer: 20, finisher: 320 });
  });

  it('gives every robot its own address', () => {
    const addresses = Array.from({ length: 70_000 }, (_, i) => robotAddress(i + 1));
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(robotAddress(1)).toBe('10.0.0.1');
  });

  it('groups calls by route, not by id', () => {
    expect(routeLabel('POST', '/api/votes/questions/123')).toBe('POST /api/votes/questions/:id');
    expect(routeLabel('POST', '/api/daily-session/items/45/vote')).toBe('POST /api/daily-session/items/:id/vote');
    expect(routeLabel('GET', '/api/ideology/me')).toBe('GET /api/ideology/me');
  });
});
