/**
 * The leave watch against a real Postgres: which silences it lists, what it does when the same
 * run is seen again or grows, and that confirming a leave writes a sourced absence that a
 * later sync does not wipe. Skipped unless TEST_DATABASE_URL is set; it uses its own database,
 * `<db>_leavewatch`, and rebuilds the `politics` schema there from every migration.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55433/postgres"
 *   npx vitest run server/parliament/leaveWatch.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('leavewatch');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

const day = (n: number) => `2025-03-${String(n).padStart(2, '0')}`;
const SINCE = '2024-11-29';

run('leave watch (real Postgres)', () => {
  let dbmod: typeof import('../db');
  let watch: typeof import('./leaveWatch');
  let fairness: typeof import('./repo/fairness');
  const ids: Record<string, number> = {};
  const code = (name: string) => `${name}.D.2020-02-08`;

  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const speak = (who: string, n: number) =>
    q(
      `insert into politics.debate_speeches (id, section_id, date, position, member_code, text, word_count)
       values ($1, $2, $3, 1, $4, 'x', 1)`,
      [`${day(n)}-sect/${who}`, `sect-${n}`, day(n), code(who)],
    );
  const unspeak = (who: string, n: number) => q('delete from politics.debate_speeches where member_code = $1 and date = $2', [code(who), day(n)]);
  // Dates are cast to text: node-postgres turns a date column into a local-midnight Date.
  const alerts = async (who: string) =>
    (
      await q(
        `select status, start_date::text, end_date::text, sitting_days, hints, resolved_by, days_when_resolved
         from politics.td_leave_alerts where member_code = $1 order by start_date`,
        [code(who)],
      )
    ).rows as Array<{
      status: string; start_date: string; end_date: string; sitting_days: number; hints: Array<{ title: string }>; resolved_by: string | null; days_when_resolved: number | null;
    }>;
  const absences = async () =>
    (await q('select member_code, td_id, start_date::text, end_date::text, reason, source_url, origin from politics.td_absences')).rows;

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    watch = await import('./leaveWatch');
    fairness = await import('./repo/fairness');

    for (const name of ['Ann', 'Bob', 'Cat']) {
      const { rows } = await q('insert into politics.tds (name, member_code) values ($1, $2) returning id', [name, code(name)]);
      ids[name] = rows[0].id as number;
      await q(
        `insert into politics.td_parliament_stats (td_id, member_since, divisions_eligible, votes_cast, sitting_days, sections_spoken, speeches)
         values ($1, $2, 0, 0, 0, 0, 0)`,
        [ids[name], SINCE],
      );
    }
    // 30 sitting days. Ann speaks on every one. Bob is silent on days 4-13 (10 days); Cat on 6-10 (5 days).
    for (let n = 1; n <= 30; n++) {
      await q("insert into politics.debate_sections (id, date, title, speech_count) values ($1, $2, 'Debate', 1)", [`sect-${n}`, day(n)]);
      await speak('Ann', n);
      if (n < 4 || n > 13) await speak('Bob', n);
      if (n < 6 || n > 10) await speak('Cat', n);
    }
    // News: one article about Bob that points to leave, one that does not, one about Ann.
    await q("insert into politics.news_sources (slug, name, homepage_url) values ('t', 'T', 'https://t.test')");
    const article = async (title: string, who: string, published: string) => {
      const { rows } = await q(
        "insert into politics.news_articles (source_id, url, title, published_at) values ((select id from politics.news_sources limit 1), $1, $2, $3) returning id",
        [`https://t.test/${encodeURIComponent(title)}`, title, published],
      );
      await q('insert into politics.article_tds (article_id, td_id) values ($1, $2)', [rows[0].id, ids[who]]);
    };
    await article('Bob Bob to take medical leave, party says', 'Bob', `${day(5)}T09:00:00Z`);
    await article('Bob Bob welcomes new housing plan', 'Bob', `${day(6)}T09:00:00Z`);
    await article('Ann Ann announces maternity leave', 'Ann', `${day(2)}T09:00:00Z`);
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('opens an alert for a long silence only, with the news that may explain it', async () => {
    const s = await watch.runLeaveWatch();
    expect(s).toMatchObject({ opened: 1, updated: 0, reopened: 0, closed: 0, open: 1 });

    expect(await alerts('Ann')).toEqual([]);
    expect(await alerts('Cat')).toEqual([]); // 5 days is below the 8-day minimum
    const [bob] = await alerts('Bob');
    expect(bob).toMatchObject({ status: 'open', start_date: day(4), end_date: day(13), sitting_days: 10 });
    // The leave article is a hint; the housing one and Ann's leave article are not.
    expect(bob.hints.map((h) => h.title)).toEqual(['Bob Bob to take medical leave, party says']);
  });

  it('sees the same run again without opening a second alert, and follows it as it grows', async () => {
    expect(await watch.runLeaveWatch()).toMatchObject({ opened: 0, updated: 1, closed: 0, open: 1 });
    await unspeak('Bob', 14);
    expect(await watch.runLeaveWatch()).toMatchObject({ opened: 0, updated: 1, open: 1 });
    expect(await alerts('Bob')).toMatchObject([{ status: 'open', start_date: day(4), end_date: day(14), sitting_days: 11 }]);
  });

  it('lists the alert with the TD name for the admin page', async () => {
    const list = await watch.listLeaveAlerts('open');
    expect(list).toMatchObject([{ name: 'Bob', memberCode: code('Bob'), from: day(4), to: day(14), sittingDays: 11, status: 'open' }]);
    expect(list[0].hints).toHaveLength(1);
  });

  it('refuses a confirmation that has no valid source or does not cover the silence', async () => {
    const [{ id }] = await watch.listLeaveAlerts('open');
    const good = { reason: 'medical_leave' as const, from: day(3), to: null, sourceUrl: 'https://party.test/announcement', note: 'Announced by the party.' };
    await expect(watch.confirmLeave(id, { ...good, sourceUrl: 'http://party.test/x' }, 'admin@x.test')).rejects.toMatchObject({ status: 400 });
    await expect(watch.confirmLeave(id, { ...good, sourceUrl: '' }, 'admin@x.test')).rejects.toMatchObject({ status: 400 });
    await expect(watch.confirmLeave(id, { ...good, from: day(20), to: day(25) }, 'admin@x.test')).rejects.toMatchObject({ status: 400 });
    await expect(watch.confirmLeave(id, { ...good, from: day(1), to: day(2) }, 'admin@x.test')).rejects.toMatchObject({ status: 400 });
    await expect(watch.confirmLeave(99999, good, 'admin@x.test')).rejects.toMatchObject({ status: 404 });
    expect((await q('select count(*)::int n from politics.td_absences')).rows[0].n).toBe(0);
    expect((await alerts('Bob'))[0].status).toBe('open');
  });

  it('confirms a leave as a sourced absence that stays through a sync', async () => {
    const [{ id }] = await watch.listLeaveAlerts('open');
    const input = { reason: 'medical_leave' as const, from: day(3), to: null, sourceUrl: 'https://party.test/announcement', note: 'Announced by the party.' };
    await watch.confirmLeave(id, input, 'admin@x.test');

    expect(await absences()).toMatchObject([
      { member_code: code('Bob'), td_id: ids.Bob, start_date: day(3), end_date: null, reason: 'medical_leave', source_url: input.sourceUrl, origin: 'admin' },
    ]);
    expect(await alerts('Bob')).toMatchObject([{ status: 'confirmed', resolved_by: 'admin@x.test', days_when_resolved: 11 }]);
    await expect(watch.confirmLeave(id, input, 'admin@x.test')).rejects.toMatchObject({ status: 409 });
    await expect(watch.dismissLeave(id, null, 'admin@x.test')).rejects.toMatchObject({ status: 409 });

    // Every sync reloads the list in absences.ts. It must not wipe what an admin confirmed.
    await fairness.replaceAbsences([], new Map([[code('Bob'), ids.Bob]]));
    expect((await q('select origin from politics.td_absences')).rows).toEqual([{ origin: 'admin' }]);

    // The days are covered now: no new alert, and the confirmed one is left alone.
    expect(await watch.runLeaveWatch()).toMatchObject({ opened: 0, closed: 0, open: 0 });
    expect((await alerts('Bob'))[0].status).toBe('confirmed');
  });

  it('turns a confirmed leave into a code row when the same leave is added to the list', async () => {
    await fairness.replaceAbsences(
      [{ memberCode: code('Bob'), from: day(3), to: day(14), reason: 'medical_leave', source: 'https://party.test/announcement', note: null }],
      new Map([[code('Bob'), ids.Bob]]),
    );
    expect(await absences()).toMatchObject([{ origin: 'code', end_date: day(14) }]);
    // And the list's own rows are replaced, as before.
    await fairness.replaceAbsences([], new Map());
    expect((await q('select count(*)::int n from politics.td_absences')).rows[0].n).toBe(0);
  });

  it('dismisses a run, leaves it alone, and opens it again when it doubles', async () => {
    const first = await watch.runLeaveWatch(dbmod.db, 5);
    expect(first.opened).toBeGreaterThanOrEqual(1);
    const [cat] = await alerts('Cat');
    expect(cat).toMatchObject({ status: 'open', start_date: day(6), end_date: day(10), sitting_days: 5 });
    const [{ id }] = (await watch.listLeaveAlerts('open')).filter((a) => a.memberCode === code('Cat'));

    await watch.dismissLeave(id, 'No public reason found.', 'admin@x.test');
    expect(await alerts('Cat')).toMatchObject([{ status: 'dismissed', days_when_resolved: 5 }]);

    // Still silent, but no longer than when it was dismissed: it stays dismissed.
    expect(await watch.runLeaveWatch(dbmod.db, 5)).toMatchObject({ reopened: 0 });
    expect((await alerts('Cat'))[0].status).toBe('dismissed');

    // Four more silent days is not double yet; five is.
    for (const n of [11, 12, 13, 14]) await unspeak('Cat', n);
    expect(await watch.runLeaveWatch(dbmod.db, 5)).toMatchObject({ reopened: 0 });
    expect((await alerts('Cat'))[0]).toMatchObject({ status: 'dismissed', sitting_days: 9 });
    await unspeak('Cat', 15);
    expect(await watch.runLeaveWatch(dbmod.db, 5)).toMatchObject({ reopened: 1 });
    expect((await alerts('Cat'))[0]).toMatchObject({ status: 'open', sitting_days: 10, days_when_resolved: null, resolved_by: null });
  });

  it('closes an open alert by itself when the TD speaks again', async () => {
    await speak('Cat', 8); // splits the run into days 6-7 (2) and 9-15 (7)
    const s = await watch.runLeaveWatch(dbmod.db, 5);
    expect(s).toMatchObject({ closed: 1, opened: 1 });
    const cat = await alerts('Cat');
    expect(cat).toMatchObject([
      { start_date: day(6), status: 'closed', resolved_by: 'watch' },
      { start_date: day(9), status: 'open', sitting_days: 7 },
    ]);
  });
});
