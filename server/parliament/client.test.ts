/**
 * The client's request shapes are the whole point of this rebuild: the previous code
 * filtered with `member=`, which the API ignores. These tests pin the parameters.
 */
import { describe, expect, it } from 'vitest';
import { OireachtasClient, officeTypeOf, toRosterMember, type RawMember } from './client';

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
  it('pages every question in a window and never filters with member=', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ question: { questionType: 'written', date: '2026-06-01', by: { memberCode: `M${i}` } } }));
    const { urls, client } = fakeFetch([
      { status: 200, body: { head: { counts: { questionCount: 1500 } } } },
      { status: 200, body: { results: page } },
      { status: 200, body: { results: page.slice(0, 500) } },
    ]);
    expect(await client.questions('2026-06-01', '2026-06-30')).toHaveLength(1500);
    expect(urls.slice(1).map((u) => params(u).get('skip'))).toEqual(['0', '1000']);
    for (const url of urls) expect(params(url).has('member')).toBe(false);
  });

  it('splits a window the API cannot page (10,000+ results) and throws rather than reading a missing count as 0', async () => {
    const { urls, client } = fakeFetch([
      { status: 200, body: { head: { counts: { questionCount: 10000 } } } }, // whole window: too big
      { status: 200, body: { head: { counts: { questionCount: 2 } } } }, // first half
      { status: 200, body: { results: [{ question: {} }, { question: {} }] } },
      { status: 200, body: { head: { counts: { questionCount: 1 } } } }, // second half
      { status: 200, body: { results: [{ question: {} }] } },
    ]);
    expect(await client.questions('2026-01-01', '2026-01-31')).toHaveLength(3);
    const windows = urls.filter((u) => params(u).get('limit') === '1').map((u) => `${params(u).get('date_start')}..${params(u).get('date_end')}`);
    expect(windows).toEqual(['2026-01-01..2026-01-31', '2026-01-01..2026-01-16', '2026-01-17..2026-01-31']);

    const { client: broken } = fakeFetch([{ status: 200, body: { head: {} } }]);
    await expect(broken.questions('2026-01-01', '2026-01-31')).rejects.toThrow(/No question count/);
  });

  it('throws when the pages hold fewer questions than the count, rather than store a short month', async () => {
    const { client } = fakeFetch([
      { status: 200, body: { head: { counts: { questionCount: 3 } } } },
      { status: 200, body: { results: [{ question: {} }, { question: {} }] } },
    ]);
    await expect(client.questions('2026-01-01', '2026-01-31')).rejects.toThrow(/Read 2 of 3/);
  });

  it('keeps only Dáil and joint committee sittings, with their transcript', async () => {
    const { urls, client } = fakeFetch([
      {
        status: 200,
        body: {
          results: [
            { debateRecord: { uri: 'u1', date: '2026-06-11', house: { uri: 'https://x/committee/dail/34/pac', showAs: 'PAC', houseCode: 'dail' }, formats: { xml: { uri: 'a.xml' } } } },
            { debateRecord: { uri: 'u2', date: '2026-06-11', house: { uri: 'https://x/committee/seanad/27/seanad_cppo', showAs: 'CPPO', houseCode: 'seanad' }, formats: { xml: { uri: 'b.xml' } } } },
            { debateRecord: { uri: 'u3', date: '2026-06-12', house: { uri: 'https://x/committee/dail/34/health', showAs: 'Health', houseCode: 'dail' }, formats: { xml: null } } },
          ],
        },
      },
    ]);
    expect(await client.committeeSittings('2026-06-11', '2026-06-12')).toEqual([
      { uri: 'u1', date: '2026-06-11', committeeUri: 'https://x/committee/dail/34/pac', committeeName: 'PAC', xmlUri: 'a.xml' },
      { uri: 'u3', date: '2026-06-12', committeeUri: 'https://x/committee/dail/34/health', committeeName: 'Health', xmlUri: null },
    ]);
    expect(params(urls[0]).get('chamber_type')).toBe('committee');
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
          committees: [
            {
              uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_on_procedure',
              committeeName: [{ nameEn: 'Committee on Procedure' }],
              committeeType: ['Standing'],
              role: { title: 'Cathaoirleach' },
              memberDateRange: { start: '2024-12-18 00:00:00+00:00', end: null },
            },
            {
              uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/business_committee',
              committeeName: [{ nameEn: 'Business Committee' }],
              committeeType: ['Standing'],
              role: { title: '' },
              memberDateRange: { start: '2024-12-18 00:00:00+00:00', end: '2025-06-01 00:00:00+00:00' },
            },
            { uri: 'https://x/no-name', memberDateRange: { start: '2025-01-01' } },
          ],
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
      offices: [{ title: 'Ceann Comhairle', since: '2024-12-18' }],
      officeHistory: [{ title: 'Ceann Comhairle', type: 'ceann_comhairle', start: '2024-12-18', end: null }],
      committees: [
        { uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_on_procedure', name: 'Committee on Procedure', committeeType: 'Standing', role: 'Cathaoirleach', start: '2024-12-18', end: null },
        { uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/business_committee', name: 'Business Committee', committeeType: 'Standing', role: null, start: '2024-12-18', end: '2025-06-01' },
      ],
    });
  });

  it('lists only current offices, and every office with its dates in the history', () => {
    const minister = member({
      offices: [
        { office: { officeName: { showAs: 'Minister for Health' }, dateRange: { start: '2025-01-23', end: null } } },
        { office: { officeName: { showAs: 'Minister of State' }, dateRange: { start: '2024-12-01', end: '2025-01-22' } } },
      ],
    });
    expect(toRosterMember(minister)?.offices).toEqual([{ title: 'Minister for Health', since: '2025-01-23' }]);
    expect(toRosterMember(minister)?.isPresiding).toBe(false);
    expect(toRosterMember(minister)?.officeHistory).toEqual([
      { title: 'Minister for Health', type: 'cabinet', start: '2025-01-23', end: null },
      { title: 'Minister of State', type: 'minister_of_state', start: '2024-12-01', end: '2025-01-22' },
    ]);
  });

  it('types every office title the 34th Dáil uses', () => {
    expect(officeTypeOf('Taoiseach')).toBe('cabinet');
    expect(officeTypeOf('Tánaiste')).toBe('cabinet');
    expect(officeTypeOf('Minister for Finance')).toBe('cabinet');
    expect(officeTypeOf('Minister of State at the Department of Justice, Home Affairs and Migration')).toBe('minister_of_state');
    expect(officeTypeOf('Minister of State at the Department of the Taoiseach (Government Chief Whip)')).toBe('minister_of_state');
    expect(officeTypeOf('Ceann Comhairle')).toBe('ceann_comhairle');
    expect(officeTypeOf('Leas-Cheann Comhairle')).toBe('leas_cheann_comhairle');
    expect(officeTypeOf('Attorney General')).toBe('other');
  });

  it('detects the chair from a current office only', () => {
    const former = member({ offices: [{ office: { officeName: { showAs: 'Ceann Comhairle' }, dateRange: { start: '2024-12-18', end: '2025-01-01' } } }] });
    expect(toRosterMember(former)?.isPresiding).toBe(false);
  });

  it("keeps only this Dáil's committees held during this seat, and drops a role that has ended", () => {
    const committee = (uri: string, start: string, end: string | null, role: { title: string; dateRange?: { start: string; end: string | null } } | null = null) => ({
      uri,
      committeeName: [{ nameEn: uri.split('/').pop()! }],
      committeeType: ['Standing'],
      role,
      memberDateRange: { start, end },
    });
    const m = member({
      committees: [
        committee('https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/kept', '2024-12-18', null, { title: 'Cathaoirleach', dateRange: { start: '2024-12-18', end: '2025-05-01' } }),
        committee('https://data.oireachtas.ie/ie/oireachtas/committee/seanad/27/seanad_only', '2024-12-18', null),
        committee('https://data.oireachtas.ie/ie/oireachtas/committee/dail/33/last_term', '2020-06-01', null),
        committee('https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/ended_before_seat', '2024-11-01', '2024-11-29'),
      ],
    });
    expect(toRosterMember(m)?.committees).toEqual([
      { uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/kept', name: 'kept', committeeType: 'Standing', role: null, start: '2024-12-18', end: null },
    ]);
  });

  it('is NULL for a member whose seat in the current Dáil has ended', () => {
    expect(toRosterMember(member({ dateRange: { start: '2024-11-29', end: '2025-10-01' } }))).toBeNull();
  });
});
