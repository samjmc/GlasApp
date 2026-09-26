/**
 * Voting against a real Postgres: the migration, every repository query, and the daily
 * session end to end. Unit tests cover the decisions; this covers the SQL, the
 * constraints and the transaction shapes, which nothing else executes.
 *
 * Skipped unless TEST_DATABASE_URL is set. It uses its OWN database, `<db>_voting`
 * (created if missing), because the scoring integration test drops and recreates the
 * `politics` schema and the two would race when vitest runs files in parallel.
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/voting/voting.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const votingUrl = testDatabaseUrl('voting');
const run = describe.skipIf(!votingUrl);

if (votingUrl) {
  process.env.DATABASE_URL = votingUrl;
  process.env.SUPABASE_URL ??= 'http://localhost:54321';
  process.env.SUPABASE_ANON_KEY ??= 'anon';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service';
}

// The ideology domain is another session's module; here its two answers are scripted.
const ideologyState = vi.hoisted(() => ({
  profiles: [] as Array<Record<string, number> | null>,
  recomputed: [] as string[],
}));
vi.mock('./ideology', () => ({
  getIdeologyProfile: vi.fn(async () => (ideologyState.profiles.length ? ideologyState.profiles.shift()! : null)),
  recomputeProfile: vi.fn(async (userId: string) => {
    ideologyState.recomputed.push(userId);
  }),
}));

/** Noon UTC on a September day: the same calendar date in Dublin. */
const day = (n: number) => new Date(Date.UTC(2026, 8, n, 12));

run('voting against Postgres', () => {
  let repo: typeof import('./repository');
  let service: typeof import('./service');
  let index: typeof import('./index');
  let dbmod: typeof import('../db');
  let nextArticle = 1000;

  const vec = (overrides: Record<string, number> = {}) => ({
    economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0,
    ...overrides,
  });

  /** Save a 3-option question directly through the repository. */
  async function makeQuestion(primaryDimension: string | null = 'economic', articleId = nextArticle++) {
    const saved = await repo.saveQuestion({
      question: {
        articleId,
        question: `Question for article ${articleId}?`,
        policyDomain: 'economy',
        policyTopic: 'cost_of_living',
        primaryDimension,
        headline: `Headline ${articleId}`,
        summary: 'Summary.',
        articleUrl: `https://example.ie/${articleId}`,
      },
      options: [
        { optionKey: 'option_a', label: 'Market', position: 0, ...vec({ economic: 2 }), weight: 1 },
        { optionKey: 'option_b', label: 'State', position: 1, ...vec({ economic: -2, welfare: -1 }), weight: 2 },
        { optionKey: 'option_c', label: 'Mixed', position: 2, ...vec(), weight: 1 },
      ],
    });
    return { ...saved, articleId };
  }

  beforeAll(async () => {
    await ensureDatabase(votingUrl!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    repo = await import('./repository');
    service = await import('./service');
    index = await import('./index');
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query(
      'truncate politics.policy_votes, politics.daily_session_items, politics.daily_sessions, politics.policy_question_options, politics.policy_questions restart identity cascade',
    );
    ideologyState.profiles = [];
    ideologyState.recomputed = [];
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  describe('questions', () => {
    it('saves a question with its options once per article', async () => {
      const first = await makeQuestion('economic', 1);
      const second = await makeQuestion('social', 1);
      expect(first.created).toBe(true);
      expect(second).toEqual({ id: first.id, created: false, articleId: 1 });

      const found = await repo.questionById(first.id);
      expect(found!.question.primaryDimension).toBe('economic');
      expect(found!.options.map((o) => o.optionKey)).toEqual(['option_a', 'option_b', 'option_c']);
    });

    it('rejects an option position outside ±2 at the database', async () => {
      await expect(
        repo.saveQuestion({
          question: { articleId: 2, question: 'q', policyDomain: 'other', policyTopic: 't', headline: 'h' },
          options: [{ optionKey: 'option_a', label: 'x', position: 0, ...vec({ economic: 3 }), weight: 1 }],
        }),
      ).rejects.toThrow();
      // The transaction rolled back: no orphan question row.
      expect(await repo.hasQuestionForArticle(2)).toBe(false);
    });

    it('generateQuestionForArticle saves once and skips the model for an article that has a question', async () => {
      const complete = vi.fn(async (_system: string, user: string) =>
        user.includes('Return strict JSON with an entry for EVERY option key')
          ? { options: ['option_a', 'option_b', 'option_c'].map((key, i) => ({ key, ideology_delta: { economic: i - 1 }, weight: 1 })) }
          : {
              should_create: true,
              policy_domain: 'housing',
              policy_topic: 'rent',
              question: 'A rent crisis needs a response. Which approach feels right?',
              answer_options: ['Caps', 'Supply', 'Subsidies'],
              primary_dimension: 'welfare',
            },
      );
      const article = {
        id: 55, title: 'Rents rise', content: 'Rents rose 9%.', source: 'RTÉ',
        publishedAt: day(20), url: 'https://example.ie/55', imageUrl: null, summary: 'Rents rose.',
      };

      const id = await service.generateQuestionForArticle(article, {}, complete);
      expect(id).toBeTypeOf('number');
      expect(complete).toHaveBeenCalledTimes(2);

      expect(await service.generateQuestionForArticle(article, {}, complete)).toBeNull();
      expect(complete).toHaveBeenCalledTimes(2);

      const onCard = await index.getQuestionsForArticles([55, 999]);
      expect([...onCard.keys()]).toEqual([55]);
      expect(onCard.get(55)).toEqual({
        id,
        question: 'A rent crisis needs a response. Which approach feels right?',
        options: { option_a: 'Caps', option_b: 'Supply', option_c: 'Subsidies' },
        domain: 'housing',
        topic: 'rent',
      });
    });

    it('saves nothing when the position call fails', async () => {
      const complete = vi.fn(async (_s: string, user: string) =>
        user.includes('EVERY option key')
          ? null
          : { should_create: true, policy_domain: 'health', policy_topic: 'a_and_e', question: 'How should A&E waits be handled?', answer_options: ['A', 'B', 'C'] },
      );
      const article = { id: 56, title: 't', content: 'c', source: 's', publishedAt: null, url: null, imageUrl: null, summary: null };
      expect(await service.generateQuestionForArticle(article, {}, complete)).toBeNull();
      expect(await repo.hasQuestionForArticle(56)).toBe(false);
    });
  });

  describe('votes', () => {
    it('one answer per user per question: a second vote replaces the first', async () => {
      const q = await makeQuestion();
      await service.castVote({ userId: 'u1', questionId: q.id, optionKey: 'option_a', source: 'article' });
      await service.castVote({ userId: 'u1', questionId: q.id, optionKey: 'option_b', source: 'article' });
      await service.castVote({ userId: 'u2', questionId: q.id, optionKey: 'option_b', source: 'article' });

      const tally = (await repo.tallies([q.id])).get(q.id);
      expect(tally).toEqual({ total: 2, byOption: { option_b: 2 } });
      expect(await repo.userVote('u1', q.id)).toBe('option_b');
      expect(ideologyState.recomputed).toEqual(['u1', 'u1', 'u2']);
    });

    it('rejects an unknown option before the database, and the database rejects it too', async () => {
      const q = await makeQuestion();
      await expect(
        service.castVote({ userId: 'u1', questionId: q.id, optionKey: 'option_d', source: 'article' }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        repo.upsertVote({ userId: 'u1', questionId: q.id, optionKey: 'option_d', source: 'article', sessionItemId: null }),
      ).rejects.toThrow();
      await expect(service.castVote({ userId: 'u1', questionId: 99999, optionKey: 'option_a', source: 'article' })).rejects.toMatchObject({ status: 404 });
    });

    it('listUserVoteVectors returns each chosen position and weight', async () => {
      const q = await makeQuestion();
      await service.castVote({ userId: 'u1', questionId: q.id, optionKey: 'option_b', source: 'article' });
      const vectors = await index.listUserVoteVectors('u1');
      expect(vectors).toHaveLength(1);
      expect(vectors[0]).toMatchObject({ questionId: q.id, optionKey: 'option_b', weight: 2 });
      expect(vectors[0]!.vector).toEqual(vec({ economic: -2, welfare: -1 }));
      expect(await index.listUserVoteVectors('nobody')).toEqual([]);
    });

    it('the article view shows the question, tally and the caller’s own vote', async () => {
      const q = await makeQuestion('economic', 77);
      await service.castArticleVote('u1', q.id, 'option_c');
      const mine = await service.articleVoteView(77, 'u1');
      expect(mine.myVote).toBe('option_c');
      expect(mine.tally.total).toBe(1);
      expect((await service.articleVoteView(77, null)).myVote).toBeNull();
      expect((await service.articleVoteView(12345, 'u1')).question).toBeNull();
    });
  });

  describe('daily session', () => {
    const user = { id: 'u1', county: 'Cork', constituency: null };

    it('with no questions, returns an empty session and saves nothing', async () => {
      const state = await service.getOrCreateSession(user, day(22));
      expect(state).toMatchObject({ sessionId: 0, items: [], status: 'pending' });
      expect(await repo.findSession('u1', '2026-09-22')).toBeNull();
    });

    it('creates once per day with up to three unanswered questions', async () => {
      const answered = await makeQuestion('cultural');
      for (const axis of ['economic', 'social', 'welfare', 'globalism']) await makeQuestion(axis);
      await service.castVote({ userId: 'u1', questionId: answered.id, optionKey: 'option_a', source: 'article' });

      const first = await service.getOrCreateSession(user, day(22));
      expect(first.items).toHaveLength(3);
      expect(first.items.map((i) => i.questionId)).not.toContain(answered.id);
      expect(new Set(first.items.map((i) => i.policyDimension)).size).toBe(3);

      const again = await service.getOrCreateSession(user, day(22));
      expect(again.sessionId).toBe(first.sessionId);
      expect(again.items.map((i) => i.questionId)).toEqual(first.items.map((i) => i.questionId));
    });

    it('two concurrent first requests end up with one session', async () => {
      for (let i = 0; i < 3; i++) await makeQuestion();
      const [a, b] = await Promise.all([service.getOrCreateSession(user, day(22)), service.getOrCreateSession(user, day(22))]);
      expect(a.sessionId).toBe(b.sessionId);
      const { rows } = await dbmod.pool.query('select count(*)::int as n from politics.daily_sessions');
      expect(rows[0].n).toBe(1);
    });

    it('runs vote → complete, freezes the summary, and refuses late votes', async () => {
      for (let i = 0; i < 3; i++) await makeQuestion();
      // Profile before the session, then after the votes: welfare moved left by 0.5.
      const before = { ...vec(), welfare: 1 };
      ideologyState.profiles = [before, { ...before, welfare: 0.5 }];

      const session = await service.getOrCreateSession(user, day(22));
      await expect(service.completeSession('u1', day(22))).rejects.toMatchObject({ status: 400 });

      let state = session;
      for (const item of session.items) {
        state = await service.recordSessionVote('u1', item.sessionItemId, 'option_b', day(22));
      }
      expect(state.voteCount).toBe(3);
      expect(state.items.every((i) => i.selectedOption === 'option_b')).toBe(true);

      const completion = await service.completeSession('u1', day(22));
      expect(completion.streakCount).toBe(1);
      expect(completion.dimensionShifts).toHaveLength(1);
      expect(completion.dimensionShifts[0]).toMatchObject({ ideologyDimension: 'welfare', before: 1, after: 0.5, direction: 'left' });
      expect(completion.regionSummary).toMatch(/Cork/);

      // Completing again returns the frozen summary rather than recomputing it.
      expect(await service.completeSession('u1', day(22))).toEqual(completion);
      const reopened = await service.getOrCreateSession(user, day(22));
      expect(reopened.status).toBe('completed');
      expect(reopened.completion).toEqual(completion);

      await expect(service.recordSessionVote('u1', session.items[0]!.sessionItemId, 'option_a', day(22))).rejects.toMatchObject({ status: 409 });
    });

    it('a user cannot vote on another user’s session item, or on yesterday’s', async () => {
      for (let i = 0; i < 3; i++) await makeQuestion();
      const mine = await service.getOrCreateSession(user, day(21));
      const itemId = mine.items[0]!.sessionItemId;
      await expect(service.recordSessionVote('intruder', itemId, 'option_a', day(21))).rejects.toMatchObject({ status: 404 });
      await expect(service.recordSessionVote('u1', itemId, 'option_a', day(22))).rejects.toMatchObject({ status: 409 });
    });

    it('counts a streak across consecutive days', async () => {
      for (let i = 0; i < 9; i++) await makeQuestion(['economic', 'social', 'welfare'][i % 3]!);
      let completion;
      for (const d of [20, 21, 22]) {
        const session = await service.getOrCreateSession(user, day(d));
        for (const item of session.items) await service.recordSessionVote('u1', item.sessionItemId, 'option_a', day(d));
        completion = await service.completeSession('u1', day(d));
      }
      expect(completion!.streakCount).toBe(3);
    });

    it('the regional summary counts the other people in the area who finished today', async () => {
      for (let i = 0; i < 6; i++) await makeQuestion();
      for (const id of ['u2', 'u1']) {
        const session = await service.getOrCreateSession({ ...user, id }, day(22));
        for (const item of session.items) await service.recordSessionVote(id, item.sessionItemId, 'option_b', day(22));
        await service.completeSession(id, day(22));
      }
      const totals = await repo.regionTotals('2026-09-22', 'county', 'Cork');
      expect(totals.finished).toBe(2);
      // Both chose option_b (economic −2, welfare −1, weight 2) three times each.
      expect(totals.totals.economic).toBe(-24);
      expect(totals.totals.welfare).toBe(-12);
      expect(await repo.regionTotals('2026-09-22', 'county', 'Kerry')).toMatchObject({ finished: 0 });
    });

    it('a vote cast on the article page still counts in the lean and the area totals', async () => {
      for (let i = 0; i < 3; i++) await makeQuestion();
      const session = await service.getOrCreateSession(user, day(22));
      const [first, ...rest] = session.items;
      await repo.upsertVote({ userId: 'u1', questionId: first!.questionId, optionKey: 'option_b', source: 'article', sessionItemId: null });
      for (const item of rest) await service.recordSessionVote('u1', item.sessionItemId, 'option_b', day(22));
      await service.completeSession('u1', day(22));

      expect(await repo.sessionVoteVectors(session.sessionId, 'u1')).toHaveLength(3);
      // option_b three times: economic −2 × weight 2 each.
      expect((await repo.regionTotals('2026-09-22', 'county', 'Cork')).totals.economic).toBe(-12);
      // Another user's vote on the same question is not this session's.
      await repo.upsertVote({ userId: 'u2', questionId: first!.questionId, optionKey: 'option_b', source: 'article', sessionItemId: null });
      expect(await repo.sessionVoteVectors(session.sessionId, 'u1')).toHaveLength(3);
      expect((await repo.regionTotals('2026-09-22', 'county', 'Cork')).totals.economic).toBe(-12);
    });
  });
});
