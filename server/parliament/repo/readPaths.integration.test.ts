/**
 * TD and party reads that stopped re-aggregating whole tables per request return exactly what the
 * old code returned: votesOf and parties() (party lines worked out in SQL, only for the divisions
 * shown), tdDebates (excerpt read for the listed sections only, cut in SQL) and the question
 * record's cohort (summed per member in SQL). The old code is kept below as the reference.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_readpaths`
 * (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/parliament/repo/readPaths.integration.test.ts
 */
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { debateSections, debateSpeeches, divisions, divisionVotes, tdParliamentStats } from '@shared/schema/parliament';
import { tds } from '@shared/schema/politics';
import type { TdVote } from '@shared/parliamentApi';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../../testing/migrations';
import { committeeAttendancePct, INDEPENDENT, majorityFor, partyLinePct, partyMajorities, percentile, type PartyVoteRow } from '../metrics';
import { COHORT_PERCENTILE, FIGURE_FORMATS, MIN_EXCHANGES, type QuestionParticipationRow } from '../questionItems/rules';

const url = testDatabaseUrl('readpaths');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const TDS = 24;
const DIVISIONS = 80;
const SECTIONS = 40;

run('TD and party reads: new vs old', () => {
  let dbmod: typeof import('../../db');
  let repo: typeof import('../repository');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);

  // ---- The OLD reads, as they were before this change. ----
  async function oldPartyVoteRows(party: string | null): Promise<PartyVoteRow[]> {
    const rows = await dbmod.db
      .select({ divisionId: divisionVotes.divisionId, party: tds.party, vote: divisionVotes.vote, n: count() })
      .from(divisionVotes)
      .innerJoin(tds, eq(tds.id, divisionVotes.tdId))
      .where(party === null ? isNotNull(tds.party) : eq(tds.party, party))
      .groupBy(divisionVotes.divisionId, tds.party, divisionVotes.vote);
    return rows.map((r) => ({ divisionId: r.divisionId, party: r.party as string, vote: r.vote, n: Number(r.n) }));
  }
  async function oldVotesOf(tdId: number, opts: { limit?: number; againstParty?: boolean; divisionId?: string } = {}): Promise<TdVote[]> {
    const [td] = await dbmod.db.select({ party: tds.party }).from(tds).where(eq(tds.id, tdId));
    if (!td) return [];
    const rows = await dbmod.db
      .select({ divisionId: divisions.id, date: divisions.date, subject: divisions.subject, debateTitle: divisions.debateTitle, outcome: divisions.outcome, vote: divisionVotes.vote })
      .from(divisionVotes)
      .innerJoin(divisions, eq(divisions.id, divisionVotes.divisionId))
      .where(and(eq(divisionVotes.tdId, tdId), opts.divisionId ? eq(divisions.id, opts.divisionId) : undefined))
      .orderBy(desc(divisions.date), desc(divisions.heldAt), desc(divisions.id));
    const majorities = td.party && td.party !== INDEPENDENT ? partyMajorities(await oldPartyVoteRows(td.party)) : new Map();
    let out: TdVote[] = rows.map((r) => {
      const partyMajority = majorityFor(majorities, r.divisionId, td.party);
      return { ...r, partyMajority, withParty: partyMajority === null ? null : r.vote === partyMajority };
    });
    if (opts.againstParty) out = out.filter((v) => v.withParty === false);
    return opts.limit ? out.slice(0, opts.limit) : out;
  }
  async function oldParties() {
    const members = await dbmod.db
      .select({
        party: tds.party,
        attendancePct: tds.attendancePct,
        sectionsSpoken: tdParliamentStats.sectionsSpoken,
        isPresiding: tdParliamentStats.isPresiding,
        committeeEligible: tdParliamentStats.committeeSittingsEligible,
        committeeAttended: tdParliamentStats.committeeSittingsAttended,
      })
      .from(tds)
      .leftJoin(tdParliamentStats, eq(tdParliamentStats.tdId, tds.id))
      .where(eq(tds.isActive, true));
    const pv = await oldPartyVoteRows(null);
    const majorities = partyMajorities(pv);
    const cohesion = new Map<string, { with: number; total: number }>();
    for (const r of pv) {
      const m = majorityFor(majorities, r.divisionId, r.party);
      if (m === null) continue;
      const c = cohesion.get(r.party) ?? { with: 0, total: 0 };
      c.total += r.n;
      if (r.vote === m) c.with += r.n;
      cohesion.set(r.party, c);
    }
    const groups = new Map<string, typeof members>();
    for (const m of members) {
      const party = m.party ?? INDEPENDENT;
      groups.set(party, [...(groups.get(party) ?? []), m]);
    }
    const avg = (xs: Array<number | null>) => {
      const present = xs.filter((x): x is number => x !== null);
      return present.length ? Math.round((present.reduce((a, b) => a + b, 0) / present.length) * 10) / 10 : null;
    };
    return Array.from(groups.entries())
      .map(([party, ms]) => {
        const c = cohesion.get(party);
        return {
          party,
          members: ms.length,
          avgAttendancePct: avg(ms.map((m) => m.attendancePct)),
          partyLinePct: c && c.total ? Math.round((c.with / c.total) * 1000) / 10 : null,
          avgSectionsSpoken: avg(ms.filter((m) => !m.isPresiding).map((m) => m.sectionsSpoken ?? null)),
          avgCommitteeAttendancePct: avg(
            ms.map((m) => (m.committeeEligible === null || m.committeeAttended === null ? null : committeeAttendancePct(m.committeeAttended, m.committeeEligible))),
          ),
        };
      })
      .sort((a, b) => b.members - a.members || a.party.localeCompare(b.party));
  }
  async function oldTdDebates(tdId: number, limit: number) {
    const rows = await dbmod.db
      .select({
        sectionId: debateSections.id,
        date: debateSections.date,
        title: debateSections.title,
        speeches: count(),
        words: sql<number>`sum(${debateSpeeches.wordCount})::int`,
        excerpt: sql<string>`left((array_agg(${debateSpeeches.text} order by ${debateSpeeches.position}))[1], 300)`,
      })
      .from(debateSpeeches)
      .innerJoin(debateSections, eq(debateSections.id, debateSpeeches.sectionId))
      .where(and(eq(debateSpeeches.tdId, tdId), eq(debateSpeeches.isPresiding, false)))
      .groupBy(debateSections.id, debateSections.date, debateSections.title)
      .orderBy(desc(debateSections.date), desc(debateSections.id))
      .limit(limit);
    return rows.map((r) => ({ ...r, speeches: Number(r.speeches), words: Number(r.words) }));
  }
  /** The old formatFigures, which grouped every backbench asker row of the table in Node. */
  function oldFormatFigures(mine: QuestionParticipationRow[], everyone: QuestionParticipationRow[]) {
    const askedRows = (rows: QuestionParticipationRow[]) => rows.filter((r) => r.asked && !r.inOffice);
    const rate = (rows: QuestionParticipationRow[]) => (10 * rows.filter((r) => r.secured > 0).length) / rows.length;
    const formats = Array.from(new Set(askedRows(mine).map((r) => r.format)));
    return formats.map((format) => {
      const rows = askedRows(mine).filter((r) => r.format === format);
      const scored = FIGURE_FORMATS.includes(format);
      const byMember = new Map<string, QuestionParticipationRow[]>();
      for (const r of askedRows(everyone).filter((x) => x.format === format)) byMember.set(r.memberCode, [...(byMember.get(r.memberCode) ?? []), r]);
      const cohort = Array.from(byMember.values()).filter((xs) => xs.length >= MIN_EXCHANGES).map(rate);
      return {
        format,
        asked: rows.length,
        securedExchanges: rows.filter((r) => r.secured > 0).length,
        points: rows.reduce((n, r) => n + r.points, 0),
        followUps: rows.reduce((n, r) => n + r.followUps, 0),
        perTen: scored && rows.length >= MIN_EXCHANGES ? Math.round(rate(rows) * 10) / 10 : null,
        cohortP75: scored && cohort.length > 0 ? Math.round(percentile(cohort, COHORT_PERCENTILE) * 10) / 10 : null,
        cohortSize: scored ? cohort.length : 0,
      };
    });
  }
  const toRow = (r: Record<string, unknown>): QuestionParticipationRow => ({
    exchangeId: r.exchange_id as string,
    format: r.format as QuestionParticipationRow['format'],
    memberCode: r.member_code as string,
    tdId: (r.td_id as number | null) ?? null,
    inOffice: r.role === 'office',
    governmentSide: false,
    asked: r.asked as boolean,
    spoke: true,
    secured: Number(r.secured),
    followUps: Number(r.follow_ups),
    answered: r.answered as boolean,
    answerClaims: Number(r.answer_claims),
    answerCommitments: Number(r.answer_commitments),
    points: Number(r.points),
  });
  async function oldFormats(code: string) {
    const [mine, everyone] = await Promise.all([
      q('select * from politics.question_participation where member_code = $1', [code]),
      q("select * from politics.question_participation where asked and role = 'backbench'"),
    ]);
    return oldFormatFigures(mine.rows.map(toRow), everyone.rows.map(toRow));
  }
  // ---- end of the old reads ----

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('../repository');

    // Parties of every size (a party of two ties often), Independents, a TD with no party, one inactive.
    await q(
      `insert into politics.tds (name, member_code, party, is_active, attendance_pct)
       select 'Deputy ' || i, 'Deputy-' || i || '.D.2020-02-08',
              case when i <= 9 then 'Party A' when i <= 15 then 'Party B' when i <= 17 then 'Party C'
                   when i <= 21 then $2 when i = 22 then null else 'Party A' end,
              i <> 24, case when i % 5 = 0 then null else 60 + i end
         from generate_series(1, $1::int) i`,
      [TDS, INDEPENDENT],
    );
    await q(
      `insert into politics.td_parliament_stats
         (td_id, member_since, is_presiding, divisions_eligible, votes_cast, sitting_days, speeches, sections_spoken, committee_sittings_eligible, committee_sittings_attended)
       select i, date '2024-11-29', i = 3, 80, 60, 40, 30, 10 + i, case when i % 4 = 0 then null else 20 end, 5 + i % 10 from generate_series(1, $1::int) i`,
      [TDS],
    );
    // Divisions over 40 days, two a day on some, held_at missing on some.
    await q(
      `insert into politics.divisions (id, uri, house_no, date, held_at, subject, outcome, debate_title, ta_count, nil_count, staon_count)
       select 'dail-34-' || to_char(d, 'YYYY-MM-DD') || '-vote_' || i, 'u' || i, 34, d,
              case when i % 7 = 0 then null else d + (i % 12) * interval '1 hour' end,
              'Subject ' || i, case when i % 3 = 0 then 'Lost' else 'Carried' end, 'Debate ' || (i % 9), 0, 0, 0
         from generate_series(1, $1::int) i, lateral (select date '2025-03-01' + (i / 2) d) x`,
      [DIVISIONS],
    );
    // Every TD votes in most divisions, mostly with a per-party line; plus voters not in tds.
    await q(
      `insert into politics.division_votes (division_id, member_code, td_id, vote)
       select d.id, t.member_code, t.id,
              (array['ta','nil','staon'])[1 + case when abs(hashtext(d.id || t.member_code)) % 10 < 7
                                                   then abs(hashtext(d.id || coalesce(t.party, ''))) % 3
                                                   else abs(hashtext(t.member_code || d.id)) % 3 end]::politics.division_vote
         from politics.divisions d cross join politics.tds t
        where abs(hashtext(t.member_code || d.id || 'x')) % 10 < 8`,
    );
    await q(
      `insert into politics.division_votes (division_id, member_code, td_id, vote)
       select d.id, 'Gone-' || g || '.D.2016-10-03', null, (array['ta','nil'])[1 + g % 2]::politics.division_vote
         from politics.divisions d, generate_series(1, 3) g`,
    );
    // Sections with several speeches by each speaker, long text with Irish characters, the chair too.
    await q(
      `insert into politics.debate_sections (id, date, title, speech_count)
       select 'dail-' || to_char(date '2025-03-01' + (i / 3), 'YYYY-MM-DD') || '-dbsect_' || i, date '2025-03-01' + (i / 3), 'Section ' || i, 0
         from generate_series(1, $1::int) i`,
      [SECTIONS],
    );
    await q(
      `insert into politics.debate_speeches (id, section_id, date, position, member_code, td_id, is_presiding, text, word_count)
       select s.id || '/spk_' || p, s.id, s.date, p, t.member_code, t.id, p % 11 = 0,
              repeat('Tá an Teachta ' || t.id || ' ag caint, ' || s.id || ' ' || p || '. ', 3 + p % 9), 20 + p
         from politics.debate_sections s, generate_series(0, 24) p,
              lateral (select * from politics.tds where id = 1 + abs(hashtext(s.id || p)) % $1) t`,
      [TDS],
    );
    // Question participation: every backbench asker pattern, office holders, all four formats.
    await q(
      `insert into politics.question_participation
         (exchange_id, member_code, td_id, format, role, asked, secured, follow_ups, answered, answer_claims, answer_commitments, points, rules_version)
       select 'x' || e || '#' || t.id, t.member_code, t.id,
              (array['oral_pq','topical_issue','leaders_questions','rapid'])[1 + (e + t.id) % 4]::politics.question_format,
              case when t.id % 6 = 0 then 'office' else 'backbench' end::politics.debate_role,
              abs(hashtext('a' || e || t.id)) % 10 < 7, abs(hashtext('s' || e || t.id)) % 3, e % 2, t.id % 6 = 0, 0, 0,
              case when abs(hashtext('s' || e || t.id)) % 3 > 0 then 2 else 0 end, 'q1'
         from politics.tds t, generate_series(1, 120) e
        where abs(hashtext('p' || e || t.id)) % 10 < (t.id % 10)`,
    );
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('the fixture has ties, votes against the party, and every voter kind', async () => {
    const all = (await Promise.all(Array.from({ length: TDS }, (_, i) => oldVotesOf(i + 1)))).flat();
    expect(all.length).toBeGreaterThan(1000);
    expect(all.filter((v) => v.withParty === false).length).toBeGreaterThan(50);
    expect(all.filter((v) => v.withParty === true).length).toBeGreaterThan(500);
    // A party (not an Independent) with no majority in some division: a tie.
    const c = await oldVotesOf(16); // Party C, two members
    expect(c.some((v) => v.partyMajority === null)).toBe(true);
    expect(c.some((v) => v.partyMajority !== null)).toBe(true);
  });

  it('votesOf: the same rows as before for every TD and every option', async () => {
    const { rows } = await q("select id from politics.divisions order by id limit 3");
    const options = [
      {},
      { limit: 1 },
      { limit: 7 },
      { againstParty: true },
      { againstParty: true, limit: 3 },
      ...rows.map((r) => ({ divisionId: r.id as string })),
      { divisionId: 'no-such-division' },
    ];
    let compared = 0;
    for (let id = 1; id <= TDS + 1; id++) {
      for (const opt of options) {
        const [before, after] = await Promise.all([oldVotesOf(id, opt), repo.votesOf(id, opt)]);
        expect(after, `td ${id} ${JSON.stringify(opt)}`).toEqual(before);
        compared += before.length;
      }
      const summary = await repo.tdSummary(id);
      const old = await oldVotesOf(id);
      expect(summary?.partyLinePct ?? null, `td ${id} party line`).toBe(id > TDS ? null : partyLinePct(old));
    }
    expect(compared).toBeGreaterThan(2000);
  });

  it('parties(): the same cohesion and averages as before', async () => {
    const [before, after] = await Promise.all([oldParties(), repo.parties()]);
    expect(before.filter((p) => p.partyLinePct !== null)).toHaveLength(3);
    expect(after).toEqual(before);
  });

  it('tdDebates: the same sections, counts and excerpts as before', async () => {
    let compared = 0;
    for (let id = 1; id <= TDS + 1; id++) {
      for (const limit of [1, 5, 100]) {
        const [before, after] = await Promise.all([oldTdDebates(id, limit), repo.tdDebates(id, limit)]);
        expect(after, `td ${id} limit ${limit}`).toEqual(before);
        compared += before.length;
      }
    }
    expect(compared).toBeGreaterThan(300);
    expect((await oldTdDebates(1, 100)).some((r) => r.excerpt.length === 300)).toBe(true);
  });

  it('tdQuestionRecord: the same per-format figures and cohort as before', async () => {
    const { rows } = await q('select id, member_code from politics.tds order by id');
    let cohorts = 0;
    for (const r of rows) {
      const [before, after] = await Promise.all([oldFormats(r.member_code), repo.tdQuestionRecord(r.id)]);
      expect(after?.formats ?? [], `td ${r.id}`).toEqual(before);
      cohorts += before.filter((f) => f.cohortSize > 0).length;
    }
    expect(cohorts).toBeGreaterThan(10);
  });
});
