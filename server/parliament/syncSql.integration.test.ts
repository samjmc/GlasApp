/**
 * The sync's set-based SQL against the statements it replaced, on one generated record shaped like
 * GlasCore's (TDs on leave, in office and leading a party, a chair who does not vote, members not in
 * the roster, nested and motion sections, committees). Each rewrite must give exactly the old result:
 * recomputeStats and recomputeCommitteeStats (range joins instead of an EXISTS per TD per day),
 * relinkTds (only the wrong (member, td) pairs) and the first speakers regroupDebates reads.
 * Skipped unless TEST_DATABASE_URL is set; uses its own database, `<db>_syncsql`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55471/postgres"
 *   npx vitest run server/parliament/syncSql.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';
import { groupDebates, moverOf } from './debateGroups';

const url = testDatabaseUrl('syncsql');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const code = (n: number) => `Member-${n}.D.2020-02-08`;
const ACTIVE = 40;

/** ~40 TDs over 30 sitting days: ~2k votes, ~1.4k speeches, 10 committees. Deterministic. */
const FIXTURE = `
  select setseed(0.42);
  insert into politics.tds (name, party, member_code, is_active)
  select 'TD ' || g, (array['FF','FG','SF','Lab','SD','Independent'])[1 + g % 6], 'Member-' || g || '.D.2020-02-08', g <= ${ACTIVE}
  from generate_series(1, ${ACTIVE + 5}) g;
  create temp table sit as
  select d::date date from generate_series('2025-01-07'::date, '2025-12-31'::date, '1 day') d
  where extract(isodow from d) in (2, 3, 4) and extract(doy from d)::int % 4 = 0;
  insert into politics.debate_sections (id, date, title, parent_id, speech_count)
  select 'dail-' || s.date || '-dbsect_' || k, s.date,
    (array['Health: Motion', 'Housing: Statements', 'Ceisteanna', 'Finance Bill 2025: Second Stage', 'Transport: Motion', 'Topical Issue Debate'])[k],
    case when k = 3 then 'dail-' || s.date || '-dbsect_2' end, 8
  from sit s cross join generate_series(1, 6) k;
  insert into politics.debate_speeches (id, section_id, date, position, member_code, td_id, is_presiding, text, word_count)
  select sec.id || '/spk_' || p, sec.id, sec.date, p,
    case when p % 4 = 0 then 'Member-1.D.2020-02-08'
         when random() < 0.05 then 'Senator-' || (1 + (random() * 5)::int) || '.S.2020'
         when random() < 0.03 then null
         else 'Member-' || (2 + (random() * ${ACTIVE + 3})::int) || '.D.2020-02-08' end,
    null, p % 4 = 0, 'speech ' || p, 100 + p
  from politics.debate_sections sec cross join generate_series(0, 7) p
  where random() < 0.9;
  update politics.debate_speeches s set td_id = t.id from politics.tds t where t.member_code = s.member_code;
  insert into politics.divisions (id, uri, house_no, date, debate_section_id, ta_count, nil_count, staon_count)
  select 'dail-34-' || s.date || '-vote_' || k, 'u:' || s.date || ':' || k, 34, s.date, 'dail-' || s.date || '-dbsect_' || k, 0, 0, 0
  from sit s cross join generate_series(1, 2) k;
  insert into politics.division_votes (division_id, member_code, td_id, vote)
  select d.id, t.member_code, t.id, (array['ta','nil','staon'])[1 + (random() * 2)::int]::politics.division_vote
  from politics.divisions d cross join politics.tds t
  where t.id <> 1 and random() < 0.85;
  insert into politics.division_votes (division_id, member_code, td_id, vote)
  select d.id, 'Former-' || g || '.D.2016', null, 'ta' from politics.divisions d cross join generate_series(1, 2) g where random() < 0.3;
  insert into politics.td_absences (member_code, start_date, end_date, reason, source_url) values
    ('Member-7.D.2020-02-08', '2025-03-01', '2025-05-15', 'parental_leave', 'https://x/a'),
    ('Member-20.D.2020-02-08', '2025-10-01', null, 'medical_leave', 'https://x/b'),
    ('Member-20.D.2020-02-08', '2025-02-01', '2025-02-20', 'bereavement', 'https://x/c'),
    ('Member-33.D.2020-02-08', '2025-06-10', '2025-07-20', 'other_leave', 'https://x/d');
  insert into politics.td_party_leaders (member_code, party, start_date, end_date, source_url)
  select 'Member-' || (3 + g * 5) || '.D.2020-02-08', 'P' || g, '2025-01-01'::date + g * 30, case when g % 2 = 0 then '2025-09-01'::date end, 'https://x/l' || g
  from generate_series(1, 6) g;
  insert into politics.td_offices (member_code, title, office_type, start_date, end_date)
  select 'Member-' || (2 + g * 3) || '.D.2020-02-08', 'Office ' || g,
    (array['cabinet', 'minister_of_state', 'other'])[1 + g % 3]::politics.office_type,
    '2025-01-23'::date + (g % 5) * 30, case when g % 4 = 0 then '2025-11-01'::date end
  from generate_series(1, 12) g;
  -- Member 7 is both on leave and in office for part of it; 20 overlaps two absences' edges.
  insert into politics.td_offices (member_code, title, office_type, start_date, end_date)
  values ('Member-7.D.2020-02-08', 'Minister for X', 'cabinet', '2025-04-01', null);
  insert into politics.committees (id, uri, name) select 'c' || g, 'uri:c' || g, 'Committee ' || g from generate_series(1, 10) g;
  insert into politics.committee_memberships (committee_id, member_code, td_id, start_date, end_date)
  select 'c' || (1 + (t.id * 3 + k) % 10), t.member_code, t.id, case when k = 2 then '2025-06-01'::date else '2025-01-15'::date end,
    case when k = 1 and t.id % 5 = 0 then '2025-09-30'::date end
  from politics.tds t cross join generate_series(1, 2) k
  on conflict do nothing;
  insert into politics.committee_sittings (uri, committee_id, date, present_count, unresolved_count)
  select 'sit:' || c.id || ':' || g, c.id, '2025-01-20'::date + (g * 23) % 330, case when g % 11 = 0 then 0 else 6 end, case when g % 13 = 0 then 1 else 0 end
  from politics.committees c cross join generate_series(1, 14) g;
  insert into politics.committee_attendance (sitting_uri, member_code, td_id)
  select s.uri, m.member_code, m.td_id from politics.committee_sittings s
  join politics.committee_memberships m on m.committee_id = s.committee_id where random() < 0.8
  on conflict do nothing;
`;

/** recomputeStats' two statements and recomputeCommitteeStats, as they were before the rewrite. */
const ON_LEAVE = (who: string, day: string) => `exists (
  select 1 from politics.td_absences a
  where a.member_code = ${who} and ${day} >= a.start_date and (a.end_date is null or ${day} <= a.end_date))`;
const OLD_STATS = [
  `with m as (
     select s.td_id, t.member_code, s.member_since
     from politics.td_parliament_stats s join politics.tds t on t.id = s.td_id),
   chair as (
     select distinct on (d.id) d.id division_id, p.member_code
     from politics.divisions d
     join politics.debate_speeches p on p.section_id = d.debate_section_id and p.is_presiding
     order by d.id, p.position desc),
   per_division as (
     select m.td_id,
       ${ON_LEAVE('m.member_code', 'd.date')} excused,
       (c.member_code is not null and c.member_code = m.member_code) last_chair,
       exists (select 1 from politics.division_votes v where v.division_id = d.id and v.member_code = m.member_code) voted,
       (exists (select 1 from politics.td_offices o
                where o.member_code = m.member_code and o.office_type in ('cabinet', 'minister_of_state')
                  and d.date >= o.start_date and (o.end_date is null or d.date <= o.end_date))
        or exists (select 1 from politics.td_party_leaders l
                   where l.member_code = m.member_code
                     and d.date >= l.start_date and (l.end_date is null or d.date <= l.end_date))) in_role
     from m
     join politics.divisions d on d.date >= m.member_since
     left join chair c on c.division_id = d.id),
   totals as (
     select td_id,
       count(*) filter (where not excused and not (last_chair and not voted)) eligible,
       count(*) filter (where voted and not excused) votes,
       count(*) filter (where last_chair and not voted and not excused) chaired,
       count(*) filter (where excused) excused_n,
       count(*) filter (where in_role and not excused and not (last_chair and not voted)) in_role_n
     from per_division group by td_id)
   update politics.td_parliament_stats s set
     divisions_eligible = t.eligible, votes_cast = t.votes, divisions_chaired = t.chaired,
     divisions_excused = t.excused_n, divisions_in_leadership = t.in_role_n
   from totals t where t.td_id = s.td_id`,
  `with m as (
     select s.td_id, t.member_code, s.member_since
     from politics.td_parliament_stats s join politics.tds t on t.id = s.td_id),
   days as materialized (
     select m.td_id, x.date, ${ON_LEAVE('m.member_code', 'x.date')} excused
     from m join (select distinct date from politics.debate_sections) x on x.date >= m.member_since),
   day_totals as (
     select td_id, count(*) filter (where not excused) days_n, count(*) filter (where excused) excused_n
     from days group by td_id),
   spoken as (
     select p.td_id, count(distinct p.section_id) sections, count(*) speeches
     from politics.debate_speeches p
     join politics.td_parliament_stats s on s.td_id = p.td_id
     left join days l on l.td_id = p.td_id and l.date = p.date and l.excused
     where not p.is_presiding and p.date >= s.member_since and l.td_id is null
     group by p.td_id)
   update politics.td_parliament_stats s set
     sitting_days = coalesce(dt.days_n, 0),
     sitting_days_excused = coalesce(dt.excused_n, 0),
     sections_spoken = coalesce(sp.sections, 0),
     speeches = coalesce(sp.speeches, 0)
   from m
   left join day_totals dt on dt.td_id = m.td_id
   left join spoken sp on sp.td_id = m.td_id
   where s.td_id = m.td_id`,
];
const OLD_ELIGIBLE = `
  select distinct s.uri, s.committee_id
  from politics.committee_sittings s
  join politics.committee_memberships m on m.committee_id = s.committee_id
  where m.td_id = st.td_id
    and s.date >= m.start_date and (m.end_date is null or s.date <= m.end_date)
    and s.date >= st.member_since
    and s.present_count > 0
    and s.unresolved_count = 0
    and not ${ON_LEAVE('m.member_code', 's.date')}`;
const OLD_COMMITTEE_STATS = `
  update politics.td_parliament_stats st set
    committee_sittings_eligible = (select count(*) from (${OLD_ELIGIBLE}) e),
    committee_sittings_attended = (select count(*) from (${OLD_ELIGIBLE}) e
      where exists (select 1 from politics.committee_attendance a where a.sitting_uri = e.uri and a.td_id = st.td_id))`;
const OLD_RELINK = ['division_votes', 'debate_speeches'].map(
  (table) => `update politics.${table} r set td_id = t.id from politics.tds t where t.member_code = r.member_code and r.td_id is distinct from t.id`,
);

const STAT_COLUMNS = `td_id, divisions_eligible, votes_cast, divisions_chaired, divisions_excused, divisions_in_leadership,
  sitting_days, sitting_days_excused, sections_spoken, speeches, committee_sittings_eligible, committee_sittings_attended`;

run('sync SQL rewrites give the old results (real Postgres)', () => {
  let dbmod: typeof import('../db');
  let repo: typeof import('./repository');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const stats = async () => (await q(`select ${STAT_COLUMNS} from politics.td_parliament_stats order by td_id`)).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    await q(FIXTURE);
  }, 120_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('recomputeStats and recomputeCommitteeStats count exactly what the correlated statements counted', async () => {
    // Member 1 is the chair (presides, never votes); 9 joined mid-term.
    const windows = new Map(
      Array.from({ length: ACTIVE }, (_, i) => [code(i + 1), { memberSince: i + 1 === 9 ? '2025-06-01' : '2024-11-29', isPresiding: i === 0 }]),
    );
    await repo.recomputeStats(windows, { start: '2024-11-29', today: '2026-01-01' });
    await repo.recomputeCommitteeStats();
    const now = await stats();

    // Back to the row recomputeStats inserts, then the old statements fill it.
    await q(`update politics.td_parliament_stats set divisions_eligible = 0, votes_cast = 0, divisions_chaired = 0, divisions_excused = 0,
               divisions_in_leadership = 0, sitting_days = 0, sitting_days_excused = 0, sections_spoken = 0, speeches = 0,
               committee_sittings_eligible = null, committee_sittings_attended = null`);
    for (const statement of [...OLD_STATS, OLD_COMMITTEE_STATS]) await q(statement);
    const old = await stats();

    expect(now).toHaveLength(ACTIVE);
    expect(now).toEqual(old);
    // Every path the rewrite changed is exercised, so the equality is not vacuous.
    const sum = (key: string) => now.reduce((n: number, r: Record<string, number>) => n + Number(r[key]), 0);
    for (const key of ['divisions_excused', 'divisions_in_leadership', 'divisions_chaired', 'sitting_days_excused', 'committee_sittings_attended']) {
      expect(sum(key), key).toBeGreaterThan(0);
    }
    expect(sum('committee_sittings_eligible')).toBeGreaterThan(sum('committee_sittings_attended'));
  });

  it('relinkTds changes exactly the rows the full-table relink changed', async () => {
    // Unlinked rows of a TD, rows linked to the wrong TD, and a non-member row pointing at a TD
    // (no tds row has its code, so neither version may touch it).
    await q(`update politics.debate_speeches set td_id = null where member_code in ($1, $2)`, [code(5), code(6)]);
    await q(`update politics.division_votes set td_id = null where member_code = $1`, [code(5)]);
    await q(`update politics.debate_speeches set td_id = 3 where member_code = $1`, [code(8)]);
    await q(`update politics.division_votes set td_id = 3 where member_code = $1`, [code(8)]);
    await q(`update politics.debate_speeches set td_id = 4 where id = (select min(id) from politics.debate_speeches where member_code like 'Senator-%')`);
    await q(`update politics.division_votes set td_id = 4 where member_code = 'Former-1.D.2016'`);
    const links = async () => ({
      speeches: (await q('select id, td_id from politics.debate_speeches order by id')).rows,
      votes: (await q('select division_id, member_code, td_id from politics.division_votes order by 1, 2')).rows,
    });
    const before = await links();
    await q('create table politics.relink_before as select id, td_id from politics.debate_speeches');
    await q('create table politics.relink_before_v as select division_id, member_code, td_id from politics.division_votes');

    for (const statement of OLD_RELINK) await q(statement);
    const old = await links();
    await q('update politics.debate_speeches s set td_id = b.td_id from politics.relink_before b where b.id = s.id');
    await q('update politics.division_votes v set td_id = b.td_id from politics.relink_before_v b where b.division_id = v.division_id and b.member_code = v.member_code');
    expect(await links()).toEqual(before);

    await repo.relinkTds();
    const now = await links();
    expect(now).toEqual(old);
    const changed = (a: typeof before, b: typeof before) =>
      a.speeches.filter((r: { td_id: number | null }, i: number) => r.td_id !== b.speeches[i].td_id).length +
      a.votes.filter((r: { td_id: number | null }, i: number) => r.td_id !== b.votes[i].td_id).length;
    expect(changed(before, now)).toBeGreaterThan(50);
    await q('drop table politics.relink_before, politics.relink_before_v');
  });

  it('regroupDebates names the same movers as when it read every first speaker', async () => {
    await repo.regroupDebates();
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
    const now = (await q('select id, kind, mover_member_code, mover_source from politics.debates')).rows.sort(byId);

    // The old way: the first speaker of EVERY section, then moverOf over the same grouping.
    const sections = (await q('select id, date::text, title, parent_id "parentId", parent_title "parentTitle" from politics.debate_sections')).rows;
    const firsts = (
      await q(`select distinct on (section_id) section_id, member_code from politics.debate_speeches
               where not is_presiding and member_code is not null order by section_id, position`)
    ).rows;
    const firstSpeakers = new Map(firsts.map((r: { section_id: string; member_code: string }) => [r.section_id, r.member_code]));
    const expected = groupDebates(sections, [])
      .map((d) => {
        const mover = moverOf(d, { primarySponsors: new Map(), offices: [], firstSpeakers });
        return { id: d.id, kind: d.kind, mover_member_code: mover?.memberCode ?? null, mover_source: mover?.source ?? null };
      })
      .sort(byId);

    expect(now).toEqual(expected);
    expect(now.filter((d: { mover_source: string | null }) => d.mover_source === 'first_speaker').length).toBeGreaterThan(20);
  });
});
