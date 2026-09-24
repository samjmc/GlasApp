/**
 * The whole sync against a real Postgres, fed by a fake Oireachtas built from the real
 * 2025-06-25 samples. Proves the SQL (upserts, relinking, windowed counts, party lines),
 * idempotence, and that the scoring inputs land on `tds`.
 *
 * Skipped unless TEST_DATABASE_URL is set. It uses its OWN database, `<db>_parliament`
 * (created if missing), and rebuilds the `politics` schema there from every migration:
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/parliament/sync.integration.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import type { OireachtasClient, RosterMember } from './client';
import type { RawDivision } from './parse';

const parliamentUrl = testDatabaseUrl('parliament');
const run = describe.skipIf(!parliamentUrl);

if (parliamentUrl) {
  process.env.DATABASE_URL = parliamentUrl;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const FIXTURES = path.join(__dirname, '__fixtures__');
const [baseDivision] = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'divisions-2025-06-25.json'), 'utf8')) as RawDivision[];
const transcript = fs.readFileSync(path.join(FIXTURES, 'transcript-2025-06-25.xml'), 'utf8');

const codes = (d: RawDivision, lobby: 'taVotes' | 'nilVotes') => (d.tallies?.[lobby]?.members ?? []).map((m) => m.member!.memberCode!);
const [A, B, Y] = codes(baseDivision, 'taVotes');
const [C] = codes(baseDivision, 'nilVotes');
const Z = codes(baseDivision, 'nilVotes')[1];
const CHAIR = 'Verona-Murphy.D.2020-02-08';
const NO_QUESTIONS = B;

/** 12 divisions from the one real record; Y misses the first three. */
function divisions(): RawDivision[] {
  return Array.from({ length: 12 }, (_, k) => {
    const d = structuredClone(baseDivision);
    d.voteId = `vote_${k + 1}`;
    d.date = `2025-06-${String(10 + k).padStart(2, '0')}`;
    d.uri = `${baseDivision.uri}-${k + 1}`;
    if (k < 3) {
      const ta = d.tallies!.taVotes!;
      ta.members = ta.members!.filter((m) => m.member!.memberCode !== Y);
      ta.tally = ta.members.length;
    }
    return d;
  });
}

function member(memberCode: string, party: string | null, extra: Partial<RosterMember> = {}): RosterMember {
  return { memberCode, fullName: memberCode.split('.')[0].replace(/-/g, ' '), party, constituency: 'Wexford', memberSince: '2024-11-29', isPresiding: false, ...extra };
}

interface FakeOptions {
  days?: Array<{ date: string; xmlUri: string | null }>;
  failQuestionsFor?: string[];
}

function fakeClient(roster: RosterMember[], opts: FakeOptions = {}): OireachtasClient {
  const days = opts.days ?? [{ date: '2025-06-25', xmlUri: 'fixture.xml' }];
  const failing = new Set([NO_QUESTIONS, ...(opts.failQuestionsFor ?? [])]);
  return {
    roster: async () => roster,
    divisions: async () => divisions(),
    debateDays: async (from: string, to: string) => days.filter((d) => d.date >= from && d.date <= to).map((d) => ({ ...d })),
    transcript: async () => transcript,
    questionCounts: async (code: string) => {
      if (failing.has(code)) throw new Error('API down for this member');
      return { oral: 15, written: 77 };
    },
  } as unknown as OireachtasClient;
}

// Each test runs one or two whole syncs against Postgres: ~2–5 s alone, more when vitest
// runs every file at once. The 5 s default failed under exactly that load.
run('parliament sync against Postgres', { timeout: 60_000 }, () => {
  let dbmod: typeof import('../db');
  let parliament: typeof import('./index');
  let scoring: typeof import('../scoring');
  const roster = [member(A, 'Party A'), member(B, 'Party A'), member(Y, 'Party A'), member(C, 'Party A'), member(CHAIR, 'Independent', { isPresiding: true })];
  const tdId = async (code: string) => (await dbmod.pool.query('select id from politics.tds where member_code = $1', [code])).rows[0]?.id as number;

  beforeAll(async () => {
    await ensureDatabase(parliamentUrl!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    parliament = await import('./index');
    scoring = await import('../scoring');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('ingests the roster, divisions and a transcript', async () => {
    const s = await parliament.runSync({ client: fakeClient(roster), today: '2025-06-30', log: () => {} });
    expect(s.roster).toMatchObject({ members: 5, inserted: 5 });
    expect(s.divisions.ingested).toBe(12);
    expect(s.debates).toMatchObject({ days: 1, sections: 2, speeches: 33, failedDays: [] });
    expect(s.statsRows).toBe(5);
    expect(s.questionsFetched).toBe(4);
    const { rows } = await dbmod.pool.query('select count(*)::int n from politics.division_votes');
    expect(rows[0].n).toBe(12 * 146 - 3);
  });

  it('measures attendance inside the window, and NULL for the chair', async () => {
    const a = await parliament.repository.tdSummary(await tdId(A));
    const y = await parliament.repository.tdSummary(await tdId(Y));
    const chair = await parliament.repository.tdSummary(await tdId(CHAIR));
    expect(a).toMatchObject({ votesCast: 12, divisionsEligible: 12, attendancePct: 100, questionsOral: 15, questionsWritten: 77 });
    expect(y).toMatchObject({ votesCast: 9, attendancePct: 75 });
    expect(chair).toMatchObject({ isPresiding: true, votesCast: 0, attendancePct: null });
  });

  it('a failed question count stays NULL, never 0', async () => {
    expect(await parliament.repository.tdSummary(await tdId(NO_QUESTIONS))).toMatchObject({ questionsOral: null, questionsWritten: null });
  });

  it('judges each vote against the party majority', async () => {
    const c = await tdId(C);
    const votes = await parliament.repository.votesOf(c);
    expect(votes).toHaveLength(12);
    expect(votes.every((v) => v.vote === 'nil' && v.partyMajority === 'ta' && v.withParty === false)).toBe(true);
    expect(await parliament.repository.votesOf(c, { againstParty: true, limit: 5 })).toHaveLength(5);
    expect(await parliament.repository.votesOf(c, { divisionId: 'dail-34-2025-06-10-vote_1' })).toHaveLength(1);
    expect((await parliament.repository.tdSummary(c))?.partyLinePct).toBe(0);
    expect((await parliament.repository.tdSummary(await tdId(A)))?.partyLinePct).toBe(100);
    expect((await parliament.repository.tdSummary(await tdId(CHAIR)))?.partyLinePct).toBeNull();
  });

  it('serves division and debate reads', async () => {
    const list = await parliament.repository.listDivisions(5, 0);
    expect(list.total).toBe(12);
    expect(list.rows[0].id).toBe('dail-34-2025-06-21-vote_12');

    const detail = await parliament.repository.divisionDetail('dail-34-2025-06-21-vote_12');
    expect(detail?.votes).toHaveLength(146);
    expect(detail?.byParty.reduce((n, p) => n + p.ta + p.nil + p.staon, 0)).toBe(146);
    expect(detail?.byParty.find((p) => p.party === 'Party A')).toMatchObject({ ta: 3, nil: 1 });

    const debates = await parliament.repository.listDebates(10, 0);
    expect(debates.total).toBe(2);
    // The list's speaker count must agree with the detail view (it once read 0 for every row).
    const listed19 = debates.rows.find((r) => r.id === 'dail-2025-06-25-dbsect_19');
    expect(listed19?.speakerCount).toBeGreaterThan(0);
    const sect19 = await parliament.repository.debateDetail('dail-2025-06-25-dbsect_19');
    expect(sect19?.speechCount).toBe(32);
    // The Ceann Comhairle's three speeches in this section are from the chair, not debate.
    expect(sect19?.speakers.reduce((n, s) => n + s.speeches, 0)).toBe(29);
    expect(sect19?.speakers.some((s) => s.memberCode === 'Verona-Murphy.D.2020-02-08')).toBe(false);
  });

  it('ranks the leaderboard over measurable TDs only', async () => {
    const top = await parliament.repository.leaderboard('attendance', 'desc', 10);
    expect(top.map((r) => r.value)).toEqual([100, 100, 100, 75]);
    expect(top.some((r) => r.name.startsWith('Verona'))).toBe(false);
    // One sitting day is below the participation minimum, so nobody is measurable yet.
    expect(await parliament.repository.leaderboard('participation', 'desc', 10)).toEqual([]);
    expect((await parliament.repository.parties()).find((p) => p.party === 'Party A')).toMatchObject({ members: 4, avgAttendancePct: 93.8 });
  });

  it('feeds the scoring pillar from the same numbers', async () => {
    const found = await scoring.repository.findById(await tdId(A));
    expect(found?.td.attendancePct).toBe(100);
    expect(found?.score?.parliamentaryScore).not.toBeNull();
  });

  it('is idempotent, and links a member once they join the roster', async () => {
    const before = await parliament.repository.divisionDetail('dail-34-2025-06-21-vote_12');
    expect(before?.votes.find((v) => v.memberCode === Z)?.tdId).toBeNull();

    const s = await parliament.runSync({ client: fakeClient([...roster, member(Z, 'Party B')]), today: '2025-06-30', log: () => {} });
    expect(s.roster).toMatchObject({ inserted: 1 });
    const { rows } = await dbmod.pool.query('select count(*)::int n from politics.division_votes');
    expect(rows[0].n).toBe(12 * 146 - 3);
    const { rows: speeches } = await dbmod.pool.query('select count(*)::int n from politics.debate_speeches');
    expect(speeches[0].n).toBe(33);

    const after = await parliament.repository.divisionDetail('dail-34-2025-06-21-vote_12');
    expect(after?.votes.find((v) => v.memberCode === Z)?.tdId).toBe(await tdId(Z));
    expect((await parliament.repository.tdSummary(await tdId(Z)))?.votesCast).toBe(12);
  });

  it('records where each feed got to', async () => {
    const feeds = (await parliament.repository.syncStatus()).map((f) => [f.feed, f.throughDate, f.failures]);
    expect(feeds).toEqual([
      ['debates', '2025-06-30', {}],
      ['divisions', '2025-06-30', {}],
      ['roster', '2025-06-30', {}],
    ]);
  });

  it('a failed question fetch keeps the last good counts', async () => {
    await parliament.runSync({ client: fakeClient(roster, { failQuestionsFor: [A] }), today: '2025-06-30', log: () => {} });
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ questionsOral: 15, questionsWritten: 77 });
  });

  it('records a failed day, keeps going, and retries it on a later run', async () => {
    const pending = { date: '2025-06-26', xmlUri: null };
    const first = await parliament.runSync({
      client: fakeClient(roster, { days: [pending, { date: '2025-06-25', xmlUri: 'fixture.xml' }] }),
      today: '2025-06-30',
      log: () => {},
    });
    expect(first.debates.failedDays).toEqual(['2025-06-26']);
    expect(first.debates.speeches).toBe(33);
    const debates = async () => (await parliament.repository.syncStatus()).find((f) => f.feed === 'debates');
    expect(await debates()).toMatchObject({ throughDate: '2025-06-30', failures: { '2025-06-26': 1 } });

    // A month on, the day is outside the overlap window; it is retried from the failure map.
    const later = await parliament.runSync({
      client: fakeClient(roster, { days: [{ date: '2025-06-26', xmlUri: 'published.xml' }] }),
      today: '2025-07-30',
      log: () => {},
    });
    expect(later.debates).toMatchObject({ days: 1, failedDays: [] });
    expect(await debates()).toMatchObject({ throughDate: '2025-07-30', failures: {} });
    const { rows } = await dbmod.pool.query(`select count(*)::int n from politics.debate_sections where date = '2025-06-26'`);
    expect(rows[0].n).toBe(2);
  });
});
