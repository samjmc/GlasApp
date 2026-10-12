/**
 * The match inputs are read once and shared, dropped by every profile write in this process,
 * and re-read after MATCH_INPUTS_TTL_MS for writes made by another process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdeologyProfileRow } from '@shared/schema/quiz';

const fake = vi.hoisted(() => ({ reads: 0, failNext: false }));

vi.mock('../voting', () => ({ listUserVoteVectors: vi.fn(async () => []), questionsWithPositions: vi.fn(async () => []) }));
vi.mock('../stances/repository', () => ({ mappedStancesOn: vi.fn(async () => []) }));
vi.mock('./repository', async () => {
  const { IDEOLOGY_DIMENSIONS } = await import('@shared/ideology');
  const row = (subjectKind: string, subjectId: string): IdeologyProfileRow =>
    ({ subjectKind, subjectId, ...Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, 1])), totalWeight: 3, evidenceCount: 1, computedAt: new Date(0) }) as IdeologyProfileRow;
  return {
    vectorOf: (r: Record<string, number>) => Object.fromEntries(IDEOLOGY_DIMENSIONS.map((d) => [d, r[d]])),
    listActiveTds: async () => [{ id: 1, name: 'A', party: 'Fine Gael', constituency: null, imageUrl: null }],
    listProfiles: async (kind: string) => [kind === 'td' ? row('td', '1') : row('party', 'Fine Gael')],
    // Only the match inputs read the whole summary, so this counts their reads.
    evidenceSummary: async () => {
      fake.reads++;
      if (fake.failNext) {
        fake.failNext = false;
        throw new Error('connection lost');
      }
      return new Map();
    },
    findTd: async () => ({ id: 1, name: 'A', party: 'Fine Gael', constituency: null, imageUrl: null }),
    listTdEvidence: async () => [],
    upsertProfile: async () => {},
  };
});

const service = await import('./service');
const position = { economic: 1, social: 1, cultural: 1, authority: 1, environmental: 1, welfare: 1, globalism: 1, technocratic: 1 };

beforeEach(() => {
  service.forgetMatchInputs();
  fake.reads = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => vi.useRealTimers());

describe('match inputs cache', () => {
  it('reads once for every match and party lookup within the TTL, again after it', async () => {
    const first = await service.matchesFor(position);
    expect(await service.matchesFor(position)).toEqual(first);
    expect(await service.partyProfile('fine gael')).not.toBeNull();
    expect(fake.reads).toBe(1);
    vi.setSystemTime(Date.now() + service.MATCH_INPUTS_TTL_MS);
    await service.matchesFor(position);
    expect(fake.reads).toBe(2);
  });

  it('a TD or party profile write drops them at once', async () => {
    await service.matchesFor(position);
    await service.recomputeTdProfile(1);
    await service.matchesFor(position);
    expect(fake.reads).toBe(2);
    await service.recomputePartyProfile('Fine Gael');
    await service.matchesFor(position);
    expect(fake.reads).toBe(3);
  });

  it('a failed read is not kept', async () => {
    fake.failNext = true;
    await expect(service.matchesFor(position)).rejects.toThrow('connection lost');
    expect((await service.matchesFor(position)).tds).toHaveLength(1);
    expect(fake.reads).toBe(2);
  });
});
