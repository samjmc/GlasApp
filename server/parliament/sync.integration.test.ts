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
import type { RawBill, RawDivision, RawQuestion } from './parse';

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
  return {
    memberCode,
    fullName: memberCode.split('.')[0].replace(/-/g, ' '),
    party,
    constituency: 'Wexford',
    memberSince: '2024-11-29',
    isPresiding: false,
    offices: [],
    committees: [],
    ...extra,
  };
}

// --- Committees: 12 sittings of the PAC. A chairs it and attends all; B attends every
// other one; C joins on 16 June (6 eligible sittings, below the minimum); Y is no member.
const PAC_URI = 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_of_public_accounts';
const PAC_DAYS = Array.from({ length: 12 }, (_, k) => `2025-06-${String(10 + k).padStart(2, '0')}`);
const pac = (role: string | null, start: string) => [{ uri: PAC_URI, name: 'Committee of Public Accounts', committeeType: 'Standing', role, start, end: null }];
function presentOn(date: string): string[] {
  const k = PAC_DAYS.indexOf(date);
  return [A, ...(k % 2 === 0 ? [B] : []), C];
}
function rollCallXml(present: string[]): string {
  const refs = present.map((c, i) => `<TLCPerson eId="p${i}" href="/ie/oireachtas/member/id/${c}" showAs="${c}"/>`).join('');
  const roll = present.map((_, i) => `<person refersTo="#p${i}">Deputy ${i}</person>`).join('');
  return `<akomaNtoso><debate><meta><references>${refs}</references></meta><debateBody><debateSection eId="dbsect_1"><rollCall><summary>MEMBERS PRESENT:</summary>${roll}</rollCall></debateSection></debateBody></debate></akomaNtoso>`;
}

// --- Bills: the three real ones, plus one A sponsors, taken in the debate that holds all
// 12 fixture divisions.
const realBills = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'bills-sample.json'), 'utf8')) as RawBill[];
const billByA: RawBill = {
  ...structuredClone(realBills[2]),
  uri: 'https://data.oireachtas.ie/ie/oireachtas/bill/2025/999',
  billNo: '999',
  billYear: '2025',
  shortTitleEn: 'Test Bill 2025',
  sponsors: [{ sponsor: { isPrimary: true, by: { showAs: 'A', uri: `https://data.oireachtas.ie/ie/oireachtas/member/id/${A}` } } }],
  // A committee stage names the committee: the live API has chamber labels up to 104
  // characters, which broke a varchar(60) on the first real run.
  stages: [{ event: { showAs: 'Committee Stage', dates: [{ date: '2025-06-20' }], chamber: { showAs: 'Select Committee on Justice, Home Affairs and Migration, and the Implementation of the Good Friday Agreement' } } }],
  debates: [{ chamber: { showAs: 'Dáil Éireann', uri: 'https://data.oireachtas.ie/ie/oireachtas/def/house/dail' }, date: '2025-06-25', debateSectionId: 'dbsect_19', showAs: 'Test Bill 2025: Second Stage' }],
};

// --- Questions: A asks 15 oral (Taoiseach) and 77 written (50 Health, 27 Finance) in June;
// C asks 3 in January; the chair 2 in March; B asks none.
const q = (code: string, date: string, type: 'oral' | 'written', department: string, n: number): RawQuestion[] =>
  Array.from({ length: n }, () => ({ date, questionType: type, by: { memberCode: code }, to: { showAs: department } }));
const QUESTIONS: RawQuestion[] = [
  ...q(A, '2025-06-12', 'oral', 'Taoiseach', 15),
  ...q(A, '2025-06-12', 'written', 'Health', 50),
  ...q(A, '2025-06-13', 'written', 'Finance', 27),
  ...q(C, '2025-01-15', 'written', 'Transport', 3),
  ...q(CHAIR, '2025-03-03', 'written', 'Health', 2),
];

interface FakeOptions {
  days?: Array<{ date: string; xmlUri: string | null }>;
  /** Months (first days) whose question fetch throws. */
  failQuestionMonths?: string[];
}

function fakeClient(roster: RosterMember[], opts: FakeOptions = {}): OireachtasClient {
  const days = opts.days ?? [{ date: '2025-06-25', xmlUri: 'fixture.xml' }];
  const failing = new Set(opts.failQuestionMonths ?? []);
  return {
    roster: async () => roster,
    divisions: async () => divisions(),
    debateDays: async (from: string, to: string) => days.filter((d) => d.date >= from && d.date <= to).map((d) => ({ ...d })),
    committeeSittings: async (from: string, to: string) =>
      PAC_DAYS.filter((d) => d >= from && d <= to).map((date) => ({
        uri: `https://data.oireachtas.ie/akn/ie/debateRecord/committee_of_public_accounts/${date}/debate/main`,
        date,
        committeeUri: PAC_URI,
        committeeName: 'COMMITTEE OF PUBLIC ACCOUNTS',
        xmlUri: `pac-${date}.xml`,
      })),
    transcript: async (xmlUri: string) => (xmlUri.startsWith('pac-') ? rollCallXml(presentOn(xmlUri.slice(4, 14))) : transcript),
    bills: async () => [...structuredClone(realBills), structuredClone(billByA)],
    questions: async (from: string, to: string) => {
      if (failing.has(`${from.slice(0, 7)}-01`)) throw new Error('API down for this month');
      return QUESTIONS.filter((x) => x.date! >= from && x.date! <= to);
    },
  } as unknown as OireachtasClient;
}

// Each test runs one or two whole syncs against Postgres: ~2–5 s alone, more when vitest
// runs every file at once. The 5 s default failed under exactly that load.
run('parliament sync against Postgres', { timeout: 60_000 }, () => {
  let dbmod: typeof import('../db');
  let parliament: typeof import('./index');
  let scoring: typeof import('../scoring');
  const roster = [
    member(A, 'Party A', { committees: pac('Cathaoirleach', '2024-12-01') }),
    member(B, 'Party A', { committees: pac(null, '2024-12-01') }),
    member(Y, 'Party A'),
    member(C, 'Party A', { committees: pac(null, '2025-06-16') }),
    member(CHAIR, 'Independent', { isPresiding: true, offices: [{ title: 'Ceann Comhairle', since: '2024-12-18' }] }),
  ];
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
    expect(s.committees).toMatchObject({ days: 12, sittings: 12, failedDays: [] });
    expect(s.bills.ingested).toBe(4);
    // Nov 2024 .. Jun 2025.
    expect(s.questions).toMatchObject({ months: 8, questions: 97, failedMonths: [] });
    expect(s.roster.committeeMemberships).toBe(3);
    expect(s.statsRows).toBe(5);
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

  it('a TD who asked no questions reads 0, once questions have been ingested', async () => {
    expect(await parliament.repository.tdSummary(await tdId(B))).toMatchObject({ questionsOral: 0, questionsWritten: 0 });
    expect(await parliament.repository.tdSummary(await tdId(C))).toMatchObject({ questionsOral: 0, questionsWritten: 3 });
  });

  it('shows what each TD asks about, busiest department first', async () => {
    expect(await parliament.repository.tdQuestionTopics(await tdId(A))).toEqual([
      { department: 'Health', oral: 0, written: 50 },
      { department: 'Finance', oral: 0, written: 27 },
      { department: 'Taoiseach', oral: 15, written: 0 },
    ]);
  });

  it('measures committee attendance inside each membership, NULL below the minimum', async () => {
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ committeeSittingsEligible: 12, committeeSittingsAttended: 12, committeeAttendancePct: 100 });
    expect(await parliament.repository.tdSummary(await tdId(B))).toMatchObject({ committeeSittingsEligible: 12, committeeSittingsAttended: 6, committeeAttendancePct: 50 });
    // C joined on 16 June: only 6 sittings count, all attended, and 6 is below the minimum.
    expect(await parliament.repository.tdSummary(await tdId(C))).toMatchObject({ committeeSittingsEligible: 6, committeeSittingsAttended: 6, committeeAttendancePct: null });
    expect(await parliament.repository.tdSummary(await tdId(Y))).toMatchObject({ committeeSittingsEligible: 0, committeeAttendancePct: null });
    expect(await parliament.repository.tdCommittees(await tdId(A))).toEqual([
      expect.objectContaining({ committeeId: 'committee_of_public_accounts', role: 'Cathaoirleach', end: null, sittingsEligible: 12, sittingsAttended: 12 }),
    ]);
    expect((await parliament.repository.leaderboard('committees', 'desc', 10)).map((r) => r.value)).toEqual([100, 50]);
    expect((await parliament.repository.parties()).find((p) => p.party === 'Party A')?.avgCommitteeAttendancePct).toBe(75);
  });

  it('stores offices on the TD and serves them', async () => {
    expect((await parliament.repository.tdSummary(await tdId(CHAIR)))?.offices).toEqual([{ title: 'Ceann Comhairle', since: '2024-12-18' }]);
    expect((await parliament.repository.tdSummary(await tdId(A)))?.offices).toEqual([]);
    const { rows } = await dbmod.pool.query('select committees from politics.tds where member_code = $1', [A]);
    expect(rows[0].committees).toEqual(['Committee of Public Accounts']);
  });

  it('joins a bill to the Dáil divisions held in its debates', async () => {
    expect((await parliament.repository.listBills({}, 10, 0)).total).toBe(4);
    expect((await parliament.repository.listBills({ status: 'Enacted' }, 10, 0)).rows.map((b) => b.id)).toEqual(['2025-32']);
    const gov = await parliament.repository.billDetail('2025-32');
    expect(gov).toMatchObject({ source: 'Government', act: '6/2025', sponsors: ['Minister for Finance'] });
    expect(gov?.stages).toHaveLength(10);
    // All 12 fixture divisions sit in dail-2025-06-25-dbsect_19, one of this bill's debates.
    expect(gov?.divisions).toHaveLength(12);
    expect(await parliament.repository.billDetail('1999-1')).toBeNull();
  });

  it('lists the bills a TD sponsored', async () => {
    const a = await tdId(A);
    expect(await parliament.repository.tdBills(a, 10)).toEqual([expect.objectContaining({ id: '2025-999', isPrimary: true, sponsors: ['A'] })]);
    expect((await parliament.repository.tdSummary(a))?.billsSponsored).toBe(1);
    expect((await parliament.repository.tdSummary(await tdId(B)))?.billsSponsored).toBe(0);
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
    const { rows: again } = await dbmod.pool.query(`select
      (select count(*)::int from politics.committee_attendance) attendance,
      (select count(*)::int from politics.committee_memberships) memberships,
      (select count(*)::int from politics.bill_sponsors) sponsors,
      (select sum(n)::int from politics.question_counts) questions`);
    expect(again[0]).toEqual({ attendance: 12 + 6 + 12, memberships: 3, sponsors: 1 + 74 + 1 + 1, questions: 97 });

    const after = await parliament.repository.divisionDetail('dail-34-2025-06-21-vote_12');
    expect(after?.votes.find((v) => v.memberCode === Z)?.tdId).toBe(await tdId(Z));
    expect((await parliament.repository.tdSummary(await tdId(Z)))?.votesCast).toBe(12);
  });

  it('records where each feed got to', async () => {
    const feeds = (await parliament.repository.syncStatus()).map((f) => [f.feed, f.throughDate, f.failures]);
    expect(feeds).toEqual([
      ['bills', '2025-06-30', {}],
      ['committees', '2025-06-30', {}],
      ['debates', '2025-06-30', {}],
      ['divisions', '2025-06-30', {}],
      ['questions', '2025-06-30', {}],
      ['roster', '2025-06-30', {}],
    ]);
  });

  it('a failed question month keeps the last good totals, and is retried', async () => {
    const failed = await parliament.runSync({ client: fakeClient(roster, { failQuestionMonths: ['2025-06-01'] }), today: '2025-06-30', log: () => {} });
    expect(failed.questions.failedMonths).toEqual(['2025-06-01']);
    // June would have been missing: A's 92 June questions are not dropped to 0.
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ questionsOral: 15, questionsWritten: 77 });
    const questions = async () => (await parliament.repository.syncStatus()).find((f) => f.feed === 'questions');
    expect((await questions())?.failures).toEqual({ '2025-06-01': 1 });

    await parliament.runSync({ client: fakeClient(roster), today: '2025-06-30', log: () => {} });
    expect((await questions())?.failures).toEqual({});
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
