/**
 * The repository's SQL, executed against a real Postgres.
 *
 * Unit tests cover the maths; nothing else executes a query, so a broken `onConflict`
 * target, a bad `nulls last` clause or a wrong transaction shape would ship silently.
 *
 * Skipped unless TEST_DATABASE_URL points at a database this test may DROP AND RECREATE
 * the `politics` schema in:
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/scoring/repository.integration.test.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const run = describe.skipIf(!TEST_DATABASE_URL);

// server/db.ts throws at import without this; point it at the test database.
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

run('repository against Postgres', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');

  beforeAll(async () => {
    dbmod = await import('../db');
    const migration = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'drizzle', '0000_politics_scoring.sql'),
      'utf8',
    );
    await dbmod.pool.query('drop schema if exists politics cascade');
    // drizzle-kit separates statements with a marker; Postgres wants them one at a time.
    for (const statement of migration.split('--> statement-breakpoint')) {
      const sql = statement.trim();
      if (sql) await dbmod.pool.query(sql);
    }
    repo = await import('./repository');
  }, 60_000);

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('applies the migration and starts empty', async () => {
    expect(await repo.listActive()).toEqual([]);
    expect(await repo.listConstituencies()).toEqual([]);
  });

  it('syncTds inserts, updates, deactivates and never deletes', async () => {
    const first = await repo.syncTds([
      { name: 'Mary Lou McDonald', party: 'Sinn Féin', constituency: 'Dublin Central', memberCode: 'MLM.D.2011', imageUrl: null },
      { name: 'Simon Harris', party: 'Fine Gael', constituency: 'Wicklow', memberCode: 'SH.D.2011', imageUrl: null },
    ]);
    expect(first).toEqual({ inserted: 2, updated: 0, deactivated: 0 });

    // Re-running the same roster is a no-op.
    const again = await repo.syncTds([
      { name: 'Mary Lou McDonald', party: 'Sinn Féin', constituency: 'Dublin Central', memberCode: 'MLM.D.2011', imageUrl: null },
      { name: 'Simon Harris', party: 'Fine Gael', constituency: 'Wicklow', memberCode: 'SH.D.2011', imageUrl: null },
    ]);
    expect(again).toEqual({ inserted: 0, updated: 0, deactivated: 0 });

    // Dropping one deactivates it; the row survives.
    const shrunk = await repo.syncTds([
      { name: 'Mary Lou McDonald', party: 'Sinn Féin', constituency: 'Dublin Central', memberCode: 'MLM.D.2011', imageUrl: null },
    ]);
    expect(shrunk).toEqual({ inserted: 0, updated: 0, deactivated: 1 });
    expect((await repo.listActive()).map((r) => r.td.name)).toEqual(['Mary Lou McDonald']);
    expect(await repo.findByName('Simon Harris')).not.toBeNull();

    // And restoring the roster reactivates rather than duplicating.
    const restored = await repo.syncTds([
      { name: 'Mary Lou McDonald', party: 'Sinn Féin', constituency: 'Dublin Central', memberCode: 'MLM.D.2011', imageUrl: null },
      { name: 'Simon Harris', party: 'Fine Gael', constituency: 'Wicklow', memberCode: 'SH.D.2011', imageUrl: null },
    ]);
    expect(restored).toEqual({ inserted: 0, updated: 1, deactivated: 0 });
    expect(await repo.listActive()).toHaveLength(2);
  });

  it('findByName is case-insensitive; search matches name, party and constituency', async () => {
    expect((await repo.findByName('  mary lou mcdonald '))?.td.party).toBe('Sinn Féin');
    expect((await repo.search('wicklow', 10)).map((r) => r.td.name)).toEqual(['Simon Harris']);
    expect((await repo.search('Féin', 10)).map((r) => r.td.name)).toEqual(['Mary Lou McDonald']);
    expect(await repo.search('nobody at all', 10)).toEqual([]);
  });

  it('applyElo upserts the score row, counts the story and writes one history row per change', async () => {
    const mary = (await repo.findByName('Mary Lou McDonald'))!;
    const { applyArticle, baselineRatings } = await import('./elo');
    const { updated, changes } = applyArticle(repo.ratingsOf(mary.score), { overall: 10, integrity: -5 }, 1);
    expect(changes).toHaveLength(2);

    await repo.applyElo(mary.td.id, updated, changes, { articleId: 101, credibility: 0.9, confidence: 0.8 });

    const after = (await repo.findByName('Mary Lou McDonald'))!;
    expect(after.score?.overallElo).toBe(1532);
    expect(after.score?.integrityElo).toBe(1484);
    expect(after.score?.totalStories).toBe(1);
    expect(after.score?.lastScoredAt).toBeInstanceOf(Date);

    // A second article on the same TD increments rather than replacing.
    const second = applyArticle(repo.ratingsOf(after.score), { overall: 2 }, 1);
    await repo.applyElo(mary.td.id, second.updated, second.changes, { articleId: 102, credibility: 0.9, confidence: 0.8 });
    expect((await repo.findByName('Mary Lou McDonald'))!.score?.totalStories).toBe(2);
    expect(baselineRatings().overall).toBe(1500);
  });

  it('upsertArticleScore is idempotent on (article, td)', async () => {
    const mary = (await repo.findByName('Mary Lou McDonald'))!;
    const row = {
      articleId: 101,
      tdId: mary.td.id,
      impact: 7.5,
      dimensionScores: { transparency: 80, effectiveness: null, integrity: 20, consistency: null },
      storyType: 'policy',
      sentiment: 'positive',
      needsReview: false,
      reasoning: 'first',
      analyzedBy: 'panel',
      isIdeologicalPolicy: true,
      policyDirection: 'progressive',
    };
    await repo.upsertArticleScore(row);
    await repo.upsertArticleScore({ ...row, reasoning: 'second', impact: 6 });
    const recent = await repo.recentArticleScores(mary.td.id, 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].reasoning).toBe('second');
    expect(Number(recent[0].impact)).toBe(6);
    expect(recent[0].dimensionScores).toEqual({ transparency: 80, effectiveness: null, integrity: 20, consistency: null });
  });

  it('updateParliamentaryActivity fills the pillar inputs by member code', async () => {
    const written = await repo.updateParliamentaryActivity([
      { memberCode: 'MLM.D.2011', questionsOral: 40, questionsWritten: 160, attendancePct: 95 },
      { memberCode: 'DOES.NOT.EXIST', questionsOral: 1, questionsWritten: 1, attendancePct: 1 },
    ]);
    expect(written).toBe(1);
    const mary = (await repo.findByName('Mary Lou McDonald'))!;
    expect(mary.td.questionCountOral).toBe(40);
    expect(mary.td.attendancePct).toBe(95);
  });

  it('rollup writes derived scores and ranks that the reads then serve', async () => {
    const { computeRollup } = await import('./rollup');
    const inputs = await repo.rollupInputs(new Map());
    expect(inputs).toHaveLength(2);
    const mary = inputs.find((i) => i.party === 'Sinn Féin')!;
    expect(mary.questions).toBe(200);
    expect(mary.attendancePct).toBe(95);
    // Simon has no parliamentary data at all.
    expect(inputs.find((i) => i.party === 'Fine Gael')!.questions).toBeNull();

    await repo.writeRollup(computeRollup(inputs));
    const rows = await repo.listActive();
    const top = rows[0];
    expect(top.td.name).toBe('Mary Lou McDonald');
    expect(top.score?.nationalRank).toBe(1);
    expect(top.score?.parliamentaryScore).toBe(100);
    expect(top.score?.overallScore).not.toBeNull();
    // Simon: news pillar only, so his overall equals his news score.
    const simon = rows.find((r) => r.td.name === 'Simon Harris')!;
    expect(simon.score?.parliamentaryScore).toBeNull();
    expect(simon.score?.overallScore).toBe(simon.score?.newsScore);
  });

  it('writeTrends sums recent history and movers reports it', async () => {
    await repo.writeTrends();
    const mary = (await repo.findByName('Mary Lou McDonald'))!;
    // impact 10 -> +32, then impact 2 -> +6 (2/10 x K(32) x credibility 1). Overall only:
    // the integrity change from the first article is not counted in the trend.
    expect(mary.score?.eloChange7d).toBe(38);
    expect(mary.score?.eloChange30d).toBe(38);
    const simon = (await repo.findByName('Simon Harris'))!;
    expect(simon.score?.eloChange7d ?? 0).toBe(0);

    const movers = await repo.movers(30, 5);
    expect(movers).toHaveLength(1);
    expect(movers[0]).toMatchObject({ delta: 38, articles: 2 });
    expect(movers[0].td.name).toBe('Mary Lou McDonald');
  });

  it('party scores are replaced wholesale', async () => {
    const { computePartyScores } = await import('./party');
    const inputs = await repo.rollupInputs(new Map());
    await repo.replacePartyScores(computePartyScores(inputs));
    expect((await repo.listPartyScores()).map((p) => p.party)).toEqual(['Sinn Féin', 'Fine Gael']);

    await repo.replacePartyScores(computePartyScores(inputs.filter((i) => i.party === 'Fine Gael')));
    const only = await repo.listPartyScores();
    expect(only).toHaveLength(1);
    expect(only[0].party).toBe('Fine Gael');
  });

  it('lists by party and constituency, and enumerates constituencies', async () => {
    expect((await repo.listByParty('fine gael')).map((r) => r.td.name)).toEqual(['Simon Harris']);
    expect((await repo.listByConstituency('DUBLIN CENTRAL')).map((r) => r.td.name)).toEqual(['Mary Lou McDonald']);
    expect(await repo.listConstituencies()).toEqual(['Dublin Central', 'Wicklow']);
  });

  it('deleting a TD cascades their scores and history', async () => {
    const simon = (await repo.findByName('Simon Harris'))!;
    await dbmod.pool.query('delete from politics.tds where id = $1', [simon.td.id]);
    const { rows } = await dbmod.pool.query('select count(*)::int as n from politics.td_scores where td_id = $1', [simon.td.id]);
    expect(rows[0].n).toBe(0);
  });
});
