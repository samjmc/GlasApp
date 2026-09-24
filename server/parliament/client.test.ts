/**
 * The client's request shapes are the whole point of this rebuild: the previous code
 * filtered with `member=`, which the API ignores. These tests pin the parameters.
 */
import { describe, expect, it } from 'vitest';
import { OireachtasClient, toRosterMember, type RawMember } from './client';

function fakeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const urls: string[] = [];
  const fetcher = async (url: string) => {
    urls.push(url);
    const next = responses.shift() ?? { status: 200, body: {} };
    return new Response(typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? {}), { status: next.status });
  };
  return { urls, client: new OireachtasClient(fetcher, 0) };
}

const params = (url: string) => new URL(url).searchParams;

describe('OireachtasClient', () => {
  it('filters questions by member_id (the full URI) and qtype, never member=', async () => {
    const { urls, client } = fakeFetch([
      { status: 200, body: { head: { counts: { questionCount: 15 } } } },
      { status: 200, body: { head: { counts: { questionCount: 77 } } } },
    ]);
    const counts = await client.questionCounts('Seán-Crowe.D.2002-06-06', '2024-11-29', '2025-06-30');
    expect(counts).toEqual({ oral: 15, written: 77 });
    for (const url of urls) {
      expect(params(url).has('member')).toBe(false);
      expect(params(url).get('member_id')).toBe('https://data.oireachtas.ie/ie/oireachtas/member/id/Seán-Crowe.D.2002-06-06');
    }
    expect(urls.map((u) => params(u).get('qtype'))).toEqual(['oral', 'written']);
  });

  it('throws rather than reading a missing count as 0', async () => {
    const { client } = fakeFetch([{ status: 200, body: { head: {} } }]);
    await expect(client.questionCounts('X.D.2020-01-01', '2024-01-01', '2024-12-31')).rejects.toThrow();
  });

  it('restricts divisions and debates to the Dáil chamber, and pages divisions', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ division: { voteId: `vote_${i}` } }));
    const { urls, client } = fakeFetch([
      { status: 200, body: { results: page } },
      { status: 200, body: { results: [{ division: { voteId: 'last' } }] } },
      { status: 200, body: { results: [{ debateRecord: { date: '2025-06-25', formats: { xml: { uri: 'x.xml' } } } }, { debateRecord: { date: '2025-06-26', formats: { xml: null } } }] } },
    ]);
    expect(await client.divisions('2024-11-29', '2025-06-30')).toHaveLength(1001);
    // A day listed before its transcript exists is kept, with no URL, so the sync can retry it.
    expect(await client.debateDays('2025-06-25', '2025-06-26')).toEqual([
      { date: '2025-06-25', xmlUri: 'x.xml' },
      { date: '2025-06-26', xmlUri: null },
    ]);
    for (const url of urls) {
      expect(params(url).get('chamber_type')).toBe('house');
      expect(params(url).get('chamber')).toBe('dail');
    }
    expect(urls.slice(0, 2).map((u) => params(u).get('skip'))).toEqual(['0', '1000']);
  });

  it('retries a 5xx and gives up at once on a 4xx', async () => {
    const retry = fakeFetch([{ status: 503 }, { status: 502 }, { status: 200, body: { results: [] } }]);
    expect(await retry.client.divisions('2025-01-01', '2025-01-02')).toEqual([]);
    expect(retry.urls).toHaveLength(3);

    const notFound = fakeFetch([{ status: 404 }, { status: 200, body: { results: [] } }]);
    await expect(notFound.client.divisions('2025-01-01', '2025-01-02')).rejects.toThrow(/404/);
    expect(notFound.urls).toHaveLength(1);
  });
});

type Seat = NonNullable<RawMember['memberships']>[number]['membership'];

describe('toRosterMember', () => {
  const member = (over: Partial<Seat> = {}): RawMember => ({
    memberCode: 'Verona-Murphy.D.2020-02-08',
    fullName: ' Verona Murphy ',
    memberships: [
      { membership: { house: { houseCode: 'dail', houseNo: '33' }, dateRange: { start: '2020-02-08', end: '2024-11-08' } } },
      {
        membership: {
          house: { houseCode: 'dail', houseNo: '34' },
          dateRange: { start: '2024-11-29', end: null },
          parties: [
            { party: { showAs: 'Aontú', dateRange: { start: '2024-11-29', end: '2025-03-01' } } },
            { party: { showAs: 'Independent', dateRange: { start: '2025-03-01', end: null } } },
          ],
          represents: [{ represent: { showAs: 'Wexford' } }],
          offices: [{ office: { officeName: { showAs: 'Ceann Comhairle' }, dateRange: { start: '2024-12-18', end: null } } }],
          ...over,
        },
      },
    ],
  });

  it('takes the current seat, the current party (not the first listed) and the window start', () => {
    expect(toRosterMember(member())).toEqual({
      memberCode: 'Verona-Murphy.D.2020-02-08',
      fullName: 'Verona Murphy',
      party: 'Independent',
      constituency: 'Wexford',
      memberSince: '2024-11-29',
      isPresiding: true,
    });
  });

  it('detects the chair from a current office only', () => {
    const former = member({ offices: [{ office: { officeName: { showAs: 'Ceann Comhairle' }, dateRange: { start: '2024-12-18', end: '2025-01-01' } } }] });
    expect(toRosterMember(former)?.isPresiding).toBe(false);
  });

  it('is NULL for a member whose seat in the current Dáil has ended', () => {
    expect(toRosterMember(member({ dateRange: { start: '2024-11-29', end: '2025-10-01' } }))).toBeNull();
  });
});
