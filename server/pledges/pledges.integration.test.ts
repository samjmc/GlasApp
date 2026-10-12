/**
 * The pledge repository against a real Postgres: migration, constraints, uniqueness and
 * the ranking transaction. Skipped unless TEST_DATABASE_URL is set; uses its own
 * database `<db>_pledges` (see server/testing/migrations.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PLEDGE_CATEGORIES, type CategoryWeights, type PledgeCategory } from '@shared/pledges';
import { consentTo } from '../testing/consent';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('pledges');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
}

run('pledges against Postgres', () => {
  let repo: typeof import('./repository');
  let dbmod: typeof import('../db');

  const pledge = (overrides: Record<string, unknown> = {}) => ({
    party: 'Party X',
    title: 'Build 10,000 homes',
    description: 'Build them by 2030.',
    category: 'housing',
    electionYear: 2024,
    sourceUrl: 'https://party.ie/manifesto',
    ...overrides,
  });

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    const applied = await applyAllMigrations(dbmod.pool);
    expect(applied).toContain('0002_pledges');
    await consentTo(dbmod.pool, 'u1', 'u2');
    repo = await import('./repository');
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query('truncate politics.pledge_evidence, politics.pledges, politics.pledge_category_priorities restart identity cascade');
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('creates a pledge as unassessed, and refuses the same party+title+year in any case', async () => {
    const created = await repo.createPledge(pledge());
    expect(created).toMatchObject({ status: 'unassessed', reviewedAt: null, evidenceCount: 0 });
    expect(await repo.createPledge(pledge({ party: 'PARTY x', title: 'build 10,000 HOMES' }))).toBeNull();
    // A different election is a different pledge.
    expect(await repo.createPledge(pledge({ electionYear: 2020 }))).not.toBeNull();
  });

  it('enforces the status and category lists at the database', async () => {
    await expect(repo.createPledge(pledge({ category: 'vibes' }))).rejects.toThrow();
    const created = (await repo.createPledge(pledge()))!;
    await expect(repo.updatePledge(created.id, { status: 'kinda' })).rejects.toThrow();
  });

  it('a status change stamps reviewedAt; other edits do not', async () => {
    const created = (await repo.createPledge(pledge()))!;
    const edited = await repo.updatePledge(created.id, { description: 'Clearer.' });
    expect(edited!.reviewedAt).toBeNull();
    const reviewed = await repo.updatePledge(created.id, { status: 'delivered', statusNote: 'Target met.' });
    expect(reviewed).toMatchObject({ status: 'delivered', statusNote: 'Target met.' });
    expect(reviewed!.reviewedAt).not.toBeNull();
    expect(await repo.updatePledge(99999, { status: 'broken' })).toBeNull();
  });

  it('evidence counts, orders newest first, and goes with its pledge', async () => {
    await dbmod.pool.query(
      `insert into politics.divisions (id, uri, house_no, date, ta_count, nil_count, staon_count)
       values ('dail-34-2025-09-01-vote_1', 'https://data.oireachtas.ie/vote_1', 34, '2025-09-01', 80, 60, 0)`,
    );
    const created = (await repo.createPledge(pledge()))!;
    await repo.addEvidence({ pledgeId: created.id, kind: 'bill_introduced', summary: 'Bill published.', occurredOn: '2025-02-01', sourceUrl: 'https://oireachtas.ie/b' });
    await repo.addEvidence({ pledgeId: created.id, kind: 'legislation_passed', summary: 'Act signed.', occurredOn: '2025-09-01', sourceUrl: 'https://oireachtas.ie/a', divisionId: 'dail-34-2025-09-01-vote_1' });
    expect(await repo.addEvidence({ pledgeId: 99999, kind: 'other', summary: 'x', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie' })).toBeNull();

    const [listed] = await repo.listPledges('party x');
    expect(listed!.evidenceCount).toBe(2);
    const full = await repo.pledgeWithEvidence(created.id);
    expect(full!.evidence.map((e) => e.kind)).toEqual(['legislation_passed', 'bill_introduced']);
    expect(full!.evidence[0]!.divisionId).toBe('dail-34-2025-09-01-vote_1');

    await expect(repo.addEvidence({ pledgeId: created.id, kind: 'rumour', summary: 'x', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie' })).rejects.toThrow();
    await expect(
      repo.addEvidence({ pledgeId: created.id, kind: 'other', summary: 'x', occurredOn: '2025-01-01', sourceUrl: 'https://x.ie', divisionId: 'no-such-vote' }),
    ).rejects.toBeInstanceOf(repo.UnknownDivisionError);
    // The foreign key itself, past the repository's check.
    await expect(
      dbmod.pool.query(
        `insert into politics.pledge_evidence (pledge_id, kind, summary, occurred_on, source_url, division_id)
         values ($1, 'other', 'x', '2025-01-01', 'https://x.ie', 'no-such-vote')`,
        [created.id],
      ),
    ).rejects.toMatchObject({ code: '23503' });

    // Deleting the division keeps the evidence and drops only the link.
    await dbmod.pool.query(`delete from politics.divisions where id = 'dail-34-2025-09-01-vote_1'`);
    expect((await repo.pledgeWithEvidence(created.id))!.evidence[0]!.divisionId).toBeNull();

    expect(await repo.deletePledge(created.id)).toBe(true);
    const { rows } = await dbmod.pool.query('select count(*)::int as n from politics.pledge_evidence');
    expect(rows[0].n).toBe(0);
  });

  it('saving a ranking replaces the whole ranking atomically', async () => {
    await repo.saveRanking('u1', ['housing', 'health', 'climate']);
    expect(await repo.userRanking('u1')).toEqual(['housing', 'health', 'climate']);
    await repo.saveRanking('u1', ['climate', 'housing']);
    expect(await repo.userRanking('u1')).toEqual(['climate', 'housing']);
    await repo.saveRanking('u1', []);
    expect(await repo.userRanking('u1')).toBeNull();

    await repo.saveRanking('u2', ['health']);
    expect(await repo.communityPriorities()).toEqual({ weights: { health: 1 }, rankers: 1 });
  });

  // ---- The OLD community weights, as computed in Node before they moved to SQL. ----
  function oldWeightsFromRanking(ranking: readonly PledgeCategory[]): CategoryWeights {
    const n = ranking.length;
    if (n === 0) return {};
    const total = (n * (n + 1)) / 2;
    const weights: CategoryWeights = {};
    ranking.forEach((category, index) => {
      weights[category] = (n - index) / total;
    });
    return weights;
  }
  function oldRankingsByUser(rows: ReadonlyArray<{ userId: string; category: PledgeCategory; rank: number }>): Map<string, PledgeCategory[]> {
    const byUser = new Map<string, Array<{ category: PledgeCategory; rank: number }>>();
    for (const row of rows) {
      const list = byUser.get(row.userId) ?? [];
      list.push(row);
      byUser.set(row.userId, list);
    }
    return new Map(
      Array.from(byUser.entries()).map(([userId, list]): [string, PledgeCategory[]] => [
        userId,
        list.sort((a, b) => a.rank - b.rank).map((r) => r.category),
      ]),
    );
  }
  function oldCommunityWeights(rankings: ReadonlyArray<readonly PledgeCategory[]>): CategoryWeights {
    if (rankings.length === 0) return {};
    const sum: CategoryWeights = {};
    for (const ranking of rankings) {
      for (const [category, weight] of Object.entries(oldWeightsFromRanking(ranking)) as Array<[PledgeCategory, number]>) {
        sum[category] = (sum[category] ?? 0) + weight;
      }
    }
    for (const category of Object.keys(sum) as PledgeCategory[]) sum[category] = sum[category]! / rankings.length;
    return sum;
  }
  async function oldCommunity() {
    const { rows } = await dbmod.pool.query(`select user_id as "userId", category, rank from politics.pledge_category_priorities`);
    const rankings = oldRankingsByUser(rows);
    return { weights: oldCommunityWeights(Array.from(rankings.values())), rankers: rankings.size };
  }
  // ---- end of the old code ----

  /** Same categories, same rankers, each weight equal to 1e-12: SQL sums in a different order than Node. */
  async function expectSameAsOld() {
    const [before, after] = await Promise.all([oldCommunity(), repo.communityPriorities()]);
    expect(after.rankers).toBe(before.rankers);
    expect(Object.keys(after.weights).sort()).toEqual(Object.keys(before.weights).sort());
    for (const [category, weight] of Object.entries(before.weights)) {
      expect(Math.abs(after.weights[category as PledgeCategory]! - weight!), category).toBeLessThan(1e-12);
    }
    return after;
  }

  it('community weights: every user counts once, however long their ranking', async () => {
    expect(await repo.communityPriorities()).toEqual({ weights: {}, rankers: 0 });
    await repo.saveRanking('u1', ['housing']);
    await repo.saveRanking('u2', ['health', 'housing']);
    // u1: housing 1. u2: health 2/3, housing 1/3. Mean: housing 2/3, health 1/3.
    const w = (await expectSameAsOld()).weights;
    expect(w.housing).toBeCloseTo(2 / 3, 12);
    expect(w.health).toBeCloseTo(1 / 3, 12);
  });

  it('community weights in SQL equal the old Node arithmetic for many random rankings', async () => {
    let seed = 20261012;
    const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const users = Array.from({ length: 400 }, (_, i) => `rank-user-${i}`);
    await consentTo(dbmod.pool, ...users);
    const rows: Array<[string, string, number]> = [];
    for (const user of users) {
      // Any length from 1 to all 12, in any order: partial rankings are the common case.
      const shuffled = [...PLEDGE_CATEGORIES].sort(() => random() - 0.5);
      const ranking = shuffled.slice(0, 1 + Math.floor(random() * PLEDGE_CATEGORIES.length));
      // Some users' ranks have gaps (never written by saveRanking, but the column allows it): place, not rank value, decides.
      const step = random() < 0.2 ? 3 : 1;
      ranking.forEach((category, i) => rows.push([user, category, 1 + i * step]));
    }
    await dbmod.pool.query(
      `insert into politics.pledge_category_priorities (user_id, category, rank)
       select * from unnest($1::text[], $2::text[], $3::int[])`,
      [rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])],
    );

    const after = await expectSameAsOld();
    expect(after.rankers).toBe(400);
    expect(Object.keys(after.weights)).toHaveLength(PLEDGE_CATEGORIES.length);
    expect(Object.values(after.weights).reduce((a, b) => a + b!, 0)).toBeCloseTo(1, 12);
  });
});
