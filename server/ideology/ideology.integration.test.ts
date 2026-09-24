/**
 * The quiz and ideology domains against a real Postgres: the migration, every repository
 * query, and the service end to end. Unit tests cover the maths; this covers the SQL, the
 * constraints and the wiring, which nothing else executes.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_quiz`, so it cannot
 * race the scoring, voting or pledges integration tests.
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/ideology/ideology.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const quizUrl = testDatabaseUrl('quiz');
const run = describe.skipIf(!quizUrl);

if (quizUrl) process.env.DATABASE_URL = quizUrl;

// Votes belong to server/voting, whose own integration test covers listUserVoteVectors.
const votes = vi.hoisted(() => ({ byUser: new Map<string, unknown[]>() }));
vi.mock('../voting', () => ({
  listUserVoteVectors: vi.fn(async (userId: string) => votes.byUser.get(userId) ?? []),
}));

const zero = { economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0 };

run('quiz and ideology against Postgres', () => {
  let dbmod: typeof import('../db');
  let ideology: typeof import('./index');
  let quiz: typeof import('../quiz');
  let repo: typeof import('./repository');
  let adapter: typeof import('../services/tdIdeologyProfileService');
  let partyBaseline: typeof import('./partyBaselines').partyBaseline;

  async function addTd(name: string, party: string | null): Promise<number> {
    const { rows } = await dbmod.pool.query<{ id: number }>('insert into politics.tds (name, party) values ($1, $2) returning id', [name, party]);
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await ensureDatabase(quizUrl!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    ideology = await import('./index');
    quiz = await import('../quiz');
    repo = await import('./repository');
    adapter = await import('../services/tdIdeologyProfileService');
    partyBaseline = (await import('./partyBaselines')).partyBaseline;
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query(
      'truncate politics.quiz_results, politics.td_ideology_evidence, politics.ideology_profiles, politics.tds restart identity cascade',
    );
    votes.byUser.clear();
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  describe('the quiz', () => {
    const answers = [
      { questionId: 1, answerIndex: 2 }, // economic: the strongest market answer → +10
      { questionId: 20, answerIndex: 0 }, // welfare: the strongest expand-welfare answer → −10
    ];

    it('scores an anonymous quiz without saving anything', async () => {
      const result = await quiz.submitQuiz(null, answers);
      expect(result.id).toBeNull();
      expect(result.vector.economic).toBe(10);
      const { rows } = await dbmod.pool.query('select count(*)::int as n from politics.quiz_results');
      expect(rows[0].n).toBe(0);
    });

    it('saves a signed-in quiz, and the profile equals it when there are no votes', async () => {
      const saved = await quiz.submitQuiz('user-a', answers);
      expect(saved.id).toBeGreaterThan(0);
      expect(saved.createdAt).not.toBeNull();
      expect(await ideology.getIdeologyProfile('user-a')).toEqual({ ...zero, economic: 10, welfare: -10 });
    });

    it('keeps history newest first and uses only the latest quiz', async () => {
      await quiz.submitQuiz('user-a', answers);
      await quiz.submitQuiz('user-a', [{ questionId: 1, answerIndex: 0 }]); // economic −10
      const history = await quiz.quizHistory('user-a');
      expect(history.map((h) => h.vector.economic)).toEqual([-10, 10]);
      expect((await ideology.getIdeologyProfile('user-a'))!.economic).toBe(-10);
    });
  });

  describe('user profiles', () => {
    it('folds votes into the quiz position', async () => {
      // economic +10 from one of four economic questions: weight 10 × 1/4 = 2.5
      await quiz.submitQuiz('user-b', [{ questionId: 1, answerIndex: 2 }]);
      votes.byUser.set('user-b', [
        { questionId: 1, optionKey: 'option_a', vector: { ...zero, economic: -2, globalism: 1 }, weight: 1, confidence: null, votedAt: new Date() },
      ]);
      await ideology.recomputeProfile('user-b');
      const p = (await ideology.getIdeologyProfile('user-b'))!;
      expect(p.economic).toBeCloseTo((10 * 2.5 - 10 * 1) / 3.5, 1); // vote −2 → −10 on the profile scale
      expect(p.globalism).toBe(5); // only the vote speaks to globalism
    });

    it('removes the profile when there is neither a quiz nor a vote', async () => {
      await dbmod.pool.query(
        "insert into politics.ideology_profiles (subject_kind, subject_id, economic, social, cultural, authority, environmental, welfare, globalism, technocratic, total_weight, evidence_count) values ('user', 'ghost', 1,1,1,1,1,1,1,1, 1, 1)",
      );
      await ideology.recomputeProfile('ghost');
      expect(await ideology.getIdeologyProfile('ghost')).toBeNull();
    });

    it('builds a daily timeline', async () => {
      await quiz.submitQuiz('user-c', [{ questionId: 1, answerIndex: 2 }]);
      const points = await ideology.userTimeline('user-c');
      expect(points).toHaveLength(1);
      expect(points[0]!.vector.economic).toBe(10);
    });
  });

  describe('TD evidence', () => {
    it('starts a party TD at the party baseline and moves with evidence', async () => {
      const id = await addTd('Test Deputy', 'Fine Gael');
      const r = await ideology.recordTdEvidence({ td: 'test deputy', source: 'article', sourceRef: '1', raw: { economic: 0.5 }, weight: 3, observedAt: new Date() });
      expect(r).toBe('recorded');
      const { profile } = (await ideology.tdProfile(id))!;
      const baseline = partyBaseline('Fine Gael')!;
      // prior weight 3 at the baseline, evidence weight 3 at +10
      expect(profile!.vector.economic).toBeCloseTo((baseline.economic * 3 + 10 * 3) / 6, 1);
      expect(profile!.vector.social).toBeCloseTo(baseline.social, 1); // no evidence on social
      expect(profile!.evidenceCount).toBe(1);
      expect(await ideology.partyProfile('fine gael')).not.toBeNull();
    });

    it('is idempotent, skips no-signal evidence and unknown TDs', async () => {
      await addTd('Solo Deputy', 'Independent');
      const input = { td: 'Solo Deputy', source: 'debate' as const, sourceRef: 'dail-x/spk_1', raw: { welfare: -0.4 }, weight: 1, observedAt: new Date() };
      expect(await ideology.recordTdEvidence(input)).toBe('recorded');
      expect(await ideology.recordTdEvidence(input)).toBe('duplicate');
      expect(await ideology.recordTdEvidence({ ...input, sourceRef: 'b', raw: { welfare: 0.01 } })).toBe('no_signal');
      expect(await ideology.recordTdEvidence({ ...input, td: 'Nobody At All' })).toBe('unknown_td');
      const { rows } = await dbmod.pool.query('select welfare, economic from politics.td_ideology_evidence');
      expect(rows).toEqual([{ welfare: -8, economic: null }]); // NULL, not 0, where the evidence is silent
    });

    it('the scoring-panel adapter records one article stance, weighted once', async () => {
      const id = await addTd('Panel Deputy', null);
      await adapter.TDIdeologyProfileService.applyAdjustments(
        'Panel Deputy',
        { ...zero, globalism: 0.5 },
        { sourceType: 'article', sourceId: 42, weight: 0.6, confidence: 0.8, sourceReliability: 0.9, sourceDate: new Date() },
      );
      const { rows } = await dbmod.pool.query('select td_id, source_ref, weight, globalism, economic from politics.td_ideology_evidence');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ td_id: id, source_ref: '42', globalism: 10, economic: null });
      expect(rows[0].weight).toBeCloseTo(0.6, 5);
    });

    it('rejects a non-positive weight and an unknown source at the database', async () => {
      const id = await addTd('Check Deputy', null);
      const insert = (source: string, weight: number) =>
        dbmod.pool.query(
          'insert into politics.td_ideology_evidence (td_id, source, source_ref, weight, observed_at) values ($1, $2, $3, $4, now())',
          [id, source, `${source}-${weight}`, weight],
        );
      await expect(insert('article', 0)).rejects.toThrow();
      await expect(insert('tweet', 1)).rejects.toThrow();
    });
  });

  describe('rebuild and matching', () => {
    it('recalculateAll rebuilds every profile to the same values', async () => {
      const a = await addTd('Rebuild A', 'Sinn Féin');
      await addTd('Rebuild B', 'Fine Gael');
      await ideology.recordTdEvidence({ td: a, source: 'article', sourceRef: '7', raw: { economic: -0.5 }, weight: 2, observedAt: new Date() });
      await quiz.submitQuiz('user-r', [{ questionId: 1, answerIndex: 0 }]);
      await ideology.recalculateAll();
      const before = await repo.listProfiles('td');
      expect(before).toHaveLength(2);
      await dbmod.pool.query("update politics.ideology_profiles set economic = 9 where subject_kind in ('td', 'user')");
      const summary = await ideology.recalculateAll();
      expect(summary).toEqual({ quizzesRescored: 0, users: 1, tds: 2, parties: 2 });
      const after = await repo.listProfiles('td');
      const key = (p: { subjectId: string; economic: number }) => `${p.subjectId}:${p.economic}`;
      expect(after.map(key).sort()).toEqual(before.map(key).sort());
      expect((await ideology.getIdeologyProfile('user-r'))!.economic).toBe(-10);
    });

    it('re-scores a stored quiz from its answers when its stored score is stale', async () => {
      const saved = await quiz.submitQuiz('user-s', [{ questionId: 1, answerIndex: 2 }]);
      // As if it had been scored by an older formula.
      await dbmod.pool.query("update politics.quiz_results set economic = 2.5, ideology = 'Old label' where id = $1", [saved.id]);
      const summary = await ideology.recalculateAll();
      expect(summary.quizzesRescored).toBe(1);
      const [row] = await quiz.quizHistory('user-s');
      expect(row!.vector.economic).toBe(10);
      expect(row!.ideology).not.toBe('Old label');
      expect((await ideology.recalculateAll()).quizzesRescored).toBe(0); // idempotent
    });

    it('matches a position to TDs and parties, best first', async () => {
      await addTd('Left Deputy', 'Sinn Féin');
      await addTd('Right Deputy', 'Fine Gael');
      await addTd('Unknown Deputy', 'Independent');
      await addTd('New Party Deputy', '100% RDR');
      await ideology.recalculateAll();
      const left = { ...zero, economic: -6, welfare: -7 };
      const { tds, parties } = await ideology.matchesFor(left);
      // No baseline and no evidence = unknown, not centrist: left out rather than matched at 0.
      expect(tds.map((t) => t.name)).toEqual(['Left Deputy', 'Right Deputy']);
      expect(parties.map((p) => p.party)).not.toContain('100% RDR');
      expect(parties[0]!.party).toBe('Sinn Féin');
      expect(tds[0]!.alignment).toBeGreaterThan(tds[1]!.alignment);
    });

    it("matches a user only on the dimensions they have evidence on", async () => {
      await addTd('Market Deputy', 'Fine Gael');
      await addTd('Left Deputy', 'Sinn Féin');
      await ideology.recalculateAll();
      // One strongly market answer, nothing else: economic +10, every other dimension unknown.
      await quiz.submitQuiz('user-m', [{ questionId: 1, answerIndex: 2 }]);
      const result = (await ideology.userMatches('user-m'))!;
      expect(result.measured).toEqual(['economic']);
      expect(result.tds[0]!.name).toBe('Market Deputy');
      // On economic alone: 1 − |10 − FG economic| / 20.
      const fg = (await ideology.partyProfile('Fine Gael'))!.vector.economic;
      expect(result.tds[0]!.alignment).toBe(Math.round(100 * (1 - Math.abs(10 - fg) / 20)));
      expect(await ideology.userMatches('nobody')).toBeNull();
    });
  });
});
