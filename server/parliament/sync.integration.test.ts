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
import { ATTENDANCE_BENCHMARK } from '../scoring/weights';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import { LEADERSHIP_ATTENDANCE_BENCHMARK } from './metrics';
import type { FormerMember, OireachtasClient, RosterMember } from './client';
import { isGovernmentSide } from './governmentSide';
import { parseTranscript, type RawBill, type RawDivision, type RawQuestion } from './parse';

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
    officeHistory: [],
    committees: [],
    ...extra,
  };
}

const MOS_TITLE = 'Minister of State at the Department of Health';

// --- Committees: 12 sittings of the PAC. A chairs it and attends all; B attends every
// other one; C joins on 16 June (6 eligible sittings, below the minimum); Y is no member.
// On the first day A is on the roll call only as the unlinked chair line, as in real
// transcripts. A 13th sitting has a name nobody can match, so it counts for no one.
const PAC_URI = 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/committee_of_public_accounts';
const PAC_DAYS = Array.from({ length: 12 }, (_, k) => `2025-06-${String(10 + k).padStart(2, '0')}`);
const UNMATCHED_DAY = '2025-06-22';
const nameOf = (code: string) => code.split('.')[0].replace(/-/g, ' ');
const pac = (role: string | null, start: string) => [{ uri: PAC_URI, name: 'Committee of Public Accounts', committeeType: 'Standing', role, start, end: null }];
function rollCallFor(date: string): { linked: string[]; names: string[] } {
  if (date === UNMATCHED_DAY) return { linked: [A, B, C], names: ['Deputy Nobody Known'] };
  const k = PAC_DAYS.indexOf(date);
  if (k === 0) return { linked: [B, C], names: [`DEPUTY ${nameOf(A).toUpperCase()} IN THE CHAIR.`] };
  return { linked: [A, ...(k % 2 === 0 ? [B] : []), C], names: [] };
}
function rollCallXml({ linked, names }: { linked: string[]; names: string[] }): string {
  const refs = linked.map((c, i) => `<TLCPerson eId="p${i}" href="/ie/oireachtas/member/id/${c}" showAs="${c}"/>`).join('');
  const roll = [
    ...linked.map((_, i) => `<person refersTo="#p${i}">Deputy ${i}</person>`),
    ...names.map((n, i) => `<person refersTo="#unlinked${i}">${n}</person>`),
  ].join('');
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
  stages: [{ event: { showAs: 'Committee Stage', dates: [{ date: '2025-06-20' }], chamber: { showAs: 'Select Committee on Justice, Home Affairs and Migration, and the Implementation of the Good Friday Agreement' } } }],
  debates: [
    { chamber: { showAs: 'Dáil Éireann', uri: 'https://data.oireachtas.ie/ie/oireachtas/def/house/dail' }, date: '2025-06-25', debateSectionId: 'dbsect_19', showAs: 'Test Bill 2025: Second Stage', uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/dail/2025-06-25/debate/main' },
    // A committee-stage debate: the live API has chamber labels up to 104 characters (they
    // broke a varchar(60) on the first real run), and its key must not collide with the
    // Dáil debate above, which has the same date and section id.
    {
      chamber: { showAs: 'Select Committee on Justice, Home Affairs and Migration, and the Implementation of the Good Friday Agreement', uri: 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/select_committee_on_justice_home_affairs_and_migration' },
      date: '2025-06-25',
      debateSectionId: 'dbsect_19',
      showAs: 'Test Bill 2025: Committee Stage',
      uri: 'https://data.oireachtas.ie/akn/ie/debateRecord/select_committee_on_justice_home_affairs_and_migration_and_the_implementation_of_the_good_friday_agreement/2025-06-25/debate/main',
    },
  ],
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
  /** The bills endpoint throws. */
  failBills?: boolean;
  /** Extra committee sittings listed before the PAC's on the same day. */
  extraSittings?: Array<{ uri: string; date: string; committeeUri: string; committeeName: string; xmlUri: string | null }>;
  /** Members whose seat in this Dáil has ended. */
  former?: FormerMember[];
}

const HEALTH_URI = 'https://data.oireachtas.ie/ie/oireachtas/committee/dail/34/joint_committee_on_health';

function fakeClient(roster: RosterMember[], opts: FakeOptions = {}): OireachtasClient {
  const days = opts.days ?? [{ date: '2025-06-25', xmlUri: 'fixture.xml' }];
  const failing = new Set(opts.failQuestionMonths ?? []);
  return {
    roster: async () => roster,
    formerMembers: async () => opts.former ?? [],
    divisions: async () => divisions(),
    debateDays: async (from: string, to: string) => days.filter((d) => d.date >= from && d.date <= to).map((d) => ({ ...d })),
    committeeSittings: async (from: string, to: string) => [
      ...(opts.extraSittings ?? []).filter((s) => s.date >= from && s.date <= to),
      ...[...PAC_DAYS, UNMATCHED_DAY].filter((d) => d >= from && d <= to).map((date) => ({
        uri: `https://data.oireachtas.ie/akn/ie/debateRecord/committee_of_public_accounts/${date}/debate/main`,
        date,
        committeeUri: PAC_URI,
        committeeName: 'COMMITTEE OF PUBLIC ACCOUNTS',
        xmlUri: `pac-${date}.xml`,
      })),
    ],
    transcript: async (xmlUri: string) => {
      if (xmlUri.startsWith('pac-')) return rollCallXml(rollCallFor(xmlUri.slice(4, 14)));
      if (xmlUri.startsWith('health-')) return rollCallXml({ linked: [Y], names: [] });
      return transcript;
    },
    bills: async () => {
      if (opts.failBills) throw new Error('legislation endpoint down');
      return [...structuredClone(realBills), structuredClone(billByA)];
    },
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
    // B becomes a Minister of State on 1 March: questions are expected only before that.
    member(B, 'Party A', {
      committees: pac(null, '2024-12-01'),
      offices: [{ title: MOS_TITLE, since: '2025-03-01' }],
      officeHistory: [{ title: MOS_TITLE, type: 'minister_of_state', start: '2025-03-01', end: null }],
    }),
    member(Y, 'Party A'),
    member(C, 'Party A', { committees: pac(null, '2025-06-16') }),
    member(CHAIR, 'Independent', {
      isPresiding: true,
      offices: [{ title: 'Ceann Comhairle', since: '2024-12-18' }],
      officeHistory: [{ title: 'Ceann Comhairle', type: 'ceann_comhairle', start: '2024-12-18', end: null }],
    }),
  ];
  // Every sync here uses a fake gender source, never the real Wikidata. C has none.
  const GENDERS = new Map([[A, 'female'], [B, 'male'], [Y, 'male'], [CHAIR, 'female']]);
  // …and no interests register or allowance files (those have their own test below).
  const NO_DISCLOSURES = { links: async () => [], pages: async () => [] };
  const sync = (o: Parameters<typeof parliament.runSync>[0]) =>
    parliament.runSync({ genders: async () => GENDERS, disclosures: NO_DISCLOSURES, ...o });
  const windows = () => new Map(roster.map((m) => [m.memberCode, { memberSince: m.memberSince, isPresiding: m.isPresiding }]));
  // The term the later tests recompute over: the fixture Dáil's first day to the last sync's today.
  const TERM = { start: '2024-11-29', today: '2025-07-30' };
  const statsOf = async (code: string) => {
    const id = await tdId(code);
    return (await parliament.repository.allStats()).find((s) => s.tdId === id);
  };
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
    const s = await sync({ client: fakeClient(roster), today: '2025-06-30', log: () => {} });
    expect(s.roster).toMatchObject({ members: 5, inserted: 5 });
    expect(s.divisions.ingested).toBe(12);
    expect(s.debates).toMatchObject({ days: 1, sections: 2, speeches: 33, failedDays: [] });
    expect(s.committees).toMatchObject({ days: 13, sittings: 13, unresolvedSittings: 1, failedDays: [] });
    expect(s.failedFeeds).toEqual([]);
    expect(parliament.syncHadFailures(s)).toBe(false);
    expect(s.bills.ingested).toBe(4);
    // Nov 2024 .. Jun 2025.
    expect(s.questions).toMatchObject({ months: 8, questions: 97, failedMonths: [] });
    expect(s.roster.committeeMemberships).toBe(3);
    expect(s.statsRows).toBe(5);
    const { rows } = await dbmod.pool.query('select count(*)::int n from politics.division_votes');
    expect(rows[0].n).toBe(12 * 146 - 3);
  });

  it('groups every stored section into a debate, with its kind, bill and parent heading', async () => {
    const { rows: debates } = await dbmod.pool.query(
      'select id, kind, title, bill_id, first_date::text, last_date::text, section_count, mover_source from politics.debates order by id',
    );
    expect(debates).toEqual([
      {
        id: 'dail-2025-06-25-dbsect_19',
        kind: 'bill_stage',
        title: 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages',
        // Two bills link this section (the real one and the fixture's test bill): the lowest id.
        bill_id: '2025-32',
        first_date: '2025-06-25',
        last_date: '2025-06-25',
        section_count: 1,
        // Sponsored by the office "Minister for Finance", which nobody in this roster holds.
        mover_source: null,
      },
      expect.objectContaining({ id: 'dail-2025-06-25-dbsect_2', kind: 'procedural', title: 'Ábhair Shaincheisteanna Tráthúla - Topical Issue Matters', bill_id: null }),
    ]);
    const { rows: sections } = await dbmod.pool.query('select id, debate_id from politics.debate_sections order by id');
    expect(sections).toEqual([
      { id: 'dail-2025-06-25-dbsect_19', debate_id: 'dail-2025-06-25-dbsect_19' },
      { id: 'dail-2025-06-25-dbsect_2', debate_id: 'dail-2025-06-25-dbsect_2' },
    ]);
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
    // 12, not 11: on the first day A is on the roll call only by the chair line's name.
    // And not 13: the sitting with an unmatched name counts for nobody.
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

  it('fills gender from the gender source, and leaves an unknown one NULL', async () => {
    const gender = async (code: string) => (await dbmod.pool.query('select gender from politics.tds where member_code = $1', [code])).rows[0]?.gender;
    expect(await gender(A)).toBe('female');
    expect(await gender(B)).toBe('male');
    expect(await gender(C)).toBeNull();
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

    // The test bill's committee-stage debate has the Dáil debate's date and section id; it
    // is stored under its own key and joins to no division.
    const { rows } = await dbmod.pool.query(`select debate_section_id id, chamber from politics.bill_debates where bill_id = '2025-999' order by 1`);
    expect(rows.map((r) => r.id)).toEqual([
      'committee-select_committee_on_justice_home_affairs_and_migration_and_the_implementation_of_the_good_friday_agreement-2025-06-25-dbsect_19',
      'dail-2025-06-25-dbsect_19',
    ]);
    expect(rows[0].chamber.length).toBeGreaterThan(100);
    expect((await parliament.repository.billDetail('2025-999'))?.divisions).toHaveLength(12);
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
    expect(found?.td.committeeAttendancePct).toBe(100);
    expect(found?.score?.parliamentaryScore).not.toBeNull();
    // B: 6 of 12 sittings = 50%. C: 6 sittings, below the minimum, so NULL and not 0.
    expect((await scoring.repository.findById(await tdId(B)))?.td.committeeAttendancePct).toBe(50);
    expect((await scoring.repository.findById(await tdId(C)))?.td.committeeAttendancePct).toBeNull();
    // The chair's question count reads 0, but they are not expected to ask any: unranked, not scored 0.
    const chair = await scoring.repository.findById(await tdId(CHAIR));
    expect(chair?.stats?.isPresiding).toBe(true);
    expect(chair?.score).toMatchObject({ overallScore: null, nationalRank: null });
  });

  it('is idempotent, and links a member once they join the roster', async () => {
    const before = await parliament.repository.divisionDetail('dail-34-2025-06-21-vote_12');
    expect(before?.votes.find((v) => v.memberCode === Z)?.tdId).toBeNull();

    const s = await sync({ client: fakeClient([...roster, member(Z, 'Party B')]), today: '2025-06-30', log: () => {} });
    expect(s.roster).toMatchObject({ inserted: 1 });
    const { rows } = await dbmod.pool.query('select count(*)::int n from politics.division_votes');
    expect(rows[0].n).toBe(12 * 146 - 3);
    const { rows: speeches } = await dbmod.pool.query('select count(*)::int n from politics.debate_speeches');
    expect(speeches[0].n).toBe(33);
    expect(s.debateGroups).toBe(2);
    const { rows: grouped } = await dbmod.pool.query('select count(*)::int n from politics.debate_sections where debate_id is null');
    expect(grouped[0].n).toBe(0);
    const { rows: again } = await dbmod.pool.query(`select
      (select count(*)::int from politics.committee_attendance) attendance,
      (select count(*)::int from politics.committee_memberships) memberships,
      (select count(*)::int from politics.bill_sponsors) sponsors,
      (select sum(n)::int from politics.question_counts) questions`);
    // A, B and C are each also present at the unmatched sitting: stored, just not counted.
    expect(again[0]).toEqual({ attendance: 13 + 7 + 13, memberships: 3, sponsors: 1 + 74 + 1 + 1, questions: 97 });

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
    const failed = await sync({ client: fakeClient(roster, { failQuestionMonths: ['2025-06-01'] }), today: '2025-06-30', log: () => {} });
    expect(failed.questions.failedMonths).toEqual(['2025-06-01']);
    // June would have been missing: A's 92 June questions are not dropped to 0.
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ questionsOral: 15, questionsWritten: 77 });
    const questions = async () => (await parliament.repository.syncStatus()).find((f) => f.feed === 'questions');
    expect((await questions())?.failures).toEqual({ '2025-06-01': 1 });

    await sync({ client: fakeClient(roster), today: '2025-06-30', log: () => {} });
    expect((await questions())?.failures).toEqual({});
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ questionsOral: 15, questionsWritten: 77 });
  });

  it('retries a failed FIRST month of the Dáil too, whose key is before the Dáil began', async () => {
    const questions = async () => (await parliament.repository.syncStatus()).find((f) => f.feed === 'questions');
    const failed = await sync({ client: fakeClient(roster, { failQuestionMonths: ['2024-11-01'] }), since: '2024-11-29', today: '2025-06-30', log: () => {} });
    expect(failed.questions.failedMonths).toEqual(['2024-11-01']);
    // A normal run's window is only June; November 2024 must come from the failure map.
    await sync({ client: fakeClient(roster), today: '2025-06-30', log: () => {} });
    expect((await questions())?.failures).toEqual({});
  });

  it('records a failed day, keeps going, and retries it on a later run', async () => {
    const pending = { date: '2025-06-26', xmlUri: null };
    const first = await sync({
      client: fakeClient(roster, { days: [pending, { date: '2025-06-25', xmlUri: 'fixture.xml' }] }),
      today: '2025-06-30',
      log: () => {},
    });
    expect(first.debates.failedDays).toEqual(['2025-06-26']);
    expect(first.debates.speeches).toBe(33);
    const debates = async () => (await parliament.repository.syncStatus()).find((f) => f.feed === 'debates');
    expect(await debates()).toMatchObject({ throughDate: '2025-06-30', failures: { '2025-06-26': 1 } });

    // A month on, the day is outside the overlap window; it is retried from the failure map.
    const later = await sync({
      client: fakeClient(roster, { days: [{ date: '2025-06-26', xmlUri: 'published.xml' }] }),
      today: '2025-07-30',
      log: () => {},
    });
    expect(later.debates).toMatchObject({ days: 1, failedDays: [] });
    expect(await debates()).toMatchObject({ throughDate: '2025-07-30', failures: {} });
    const { rows } = await dbmod.pool.query(`select count(*)::int n from politics.debate_sections where date = '2025-06-26'`);
    expect(rows[0].n).toBe(2);
  });

  it('a feed that fails outright is recorded, and the other feeds still run', async () => {
    const s = await sync({ client: fakeClient(roster, { failBills: true }), today: '2025-07-30', log: () => {} });
    expect(s.failedFeeds).toEqual(['bills']);
    expect(parliament.syncHadFailures(s)).toBe(true);
    expect(s.questions).toMatchObject({ failedMonths: [], totalsComplete: true });
    expect(s.scoringRowsWritten).toBeGreaterThan(0);
    // The bills already stored are kept.
    expect((await parliament.repository.listBills({}, 10, 0)).total).toBe(4);
  });

  it('bills sponsored is NULL until the bills feed has run once', async () => {
    const a = await tdId(A);
    await dbmod.pool.query(`delete from politics.parliament_sync_state where feed = 'bills'`);
    expect((await parliament.repository.tdSummary(a))?.billsSponsored).toBeNull();
    await sync({ client: fakeClient(roster), today: '2025-07-30', log: () => {} });
    expect((await parliament.repository.tdSummary(a))?.billsSponsored).toBe(1);
  });

  it('tries every committee sitting of a day before marking the day failed', async () => {
    const health = (suffix: string, xmlUri: string | null) => ({
      uri: `https://data.oireachtas.ie/akn/ie/debateRecord/joint_committee_on_health/2025-07-20/debate/${suffix}`,
      date: '2025-07-20',
      committeeUri: HEALTH_URI,
      committeeName: 'JOINT COMMITTEE ON HEALTH',
      xmlUri,
    });
    const good = health('main', 'health-2025-07-20.xml');
    // The unpublished sitting is listed first; the good one is listed twice.
    const s = await sync({
      client: fakeClient(roster, { extraSittings: [health('unpublished', null), good, good] }),
      today: '2025-07-30',
      log: () => {},
    });
    expect(s.committees).toMatchObject({ failedDays: ['2025-07-20'], sittings: 1 });
    const { rows } = await dbmod.pool.query(
      `select s.present_count, a.member_code from politics.committee_sittings s join politics.committee_attendance a on a.sitting_uri = s.uri where s.uri = $1`,
      [good.uri],
    );
    expect(rows).toEqual([{ present_count: 1, member_code: Y }]);
  });

  it('a --since run with no question resume point keeps the last totals, not a partial count', async () => {
    // A store whose question counts start in June and have no resume point: a fresh
    // `--since` run looks exactly like this.
    await dbmod.pool.query(`delete from politics.parliament_sync_state where feed = 'questions'`);
    await dbmod.pool.query(`delete from politics.question_counts where month < '2025-06-01'`);
    const partial = await sync({ client: fakeClient(roster), since: '2025-06-01', today: '2025-07-30', log: () => {} });
    expect(partial.questions.totalsComplete).toBe(false);
    // C's 3 January questions are not in the counts; the scoring input must not drop to 0.
    const scoredWritten = async (code: string) => (await scoring.repository.findById(await tdId(code)))?.td.questionCountWritten;
    expect(await scoredWritten(C)).toBe(3);

    const full = await sync({ client: fakeClient(roster), today: '2025-07-30', log: () => {} });
    expect(full.questions.totalsComplete).toBe(true);
    expect(await scoredWritten(C)).toBe(3);
    expect(await parliament.repository.tdSummary(await tdId(A))).toMatchObject({ questionsOral: 15, questionsWritten: 77 });
  });

  // ---- Fairness: a TD is only counted for what they were expected to do. ----

  it('does not expect questions from the chair or a minister, and pro-rates part-time office', async () => {
    // The last sync ran with today = 2025-07-30.
    const termDays = (Date.parse('2025-07-30') - Date.parse('2024-11-29')) / 86_400_000 + 1;
    const chair = await statsOf(CHAIR);
    // Ceann Comhairle from 18 Dec: 19 days expected, under the minimum, so NULL.
    expect(chair?.questionsExpected).toBeNull();
    expect((await scoring.repository.findById(await tdId(CHAIR)))?.td.questionCountWritten).toBeNull();
    // The profile still shows what the chair asked.
    expect(await parliament.repository.tdSummary(await tdId(CHAIR))).toMatchObject({ questionsWritten: 2, questionsExpected: null });

    // B: Minister of State from 1 March, so 92 days (29 Nov – 28 Feb) were expected.
    expect((await statsOf(B))?.questionsExpected).toBe(Math.round((200 * 92 * 10) / termDays) / 10);
    // B asked none in those days: a real 0, still scored.
    expect((await scoring.repository.findById(await tdId(B)))?.td.questionCountWritten).toBe(0);
    expect((await statsOf(A))?.questionsExpected).toBe(200);
  });

  it('never expects questions from the chair, even with no office on record', async () => {
    await dbmod.pool.query('delete from politics.td_offices where member_code = $1', [CHAIR]);
    await parliament.repository.recomputeStats(windows(), TERM);
    expect((await statsOf(CHAIR))?.questionsExpected).toBeNull();
    await parliament.repository.replaceOffices(roster, await parliament.repository.tdIdsByMemberCode());
    await parliament.repository.recomputeStats(windows(), TERM);
  });

  it('hands the rollup each expectation, and no expectation for a row from before the fairness columns', async () => {
    const inputs = async () => new Map((await scoring.repository.rollupInputs(new Map())).map((i) => [i.tdId, i]));
    let byId = await inputs();
    expect(byId.get(await tdId(CHAIR))?.questionsExpected).toBeNull();
    expect(byId.get(await tdId(A))?.questionsExpected).toBe(200);
    expect(byId.get(await tdId(B))?.attendanceBenchmark).toBe(LEADERSHIP_ATTENDANCE_BENCHMARK);
    expect(byId.get(await tdId(A))?.attendanceBenchmark).toBe(ATTENDANCE_BENCHMARK);
    // A stats row written by the code before the fairness columns: no expectation yet.
    await dbmod.pool.query('update politics.td_parliament_stats set divisions_chaired = null, questions_expected = null where td_id = $1', [await tdId(A)]);
    byId = await inputs();
    expect(byId.get(await tdId(A))?.questionsExpected).toBeUndefined();
    await parliament.repository.recomputeStats(windows(), TERM);
  });

  it('says when the question counts are complete', async () => {
    expect((await parliament.repository.tdSummary(await tdId(A)))?.questionsComplete).toBe(true);
  });

  it('gives government time its own vote benchmark', async () => {
    // Every division (June) is after B took office; A never held one.
    expect(await statsOf(B)).toMatchObject({ divisionsInLeadership: 12, attendanceBenchmark: LEADERSHIP_ATTENDANCE_BENCHMARK });
    expect(await statsOf(A)).toMatchObject({ divisionsInLeadership: 0, attendanceBenchmark: ATTENDANCE_BENCHMARK });
    expect((await statsOf(CHAIR))?.attendanceBenchmark).toBeNull();
    const summary = await parliament.repository.tdSummary(await tdId(B));
    expect(summary?.officeHistory).toEqual([{ title: MOS_TITLE, type: 'minister_of_state', start: '2025-03-01', end: null }]);
    expect(summary?.attendanceBenchmark).toBe(LEADERSHIP_ATTENDANCE_BENCHMARK);
  });

  it('gives a party leader the leadership benchmark for their time as leader, like a minister', async () => {
    const tdIds = await parliament.repository.tdIdsByMemberCode();
    // Y leads Party A from 15 June: 7 of the 12 June divisions fall in that time.
    await parliament.repository.replacePartyLeaders([{ memberCode: Y, party: 'Party A', from: '2025-06-15', to: null, source: 'https://example.ie/leader' }], tdIds);
    await parliament.repository.recomputeStats(windows(), TERM);
    const expected = Math.round(((ATTENDANCE_BENCHMARK * 5 + LEADERSHIP_ATTENDANCE_BENCHMARK * 7) / 12) * 10) / 10;
    expect(await statsOf(Y)).toMatchObject({ divisionsInLeadership: 7, attendanceBenchmark: expected });
    // Still expected to ask questions: leading a party is not government office.
    expect((await statsOf(Y))?.questionsExpected).toBe(200);
    expect((await parliament.repository.tdSummary(await tdId(Y)))?.officeHistory).toEqual([
      { title: 'Leader of Party A', type: 'party_leader', start: '2025-06-15', end: null, sourceUrl: 'https://example.ie/leader' },
    ]);
    await parliament.repository.replacePartyLeaders([], tdIds);
    await parliament.repository.recomputeStats(windows(), TERM);
    expect(await statsOf(Y)).toMatchObject({ divisionsInLeadership: 0, attendanceBenchmark: ATTENDANCE_BENCHMARK });
  });

  it('leaves out divisions a TD chaired, unless they voted in them', async () => {
    // Give one division its own debate section whose last chair speech is `code`'s.
    const chairDivision = async (voteId: string, code: string) => {
      const { rows } = await dbmod.pool.query('select id, date::text from politics.divisions where id like $1', [`%-${voteId}`]);
      const section = `dail-${rows[0].date}-test_${voteId}`;
      await dbmod.pool.query(`insert into politics.debate_sections (id, date, title, speech_count) values ($1, $2, 'Test', 1)`, [section, rows[0].date]);
      await dbmod.pool.query(
        `insert into politics.debate_speeches (id, section_id, date, position, member_code, is_presiding, text, word_count) values ($1, $2, $3, 0, $4, true, 'Question put.', 2)`,
        [`${section}/spk_test`, section, rows[0].date, code],
      );
      await dbmod.pool.query('update politics.divisions set debate_section_id = $1 where id = $2', [section, rows[0].id]);
      return { section, divisionId: rows[0].id as string };
    };
    const before = await statsOf(Y);
    // Y did not vote in vote_1 and was in the chair for it; A chaired vote_2's section but voted.
    const y = await chairDivision('vote_1', Y);
    const a = await chairDivision('vote_2', A);
    await parliament.repository.recomputeStats(windows(), TERM);
    expect(await statsOf(Y)).toMatchObject({ divisionsEligible: before!.divisionsEligible - 1, votesCast: before!.votesCast, divisionsChaired: 1 });
    expect(await statsOf(A)).toMatchObject({ divisionsEligible: 12, votesCast: 12, divisionsChaired: 0 });

    // Undo: the sections go (cascading to the speeches), the divisions get their section back.
    const { rows } = await dbmod.pool.query(`select debate_section_id from politics.divisions where id like '%-vote_3'`);
    for (const t of [y, a]) {
      await dbmod.pool.query('update politics.divisions set debate_section_id = $1 where id = $2', [rows[0].debate_section_id, t.divisionId]);
      await dbmod.pool.query('delete from politics.debate_sections where id = $1', [t.section]);
    }
    await parliament.repository.recomputeStats(windows(), TERM);
    expect(await statsOf(Y)).toMatchObject({ divisionsEligible: before!.divisionsEligible, divisionsChaired: 0 });
  });

  it('leaves out documented leave from votes, sitting days and committee sittings', async () => {
    const tdIds = await parliament.repository.tdIdsByMemberCode();
    const leave = (memberCode: string, from: string, to: string) => ({ memberCode, from, to, reason: 'other_leave' as const, source: 'https://example.ie/leave', note: null });
    // None of the roster TDs speaks in the fixture transcript, so give A one speech on 25 June.
    await dbmod.pool.query(
      `insert into politics.debate_speeches (id, section_id, date, position, member_code, td_id, is_presiding, text, word_count)
       values ('dail-2025-06-25-dbsect_19/spk_test_a', 'dail-2025-06-25-dbsect_19', '2025-06-25', 999, $1, $2, false, 'A test speech.', 3)`,
      [A, await tdId(A)],
    );
    await parliament.repository.recomputeStats(windows(), TERM);
    const speaker = { code: A, s: (await statsOf(A))! };
    // Sitting days are 25 June (fixture) and 26 June (the retried day above).
    expect(speaker.s).toMatchObject({ sittingDays: 2, sectionsSpoken: 1, speeches: 1 });

    // Y misses the first three divisions (10–12 June); B misses the PAC on 11 June.
    await parliament.repository.replaceAbsences(
      [leave(Y, '2025-06-10', '2025-06-12'), leave(B, '2025-06-10', '2025-06-12'), leave(speaker.code, '2025-06-25', '2025-06-26')],
      tdIds,
    );
    await parliament.repository.recomputeStats(windows(), TERM);
    await parliament.repository.recomputeCommitteeStats();
    // Y: 9 of 9 once the 3 leave days are left out, not 9 of 12.
    expect(await statsOf(Y)).toMatchObject({ divisionsEligible: 9, votesCast: 9, divisionsExcused: 3 });
    // B's PAC: sittings on 10, 11, 12 June left out (B was at 10 and 12), so 4 of 9, not 6 of 12.
    expect(await statsOf(B)).toMatchObject({ committeeSittingsEligible: 9, committeeSittingsAttended: 4 });
    // The speaker: both sitting days are leave, so no sitting days and no speeches count.
    expect(await statsOf(speaker.code)).toMatchObject({ sittingDays: 0, sittingDaysExcused: 2, sectionsSpoken: 0, speeches: 0 });
    expect((await parliament.repository.tdSummary(await tdId(Y)))?.absences).toEqual([
      { from: '2025-06-10', to: '2025-06-12', reason: 'other_leave', sourceUrl: 'https://example.ie/leave' },
    ]);

    await parliament.repository.replaceAbsences([], tdIds);
    await dbmod.pool.query(`delete from politics.debate_speeches where id = 'dail-2025-06-25-dbsect_19/spk_test_a'`);
    await parliament.repository.recomputeStats(windows(), TERM);
    await parliament.repository.recomputeCommitteeStats();
    expect(await statsOf(Y)).toMatchObject({ divisionsEligible: 12, divisionsExcused: 0 });
    expect(await statsOf(A)).toMatchObject({ sittingDays: 2, sectionsSpoken: 0 });
  });

  it('reads the interests register and allowance payments once, matched by name', async () => {
    const { syncAllowances, syncInterests } = await import('./disclosures');
    const fixture = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, 'sources', name), 'utf8')) as string[][];
    const registerUrl = 'https://data.oireachtas.ie/ie/oireachtas/members/registerOfMembersInterests/dail/2026/2026-02-25_register-of-member-s-interests-dail-eireann-2025_en.pdf';
    const psaUrl = 'https://data.oireachtas.ie/ie/oireachtas/members/parliamentaryAllowances/psa/2026/2026-09-03_parliamentary-standard-allowance-payments-to-deputies-for-july-2026_en.pdf';
    let pdfReads = 0;
    const source = {
      links: async (topic: string, page: number) => (page > 1 ? [] : topic === 'register-of-members-interests' ? [registerUrl] : [psaUrl]),
      pages: async (url: string) => {
        pdfReads++;
        return fixture(url === registerUrl ? 'interests-2025-trimmed.json' : 'psa-2026-07-pages-1-2.json');
      },
    };
    // Two members of the fixtures, as TDs so they have ids (the vote fixture may already have
    // made them TDs). Everyone else in the fixture files is a name with no current TD.
    const added = await dbmod.pool.query(`insert into politics.tds (name, member_code, constituency, is_active) values
      ('Ciarán Ahern', 'Ciarán-Ahern.D.2024-11-29', 'Dublin South-West', false),
      ('William Aird', 'William-Aird.D.2024-11-29', 'Laois', false)
      on conflict do nothing returning member_code`);
    const ctx = {
      roster: [
        { memberCode: 'Ciarán-Ahern.D.2024-11-29', fullName: 'Ciarán Ahern', constituency: 'Dublin South-West' },
        { memberCode: 'William-Aird.D.2024-11-29', fullName: 'William Aird', constituency: 'Laois' },
      ],
      tdIds: await parliament.repository.tdIdsByMemberCode(),
      dailStart: '2024-11-29',
      source,
      log: () => {},
    };
    const interests = await syncInterests(ctx);
    expect(interests).toMatchObject({ files: 1, rows: 2 });
    expect(interests.unmatched).toContain('ARDAGH, Catherine');
    const allowances = await syncAllowances(ctx);
    expect(allowances).toMatchObject({ files: 1, rows: 2 });
    expect(allowances.unmatched).toContain('Ardagh, Catherine');

    // Stored files are not read again.
    expect(pdfReads).toBe(2);
    expect(await syncInterests(ctx)).toMatchObject({ files: 0 });
    expect(await syncAllowances(ctx)).toMatchObject({ files: 0 });
    expect(pdfReads).toBe(2);

    const aird = await tdId('William-Aird.D.2024-11-29');
    const register = await parliament.repository.tdInterestsOf(aird);
    expect(register).toMatchObject({ year: 2025, sourceUrl: registerUrl });
    expect(register?.categories.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(register?.categories[0].declared).toMatch(/Farmer/);
    expect(await parliament.repository.tdAllowancesOf(aird)).toEqual({
      from: '2026-07-01',
      to: '2026-07-01',
      unpublishedMonths: [],
      uncertainMonths: [],
      totalCents: 397208,
      months: [{ month: '2026-07-01', amountCents: 397208 }],
    });
    // A TD with nothing stored reads NULL, not an empty register.
    expect(await parliament.repository.tdInterestsOf(await tdId(A))).toBeNull();

    await dbmod.pool.query('delete from politics.td_interests');
    await dbmod.pool.query('delete from politics.td_allowance_payments');
    await dbmod.pool.query('delete from politics.disclosure_files');
    const mine = added.rows.map((r) => r.member_code as string);
    if (mine.length) await dbmod.pool.query('delete from politics.tds where member_code = any($1)', [mine]);
  });

  it('drops a loose name match when another printed name in the file already claims that TD', async () => {
    const { syncAllowances } = await import('./disclosures');
    const url = 'https://data.oireachtas.ie/ie/oireachtas/members/parliamentaryAllowances/psa/2026/2026-08-01_parliamentary-standard-allowance-payments-to-deputies-for-june-2026_en.pdf';
    const page = [
      'Parliamentary Standard Allowance',
      'Name\tTAA Band\tNarrative\tDate Paid\tAmount',
      // "Pat" is only a loose match for Paul (same surname and initial): it must not become his.
      'Deputy Murphy, Paul\tDublin\tPSA June 2026\t30/06/2026\t€2,445.83',
      'Deputy Murphy, Pat\t5\tPSA June 2026\t30/06/2026\t€3,000.00',
      // A loose match with no rival in the file is kept.
      'Deputy Nash, Gerald\t4\tPSA June 2026\t30/06/2026\t€3,100.00',
    ];
    const ctx = {
      roster: [
        { memberCode: 'Paul-Murphy.D.2014-10-10', fullName: 'Paul Murphy', constituency: 'Dublin South-West' },
        { memberCode: 'Ged-Nash.D.2011-03-09', fullName: 'Ged Nash', constituency: 'Louth' },
      ],
      tdIds: new Map<string, number>(),
      dailStart: '2024-11-29',
      source: { links: async (_t: string, p: number) => (p > 1 ? [] : [url]), pages: async () => [page] },
      log: () => {},
    };
    const result = await syncAllowances(ctx);
    expect(result.rows).toBe(2);
    expect(result.unmatched).toEqual(['Murphy, Pat (ambiguous)']);
    const { rows } = await dbmod.pool.query('select member_code, amount_cents from politics.td_allowance_payments where source_url = $1 order by position', [url]);
    expect(rows).toEqual([
      { member_code: 'Paul-Murphy.D.2014-10-10', amount_cents: 244583 },
      { member_code: 'Ged-Nash.D.2011-03-09', amount_cents: 310000 },
    ]);
    await dbmod.pool.query('delete from politics.td_allowance_payments');
    await dbmod.pool.query('delete from politics.disclosure_files');
  });

  it('keeps only the newest file for a re-published month, and reports a month never published', async () => {
    const { syncAllowances } = await import('./disclosures');
    const base = 'https://data.oireachtas.ie/ie/oireachtas/members/parliamentaryAllowances/psa';
    const march = `${base}/2025/2025-05-02_parliamentary-standard-allowance-payments-to-deputies-for-march-2025_en.pdf`;
    const marchAgain = `${base}/2026/2026-02-03_parliamentary-standard-allowance-payments-to-deputies-for-march-2025_en.pdf`;
    const may = `${base}/2025/2025-07-01_parliamentary-standard-allowance-payments-to-deputies-for-may-2025_en.pdf`;
    const june = `${base}/2025/2025-08-01_parliamentary-standard-allowance-payments-to-deputies-for-june-2025_en.pdf`;
    const page = (amount: string, name = 'Nash, Ged') => [
      'Parliamentary Standard Allowance',
      'Name\tTAA Band\tNarrative\tDate Paid\tAmount',
      `Deputy ${name}\t4\tPSA\t28/03/2025\t${amount}`,
    ];
    // June's file has no row for Nash, and a name that matches nobody: it could be him.
    const pages = new Map([[march, page('€1,000.00')], [marchAgain, page('€1,100.00')], [may, page('€1,200.00')], [june, page('€1,300.00', 'Nobody, Here')]]);
    await dbmod.pool.query(`insert into politics.tds (name, member_code, constituency, is_active) values ('Ged Nash', 'Ged-Nash.D.2011-03-09', 'Louth', false) on conflict do nothing`);
    const ctx = {
      roster: [{ memberCode: 'Ged-Nash.D.2011-03-09', fullName: 'Ged Nash', constituency: 'Louth' }],
      tdIds: await parliament.repository.tdIdsByMemberCode(),
      dailStart: '2024-11-29',
      // Newest first, as the listing is: the re-published March comes before May's file.
      source: { links: async (_t: string, p: number) => (p > 1 ? [] : [marchAgain, june, may, march]), pages: async (url: string) => [pages.get(url)!] },
      log: () => {},
    };
    expect(await syncAllowances(ctx)).toMatchObject({ files: 3, rows: 2, unmatched: ['Nobody, Here'] });
    const nash = await tdId('Ged-Nash.D.2011-03-09');
    expect(await parliament.repository.tdAllowancesOf(nash)).toEqual({
      from: '2025-03-01',
      to: '2025-06-01',
      // April has no file: not published, which is not the same as not paid.
      unpublishedMonths: ['2025-04-01'],
      // June's file had an unmatched name and no row for Nash: unknown, not "not paid".
      uncertainMonths: ['2025-06-01'],
      totalCents: 110000 + 120000,
      months: [
        { month: '2025-05-01', amountCents: 120000 },
        { month: '2025-03-01', amountCents: 110000 },
      ],
    });
    await dbmod.pool.query('delete from politics.td_allowance_payments');
    await dbmod.pool.query('delete from politics.disclosure_files');
    await dbmod.pool.query(`delete from politics.tds where member_code = 'Ged-Nash.D.2011-03-09'`);
  });

  it('lists long silences that no documented absence covers', async () => {
    const tdIds = await parliament.repository.tdIdsByMemberCode();
    const silent = await parliament.repository.undocumentedSilences(1);
    expect(silent.length).toBeGreaterThan(0);
    const first = silent[0];
    await parliament.repository.replaceAbsences([{ memberCode: first.memberCode, from: first.from, to: first.to, reason: 'other_leave', source: 'https://example.ie/x', note: null }], tdIds);
    expect((await parliament.repository.undocumentedSilences(1)).some((s) => s.memberCode === first.memberCode)).toBe(false);
    await parliament.repository.replaceAbsences([], tdIds);
  });

  // --- Division reads for the ideology area. The government test adds two roster members,
  // so these stay last: the tests above count Party A as four TDs, and the fairness tests
  // rely on no roster TD speaking in the fixture transcript.

  /** A bare division row with no votes; the caller deletes it again. */
  const addDivision = (id: string, date: string, sectionId: string, debateTitle: string | null = null) =>
    dbmod.pool.query(
      `insert into politics.divisions (id, uri, house_no, date, subject, debate_title, debate_section_id, ta_count, nil_count, staon_count)
       values ($1, $2, 34, $3, 'Motion', $4, $5, 1, 1, 0)`,
      [id, `test:${id}`, date, debateTitle, sectionId],
    );

  it('reads every linked vote with its party line, in one pass', async () => {
    const records = await parliament.repository.divisionVoteRecords();
    const { rows } = await dbmod.pool.query('select count(*)::int n from politics.division_votes where td_id is not null');
    expect(rows[0].n).toBeGreaterThan(0);
    expect(records).toHaveLength(rows[0].n);
    expect(records.every((r) => typeof r.tdId === 'number')).toBe(true);

    const c = await tdId(C);
    const ofC = records.filter((r) => r.tdId === c);
    expect(ofC).toHaveLength(12);
    expect(ofC.every((r) => r.vote === 'nil' && r.partyMajority === 'ta' && r.party === 'Party A')).toBe(true);
    expect(ofC.find((r) => r.divisionId === 'dail-34-2025-06-21-vote_12')).toMatchObject({
      date: '2025-06-21',
      heldAt: '2025-06-25T08:00:00.000Z',
      partyTa: 3,
      partyNil: 1,
    });
    // Y missed the first three: Party A was 2–1 in them.
    expect(ofC.find((r) => r.divisionId === 'dail-34-2025-06-10-vote_1')).toMatchObject({ partyTa: 2, partyNil: 1 });
  });

  it("gathers a division's context: its section, its siblings in order, its bills and speeches", async () => {
    const ctx = await parliament.repository.divisionContext('dail-34-2025-06-21-vote_12');
    expect(ctx?.division).toMatchObject({
      id: 'dail-34-2025-06-21-vote_12',
      subject: 'Amendment put',
      taCount: 64,
      nilCount: 82,
      debateSectionId: 'dail-2025-06-25-dbsect_19',
      heldAt: '2025-06-25T08:00:00.000Z',
      sectionPosition: null,
    });
    expect(ctx?.section).toEqual({
      id: 'dail-2025-06-25-dbsect_19',
      date: '2025-06-25',
      title: 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages',
    });
    // vote_10 after vote_9. (Each clone has its own date, so the id's text agrees here; the
    // next test puts two on one day, where only the vote number orders them.)
    expect(ctx?.siblings.map((s) => s.id)).toEqual(Array.from({ length: 12 }, (_, k) => `dail-34-2025-06-${10 + k}-vote_${k + 1}`));
    expect(ctx?.index).toBe(12);
    expect((await parliament.repository.divisionContext('dail-34-2025-06-19-vote_10'))?.index).toBe(10);
    // One section, two bills.
    expect(ctx?.bills.map((b) => b.id)).toEqual(['2025-32', '2025-999']);
    expect(ctx?.bills[0]).toMatchObject({ source: 'Government', primarySponsor: { label: 'Minister for Finance', party: null } });
    expect(ctx?.bills[1]).toMatchObject({ shortTitle: 'Test Bill 2025', primarySponsor: { label: 'A', party: 'Party A' } });
    expect(ctx?.speeches).toHaveLength(32);
    expect(ctx?.speeches.map((s) => s.position)).toEqual(Array.from({ length: 32 }, (_, i) => i));
    expect(ctx?.speeches.filter((s) => s.isPresiding)).toEqual(
      Array(3).fill(expect.objectContaining({ name: 'Verona Murphy', party: 'Independent', role: 'An Ceann Comhairle' })),
    );
    expect(await parliament.repository.divisionContext('dail-34-1999-01-01-vote_1')).toBeNull();
  });

  it("orders siblings held on one day by vote number, not by the id's text", async () => {
    await addDivision('dail-34-2025-06-27-vote_10', '2025-06-27', 'dail-2025-06-27-dbsect_7');
    await addDivision('dail-34-2025-06-27-vote_9', '2025-06-27', 'dail-2025-06-27-dbsect_7');
    try {
      const ctx = await parliament.repository.divisionContext('dail-34-2025-06-27-vote_10');
      expect(ctx?.siblings.map((s) => s.id)).toEqual(['dail-34-2025-06-27-vote_9', 'dail-34-2025-06-27-vote_10']);
      expect(ctx?.index).toBe(2);
    } finally {
      await dbmod.pool.query(`delete from politics.divisions where id like 'dail-34-2025-06-27-%'`);
    }
  });

  it("gives each speech its speaker's party and role, once the speaker is in the roster", async () => {
    const donohoe = 'Paschal-Donohoe.S.2007-07-23';
    await parliament.runSync({
      client: fakeClient([
        ...roster,
        member(donohoe, 'Party A', {
          offices: [{ title: 'Minister for Finance', since: '2025-01-23' }],
          officeHistory: [{ title: 'Minister for Finance', type: 'cabinet', start: '2025-01-23', end: null }],
        }),
        member('Test-Minister.D.2024-11-29', 'Independent', {
          offices: [{ title: MOS_TITLE, since: '2025-01-29' }],
          officeHistory: [{ title: MOS_TITLE, type: 'minister_of_state', start: '2025-01-29', end: null }],
        }),
      ]),
      today: '2025-07-30',
      log: () => {},
    });
    const ctx = await parliament.repository.divisionContext('dail-34-2025-06-21-vote_12');
    // The context names no government: the division prompt must not see a party (divisionPrompt.ts).
    expect(ctx).not.toHaveProperty('government');
    // Once in the roster, the minister's speeches carry his party.
    const his = ctx?.speeches.filter((s) => s.name === 'Paschal Donohoe') ?? [];
    expect(his.length).toBeGreaterThan(0);
    expect(his.every((s) => s.party === 'Party A')).toBe(true);
    expect(his.some((s) => s.role === 'Minister for Finance')).toBe(true);
  });

  it('keeps the offices of a member who has left, so their debates keep their side of the House', async () => {
    const donohoe = 'Paschal-Donohoe.S.2007-07-23';
    const officesOf = async () =>
      (await dbmod.pool.query('select title, start_date::text start, end_date::text "end" from politics.td_offices where member_code = $1', [donohoe])).rows;
    const lines: string[] = [];
    const sync = (former: FormerMember[]) => parliament.runSync({ client: fakeClient(roster, { former }), today: '2025-12-01', log: (l) => lines.push(l) });

    // Out of the roster, and no former-member record: the office is gone.
    await sync([]);
    expect(await officesOf()).toEqual([]);

    await sync([{ memberCode: donohoe, officeHistory: [{ title: 'Minister for Finance', type: 'cabinet', start: '2025-01-23', end: '2025-11-18' }] }]);
    expect(await officesOf()).toEqual([{ title: 'Minister for Finance', start: '2025-01-23', end: '2025-11-18' }]);
    expect(lines.some((l) => l.includes('1 former members'))).toBe(true);
    // So the debate record and the extractor see him in government on a day he spoke as minister.
    const offices = await parliament.repository.governmentOffices();
    expect(isGovernmentSide(null, donohoe, '2025-06-25', offices)).toBe(true);
    expect(isGovernmentSide(null, donohoe, '2025-11-19', offices)).toBe(false);
  });

  it('falls back to the latest section with the same title, dated on or before the linked one', async () => {
    const title = 'Finance (Local Property Tax and Other Provisions) (Amendment) Bill 2025: Committee and Remaining Stages';
    // Linked to sections that were never ingested. The date comes from the section id, which
    // can be after the division's own date (all 12 fixture divisions sit in a 06-25 section).
    await addDivision('dail-34-2025-06-12-vote_98', '2025-06-12', 'dail-2025-06-25-dbsect_99', title);
    await addDivision('dail-34-2025-06-28-vote_99', '2025-06-28', 'dail-2025-06-28-dbsect_5', title);
    try {
      // 06-26 holds the same transcript (the failed-day test ingested it), but is after 06-25.
      const early = await parliament.repository.divisionContext('dail-34-2025-06-12-vote_98');
      expect(early?.section?.id).toBe('dail-2025-06-25-dbsect_19');
      expect(early?.speeches).toHaveLength(32);
      expect(early).toMatchObject({ index: 1, bills: [] });
      expect(early?.siblings.map((s) => s.id)).toEqual(['dail-34-2025-06-12-vote_98']);
      const late = await parliament.repository.divisionContext('dail-34-2025-06-28-vote_99');
      expect(late?.section?.id).toBe('dail-2025-06-26-dbsect_19');
    } finally {
      await dbmod.pool.query(`delete from politics.divisions where id in ('dail-34-2025-06-12-vote_98', 'dail-34-2025-06-28-vote_99')`);
    }
  });

  it("places a division among its section's speeches from the transcript marker, only when the match is one to one", async () => {
    const SECTION = 'dail-2025-06-25-dbsect_19';
    const position = async (id: string) => (await dbmod.pool.query('select section_position p from politics.divisions where id = $1', [id])).rows[0]?.p;
    const located = async () =>
      (await dbmod.pool.query(`select count(*)::int n from politics.divisions where debate_section_id = $1 and section_position is not null`, [SECTION])).rows[0].n;
    /** A division in the fixture's section with these counts; the caller deletes it again. */
    const addClone = (vote: number, ta: number, nil: number) =>
      dbmod.pool.query(
        `insert into politics.divisions (id, uri, house_no, date, subject, debate_title, debate_section_id, ta_count, nil_count, staon_count)
         values ($1, $2, 34, '2025-06-25', 'Amendment put', null, $3, $4, $5, 0)`,
        [`dail-34-2025-06-25-vote_${vote}`, `test:position-${vote}`, SECTION, ta, nil],
      );
    const reReadDay = () => sync({ client: fakeClient(roster), since: '2025-06-25', today: '2025-07-30', log: () => {} });
    const markers = parseTranscript(transcript, '2025-06-25').divisionMarkers.filter((m) => m.sectionId === SECTION);
    const [first, second, third] = markers;
    expect(markers.map((m) => [m.ta, m.nil])).toEqual([[64, 82], [47, 104], [67, 83], [104, 48]]);

    // The nine clones with 64/82 all match the first marker: not one to one, so none is placed.
    // The three with 63/82 (Y absent) match no marker. Nothing in the section is placed.
    expect(first).toMatchObject({ ta: 64, nil: 82 });
    expect(await located()).toBe(0);

    await addClone(13, second.ta, second.nil);
    await addClone(14, third.ta, third.nil);
    try {
      await reReadDay();
      expect(await position('dail-34-2025-06-25-vote_13')).toBe(second.afterPosition);
      expect(await position('dail-34-2025-06-25-vote_14')).toBe(third.afterPosition);
      expect(await located()).toBe(2);

      // Its speeches are those since the section's previous placed division (none: the start).
      const range = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => from + k);
      const ctx13 = await parliament.repository.divisionContext('dail-34-2025-06-25-vote_13');
      expect(ctx13?.division.sectionPosition).toBe(second.afterPosition);
      expect(ctx13?.siblings.find((s) => s.id === 'dail-34-2025-06-25-vote_14')?.sectionPosition).toBe(third.afterPosition);
      expect(ctx13?.speeches.map((s) => s.position)).toEqual(range(0, second.afterPosition));
      const ctx14 = await parliament.repository.divisionContext('dail-34-2025-06-25-vote_14');
      expect(ctx14?.speeches.map((s) => s.position)).toEqual(range(second.afterPosition, third.afterPosition));
      // Late in this long debate (five amendments moved, three voted on), each placed division
      // reads its own amendment: the third vote is on No. 5, and No. 1 and No. 2 are not in its text.
      const text = (ctx: typeof ctx14) => ctx?.speeches.map((s) => s.text).join('\n') ?? '';
      expect(text(ctx13)).toContain('I move amendment No. 2:');
      expect(text(ctx14)).toContain('I move amendment No. 5:');
      expect(text(ctx14)).not.toMatch(/I move amendment No\. [12]:/);
      // A division that is not placed still reads the whole section.
      expect((await parliament.repository.divisionContext('dail-34-2025-06-21-vote_12'))?.speeches).toHaveLength(32);

      // A second division with 47/104 makes that marker ambiguous: the next read clears it.
      await addClone(15, second.ta, second.nil);
      await reReadDay();
      expect(await position('dail-34-2025-06-25-vote_13')).toBeNull();
      expect(await position('dail-34-2025-06-25-vote_15')).toBeNull();
      expect(await position('dail-34-2025-06-25-vote_14')).toBe(third.afterPosition);
    } finally {
      await dbmod.pool.query(`delete from politics.divisions where id in ('dail-34-2025-06-25-vote_13', 'dail-34-2025-06-25-vote_14', 'dail-34-2025-06-25-vote_15')`);
    }
  });
});
