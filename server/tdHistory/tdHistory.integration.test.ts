/**
 * TD history against a real Postgres: one row per TD, an unchanged revision skipped, a new one
 * replacing the row, a failure writing nothing, the takedown, and migration 0016's guard. The
 * network (Wikipedia) and the model are fakes. Skipped unless TEST_DATABASE_URL is set; uses its
 * own database, `<db>_td_history`.
 *
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/tdHistory/tdHistory.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyAllMigrations, applyMigration, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('td_history');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.LOG_LEVEL = 'silent';
}

const LEAD = 'Ann Byrne (born 1970) is an Irish politician. She has been a TD for Cork South-West since 2020. She is from Bantry.';
const CAREER = 'She was elected to Cork County Council in 2009 and served as its Cathaoirleach from 2015 to 2016.';
const html = (extra = '') =>
  `<div class="mw-parser-output"><p>${LEAD}</p><div class="mw-heading mw-heading2"><h2>Career</h2></div><p>${CAREER}</p>${extra}` +
  `<div class="mw-heading mw-heading2"><h2>Controversies</h2></div><p>She was named in a dispute about planning that went on for years.</p></div>`;

/** A fake Wikipedia: `revision` is what the "newest revision ≥ 72 h old" query returns. */
function wikipedia(state: { revision: number; html: string }) {
  return async (input: string) => {
    const params = new URL(input).searchParams;
    const body =
      params.get('action') === 'parse'
        ? { parse: { text: state.html } }
        : { query: { pages: [{ title: 'Ann Byrne', pageprops: {}, revisions: [{ revid: state.revision }] }] } };
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

run('TD history (real Postgres)', () => {
  let dbmod: typeof import('../db');
  let history: typeof import('./index');
  let tdId: number;
  const q = (text: string, params: unknown[] = []) => dbmod.pool.query(text, params);
  const rows = async () => (await q('select td_id, summary, passages, source_revision, source_url, model from politics.td_historical_baselines')).rows;
  const td = () => ({ id: tdId, name: 'Ann Byrne', memberCode: 'Ann-Byrne.D.2020-02-08' });
  const chose = (passages: unknown) => async () => ({ passages });

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    history = await import('./index');
  }, 60_000);

  beforeEach(async () => {
    await applyAllMigrations(dbmod.pool);
    tdId = (await q(`insert into politics.tds (name, member_code) values ('Ann Byrne', 'Ann-Byrne.D.2020-02-08') returning id`)).rows[0].id;
    await q(`insert into politics.tds (name, member_code, is_active) values ('Gone TD', 'Gone.D.2011-03-09', false)`);
    await q(`insert into politics.tds (name) values ('No Code TD')`);
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('lists only active TDs with a member code', async () => {
    expect((await history.historyCandidates()).map((t) => t.name)).toEqual(['Ann Byrne']);
  });

  it('saves the summary and only the verified passages, with the exact revision', async () => {
    const outcome = await history.researchTd(td(), 'Ann Byrne', {
      complete: chose([CAREER, 'She was the greatest Cathaoirleach Cork County Council has ever had in its history.']),
      model: 'test-model',
      fetcher: wikipedia({ revision: 100, html: html() }),
    });
    expect(outcome.kind).toBe('saved');
    expect(await rows()).toEqual([
      {
        td_id: tdId,
        summary: 'Ann Byrne (born 1970) is an Irish politician. She has been a TD for Cork South-West since 2020.',
        passages: [CAREER],
        source_revision: '100',
        source_url: 'https://en.wikipedia.org/w/index.php?oldid=100',
        model: 'test-model',
      },
    ]);
  });

  it('skips an unchanged revision, and replaces the row for a new one', async () => {
    const state = { revision: 100, html: html() };
    const deps = { complete: chose([CAREER]), model: 'm', fetcher: wikipedia(state) };
    await history.researchTd(td(), 'Ann Byrne', deps);
    expect((await history.researchTd(td(), 'Ann Byrne', { ...deps, storedRevision: 100 })).kind).toBe('unchanged');

    state.revision = 101;
    state.html = html('<p>She was appointed Minister of State at the Department of Housing in January 2025.</p>');
    const next = await history.researchTd(td(), 'Ann Byrne', {
      ...deps,
      storedRevision: 100,
      complete: chose(['She was appointed Minister of State at the Department of Housing in January 2025.']),
    });
    expect(next.kind).toBe('saved');
    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ source_revision: '101', passages: ['She was appointed Minister of State at the Department of Housing in January 2025.'] });
  });

  it('writes nothing when the model fails, or on a dry run', async () => {
    const fetcher = wikipedia({ revision: 100, html: html() });
    expect((await history.researchTd(td(), 'Ann Byrne', { complete: async () => null, model: 'm', fetcher })).kind).toBe('model_failed');
    expect((await history.researchTd(td(), 'Ann Byrne', { complete: chose([CAREER]), model: 'm', fetcher, dryRun: true })).kind).toBe('saved');
    expect(await rows()).toEqual([]);
  });

  it('a passage from a cut section is never saved', async () => {
    await history.researchTd(td(), 'Ann Byrne', {
      complete: chose(['She was named in a dispute about planning that went on for years.']),
      model: 'm',
      fetcher: wikipedia({ revision: 100, html: html() }),
    });
    expect((await rows())[0].passages).toEqual([]);
  });

  it('--delete takes one TD down', async () => {
    await history.researchTd(td(), 'Ann Byrne', { complete: chose([CAREER]), model: 'm', fetcher: wikipedia({ revision: 100, html: html() }) });
    expect(await history.deleteHistory(tdId)).toBe(true);
    expect(await history.deleteHistory(tdId)).toBe(false);
    expect(await rows()).toEqual([]);
  });

  it('migration 0016 refuses to drop the old columns when the table holds a row', async () => {
    await applyAllMigrations(dbmod.pool, '0016_td_history_drop_judgement');
    const id = (await q(`insert into politics.tds (name) values ('Old Row TD') returning id`)).rows[0].id;
    await q(`insert into politics.td_historical_baselines (td_id, historical_summary) values ($1, 'old research')`, [id]);
    await expect(applyMigration(dbmod.pool, '0016_td_history_drop_judgement')).rejects.toThrow(/expects it empty/);
  });
});
