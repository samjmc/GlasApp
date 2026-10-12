/**
 * The jobs' own safety, against a real Postgres: a dry run writes nothing anywhere in the
 * `politics` schema, and running a job a second time over the same data changes nothing. Each
 * test calls the library function its `npm run` entry calls; the network and the model are
 * fakes. Only the jobs that can run without either are here (see liveDbGuard.test.ts for the
 * approval step itself).
 *
 * "Nothing changed" is a hash of every row of every politics table, so a write to a table the
 * test did not think of still fails it. Skipped unless TEST_DATABASE_URL is set; uses its own
 * database, `<db>_jobs`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/jobs/jobs.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('jobs');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.LOG_LEVEL = 'silent';
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

/** Columns a rewrite stamps with the time it ran: when, not what, so they are not hashed. */
const STAMPS = new Set(['td_scores.computed_at', 'td_scores.updated_at', 'ideology_profiles.computed_at', 'td_leave_alerts.last_seen_at']);

const day = (n: number) => `2025-03-${String(n).padStart(2, '0')}`;
const LEAD = 'Ann Byrne (born 1970) is an Irish politician. She has been a TD for Cork South-West since 2020. She is from Bantry.';
const CAREER = 'She was elected to Cork County Council in 2009 and served as its Cathaoirleach from 2015 to 2016.';
const HTML = `<div class="mw-parser-output"><p>${LEAD}</p><div class="mw-heading mw-heading2"><h2>Career</h2></div><p>${CAREER}</p></div>`;

/** A fake Wikipedia that always has revision 100. */
const wikipedia = async (input: string) => {
  const body =
    new URL(input).searchParams.get('action') === 'parse'
      ? { parse: { text: HTML } }
      : { query: { pages: [{ title: 'Ann Byrne', pageprops: {}, revisions: [{ revid: 100 }] }] } };
  return new Response(JSON.stringify(body), { status: 200 });
};

run('jobs: dry runs and second runs (real Postgres)', { timeout: 60_000 }, () => {
  let dbmod: typeof import('../db');
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);

  /** Row count and content hash of every politics table. */
  async function snapshot(): Promise<Record<string, string>> {
    const { rows } = await q(
      `select c.table_name, c.column_name from information_schema.columns c
       join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
       where c.table_schema = 'politics' and t.table_type = 'BASE TABLE' order by c.table_name, c.ordinal_position`,
    );
    const columns = new Map<string, string[]>();
    for (const r of rows as Array<{ table_name: string; column_name: string }>) {
      if (STAMPS.has(`${r.table_name}.${r.column_name}`)) continue;
      columns.set(r.table_name, [...(columns.get(r.table_name) ?? []), `"${r.column_name}"`]);
    }
    const out: Record<string, string> = {};
    for (const [table, cols] of columns) {
      const row = `row(${cols.join(', ')})::text`;
      const res = await q(`select count(*)::int as n, md5(coalesce(string_agg(${row}, E'\\n' order by ${row}), '')) as h from politics."${table}"`);
      out[table] = `${res.rows[0].n}:${res.rows[0].h}`;
    }
    return out;
  }
  /** The tables whose rows differ between two snapshots. */
  const changed = (a: Record<string, string>, b: Record<string, string>) => Object.keys({ ...a, ...b }).filter((t) => a[t] !== b[t]).sort();

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);

    // Two TDs over 30 sitting days: Ann speaks on every one, Bob is silent on days 4-13.
    const td = async (name: string, code: string, party: string) =>
      (await q("insert into politics.tds (name, member_code, party, constituency) values ($1, $2, $3, 'Cork South-West') returning id", [name, code, party])).rows[0].id as number;
    const ann = await td('Ann Byrne', 'Ann-Byrne.D.2020-02-08', 'Fine Gael');
    const bob = await td('Bob Ryan', 'Bob-Ryan.D.2020-02-08', 'Sinn Féin');
    for (const id of [ann, bob]) {
      await q(
        `insert into politics.td_parliament_stats (td_id, member_since, divisions_eligible, votes_cast, sitting_days, sections_spoken, speeches)
         values ($1, '2024-11-29', 40, 30, 30, 10, 20)`,
        [id],
      );
    }
    for (let n = 1; n <= 30; n++) {
      await q("insert into politics.debate_sections (id, date, title, speech_count) values ($1, $2, 'Debate', 1)", [`sect-${n}`, day(n)]);
      for (const [who, code] of [['ann', 'Ann-Byrne.D.2020-02-08'], ['bob', 'Bob-Ryan.D.2020-02-08']] as const) {
        if (who === 'bob' && n >= 4 && n <= 13) continue;
        await q(
          `insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count) values ($1, $2, $3, 1, $4, 'x', 1)`,
          [`${day(n)}-sect/${who}`, `sect-${n}`, day(n), code],
        );
      }
    }
    const scoring = await import('../scoring');
    await scoring.repository.updateParliamentaryActivity([
      { memberCode: 'Ann-Byrne.D.2020-02-08', questionsOral: 40, questionsWritten: 160, attendancePct: 95, committeeAttendancePct: 68 },
    ]);
    // Ideology evidence: one debate row each, and one row of the old scoring panel's `article` kind.
    const ideology = await import('../ideology');
    const evidence = (td: number, source: 'debate' | 'article', ref: string) =>
      ideology.recordTdEvidence({ td, source, sourceRef: ref, raw: { economic: 0.5 }, weight: 1, observedAt: new Date('2025-03-01T00:00:00Z') });
    expect(await evidence(ann, 'debate', 'dail-1/spk_1')).toBe('recorded');
    expect(await evidence(bob, 'debate', 'dail-1/spk_2')).toBe('recorded');
    expect(await evidence(bob, 'article', '7')).toBe('recorded');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('the snapshot covers the schema', async () => {
    const s = await snapshot();
    expect(Object.keys(s).length).toBeGreaterThan(30);
    expect(s.tds).toMatch(/^2:/);
  });

  it('td-history: --dry-run writes nothing; a second run over the same revision changes nothing', async () => {
    const history = await import('../tdHistory');
    const [ann] = (await history.historyCandidates()).filter((t) => t.name === 'Ann Byrne');
    const research = async (dryRun: boolean) =>
      history.researchTd(ann!, 'Ann Byrne', {
        complete: async () => ({ passages: [CAREER] }),
        model: 'test-model',
        fetcher: wikipedia,
        storedRevision: (await history.storedRevisions()).get(ann!.id),
        dryRun,
      });

    const before = await snapshot();
    expect((await research(true)).kind).toBe('saved');
    expect(changed(before, await snapshot())).toEqual([]);

    expect((await research(false)).kind).toBe('saved');
    const first = await snapshot();
    expect(changed(before, first)).toEqual(['td_historical_baselines']);
    expect((await research(false)).kind).toBe('unchanged');
    expect(changed(first, await snapshot())).toEqual([]);
  });

  it('stances --rebuild, its purge of `article` evidence: --dry-run writes nothing; a second run deletes nothing', async () => {
    const { deleteTdEvidence } = await import('../ideology');
    const before = await snapshot();
    expect(await deleteTdEvidence('article', true)).toBe(1);
    expect(changed(before, await snapshot())).toEqual([]);

    expect(await deleteTdEvidence('article')).toBe(1);
    const first = await snapshot();
    expect(changed(before, first)).toEqual(['td_ideology_evidence']);
    expect(await deleteTdEvidence('article')).toBe(0);
    expect(changed(first, await snapshot())).toEqual([]);
  });

  it('scores:recalculate: a second run changes nothing', async () => {
    const { recalculateAll } = await import('../scoring');
    const before = await snapshot();
    expect((await recalculateAll()).tds).toBe(2);
    const first = await snapshot();
    expect(changed(before, first)).toContain('td_scores');
    await recalculateAll();
    expect(changed(first, await snapshot())).toEqual([]);
  });

  it('ideology --recalculate: a second run changes nothing', async () => {
    const { recalculateAll } = await import('../ideology');
    await recalculateAll();
    const first = await snapshot();
    expect((await q("select count(*)::int as n from politics.ideology_profiles where subject_kind = 'td'")).rows[0].n).toBe(2);
    expect((await recalculateAll()).tds).toBe(2);
    expect(changed(first, await snapshot())).toEqual([]);
  });

  it('parliament:leave-watch: a second run over the same record changes nothing', async () => {
    const { leaveWatch } = await import('../parliament');
    const before = await snapshot();
    expect(await leaveWatch.runLeaveWatch()).toMatchObject({ opened: 1, open: 1 });
    const first = await snapshot();
    expect(changed(before, first)).toEqual(['td_leave_alerts']);
    expect(await leaveWatch.runLeaveWatch()).toMatchObject({ opened: 0, reopened: 0, closed: 0, open: 1 });
    expect(changed(first, await snapshot())).toEqual([]);
  });
});
