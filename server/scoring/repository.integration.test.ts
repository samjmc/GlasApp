/**
 * The repository's SQL, executed against a real Postgres.
 *
 * Unit tests cover the maths; nothing else executes a query, so a broken `onConflict`
 * target, a bad `nulls last` clause or a wrong transaction shape would ship silently.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_scoring`, because
 * every integration test drops and recreates `politics` and vitest runs files in
 * parallel (see server/testing/migrations.ts):
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/scoring/repository.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('scoring');
const run = describe.skipIf(!url);

// server/db.ts throws at import without this; point it at the test database.
if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

run('repository against Postgres', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
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
    const { rows: recent } = await dbmod.pool.query(
      'select reasoning, impact, dimension_scores from politics.article_td_scores where td_id = $1',
      [mary.td.id],
    );
    expect(recent).toHaveLength(1);
    expect(recent[0].reasoning).toBe('second');
    expect(Number(recent[0].impact)).toBe(6);
    expect(recent[0].dimension_scores).toEqual({ transparency: 80, effectiveness: null, integrity: 20, consistency: null });
  });

  it('updateParliamentaryActivity fills the pillar inputs by member code', async () => {
    const written = await repo.updateParliamentaryActivity([
      { memberCode: 'MLM.D.2011', questionsOral: 40, questionsWritten: 160, attendancePct: 95, committeeAttendancePct: 68 },
      { memberCode: 'DOES.NOT.EXIST', questionsOral: 1, questionsWritten: 1, attendancePct: 1, committeeAttendancePct: 1 },
    ]);
    expect(written).toBe(1);
    const mary = (await repo.findByName('Mary Lou McDonald'))!;
    expect(mary.td.questionCountOral).toBe(40);
    expect(mary.td.attendancePct).toBe(95);
    expect(mary.td.committeeAttendancePct).toBe(68);
  });

  it('rollup writes derived scores and ranks that the reads then serve', async () => {
    const { computeRollup } = await import('./rollup');
    const inputs = await repo.rollupInputs(new Map());
    expect(inputs).toHaveLength(2);
    const mary = inputs.find((i) => i.party === 'Sinn Féin')!;
    expect(mary.questions).toBe(200);
    expect(mary.attendancePct).toBe(95);
    expect(mary.committeeAttendancePct).toBe(68);
    // Simon has no parliamentary data at all.
    expect(inputs.find((i) => i.party === 'Fine Gael')!.questions).toBeNull();

    await repo.writeRollup(computeRollup(inputs));
    const rows = await repo.listActive();
    const top = rows[0];
    expect(top.td.name).toBe('Mary Lou McDonald');
    expect(top.score?.nationalRank).toBe(1);
    // Questions and votes at their benchmarks (100); committees 68 of 85 = 80: 50 + 30 + 16.
    expect(top.score?.parliamentaryScore).toBe(96);
    // No debate record: the parliamentary pillar is the whole score.
    expect(top.score?.overallScore).toBe(96);
    // The news score an older rollup stored is cleared.
    expect(top.score?.newsScore).toBeNull();
    // Simon has no facts at all: no score, no rank.
    const simon = rows.find((r) => r.td.name === 'Simon Harris')!;
    expect(simon.score).toMatchObject({ parliamentaryScore: null, overallScore: null, nationalRank: null });
  });

  it('the chair is read from the parliament record and left unranked', async () => {
    const simon = (await repo.findByName('Simon Harris'))!;
    expect(simon.stats).toBeNull();
    await dbmod.pool.query(
      `insert into politics.td_parliament_stats
         (td_id, member_since, is_presiding, divisions_eligible, votes_cast, sitting_days, sections_spoken, speeches)
       values ($1, '2024-11-29', true, 40, 0, 20, 0, 0)`,
      [simon.td.id],
    );
    // Question counts default to 0 and committee attendance is measured for anyone.
    await repo.updateParliamentaryActivity([
      { memberCode: 'SH.D.2011', questionsOral: 0, questionsWritten: 0, attendancePct: null, committeeAttendancePct: 90 },
    ]);

    const { computeRollup } = await import('./rollup');
    const inputs = await repo.rollupInputs(new Map());
    expect(inputs.find((i) => i.tdId === simon.td.id)).toMatchObject({ isPresiding: true, questions: 0, committeeAttendancePct: 90 });
    await repo.writeRollup(computeRollup(inputs));

    const after = (await repo.findByName('Simon Harris'))!;
    expect(after.stats?.isPresiding).toBe(true);
    expect(after.score).toMatchObject({ parliamentaryScore: null, overallScore: null, nationalRank: null, partyRank: null });
    expect((await repo.listActive()).map((r) => r.td.name)).toEqual(['Mary Lou McDonald', 'Simon Harris']);
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
