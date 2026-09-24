/**
 * The pledge repository against a real Postgres: migration, constraints, uniqueness and
 * the ranking transaction. Skipped unless TEST_DATABASE_URL is set; uses its own
 * database `<db>_pledges` (see server/testing/migrations.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
    expect(await repo.allPriorityRows()).toEqual([{ userId: 'u2', category: 'health', rank: 1 }]);
  });
});
