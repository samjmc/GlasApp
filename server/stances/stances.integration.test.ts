/**
 * TD stances against a real Postgres: the pipeline end to end with only the model calls mocked
 * (at `callChatCompletion`, the one seam every model call goes through), the td_stances table
 * and its constraints, the rebuild's selection SQL, and the `issues` a signed-in user sees.
 *
 * Skipped unless TEST_DATABASE_URL is set. Uses its OWN database, `<db>_stances`.
 *
 *   docker run -d --name glas-test-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:16
 *   $env:TEST_DATABASE_URL="postgres://postgres:postgres@localhost:55432/postgres"
 *   npx vitest run server/stances/stances.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAllMigrations, ensureDatabase, testDatabaseUrl } from '../testing/migrations';

const url = testDatabaseUrl('stances');
const run = describe.skipIf(!url);

if (url) {
  process.env.DATABASE_URL = url;
  process.env.LOG_LEVEL = 'silent';
}

const ai = vi.hoisted(() => ({ replies: {} as Record<string, unknown>, operations: [] as string[] }));

vi.mock('../services/aiService', () => ({
  isLLMConfigured: () => true,
  callChatCompletion: vi.fn(async (_params: unknown, options: { operation: string }) => {
    ai.operations.push(options.operation);
    const reply = ai.replies[options.operation];
    if (reply === undefined) throw new Error(`unexpected LLM operation ${options.operation}`);
    return { choices: [{ message: { content: JSON.stringify(reply) } }] };
  }),
}));
vi.mock('../services/articleImportanceService', () => ({
  ArticleImportanceService: {
    batchScoreAndRank: vi.fn(async (articles: Array<{ id: number }>) => ({
      topArticles: articles.map((article) => ({ article, importance: { score: 80, reasoning: 'r', topicCategory: 'policy' } })),
      skippedArticles: [],
      stats: { scored: articles.length },
    })),
  },
}));
vi.mock('../services/tdExtractionService', () => ({
  TDExtractionService: {
    extractTDMentions: vi.fn(async () => [{ name: 'Mary Lou McDonald' }]),
    filterHighConfidenceMentions: (mentions: unknown[]) => mentions,
    isSubstantialMention: () => true,
  },
}));

const QUOTE = 'We will build fifty thousand public homes every year until the housing crisis is over.';
const STATED = `Mary Lou McDonald told the Dáil: "${QUOTE}" She was speaking on Tuesday. `.repeat(6);
const MENTIONED = 'The Taoiseach met officials. Mary Lou McDonald was also in the chamber for the vote. '.repeat(6);
const OPTIONS = ['Build public homes', 'Leave it to the market', 'Mix of both'];

/** The replies a well-behaved model gives for an article in which the TD states QUOTE. */
function modelStates(quote = QUOTE, optionKey: string | null = 'option_a') {
  ai.replies = {
    tdStances: { stances: [{ td_id: tdId, policy_domain: 'housing', quote, quote_kind: 'direct' }] },
    policyQuestion: {
      should_create: true,
      policy_domain: 'housing',
      policy_topic: 'public_housing_targets',
      question: 'How should the State meet housing demand?',
      answer_options: OPTIONS,
      primary_dimension: 'economic',
    },
    optionPositions: {
      options: [
        { key: 'option_a', ideology_delta: { economic: -2, welfare: -1 }, weight: 1.5, confidence: 0.8 },
        { key: 'option_b', ideology_delta: { economic: 2 } },
        { key: 'option_c', ideology_delta: {} },
      ],
    },
    stanceOptions: { matches: [{ index: 0, option_key: optionKey }] },
  };
}

let tdId = 0;

run('TD stances against Postgres', () => {
  let dbmod: typeof import('../db');
  let pipeline: typeof import('../news/tdPipeline');
  let stancesRepo: typeof import('./repository');
  let ideology: typeof import('../ideology');
  let voting: typeof import('../voting/service');
  let agreement: typeof import('./agreement');
  let sourceId = 0;

  const count = async (table: string) =>
    Number((await dbmod.pool.query<{ n: number }>(`select count(*)::int as n from politics.${table}`)).rows[0]!.n);

  async function addArticle(input: { title: string; content: string; publishedAt?: Date; duplicateOf?: number; url?: string }): Promise<number> {
    const { rows } = await dbmod.pool.query<{ id: number }>(
      `insert into politics.news_articles (source_id, url, title, content, published_at, status, duplicate_of)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [
        sourceId,
        input.url ?? `https://example.ie/${Math.random().toString(36).slice(2)}`,
        input.title,
        input.content,
        input.publishedAt ?? new Date(Date.now() - 3_600_000),
        input.duplicateOf ? 'duplicate' : 'pending',
        input.duplicateOf ?? null,
      ],
    );
    return rows[0]!.id;
  }

  beforeAll(async () => {
    await ensureDatabase(url!);
    dbmod = await import('../db');
    await applyAllMigrations(dbmod.pool);
    pipeline = await import('../news/tdPipeline');
    stancesRepo = await import('./repository');
    ideology = await import('../ideology');
    voting = await import('../voting/service');
    agreement = await import('./agreement');
  }, 60_000);

  beforeEach(async () => {
    await dbmod.pool.query(
      `truncate politics.td_stances, politics.td_ideology_evidence, politics.ideology_profiles, politics.policy_votes,
                politics.policy_questions, politics.article_tds, politics.news_articles, politics.news_sources,
                politics.quiz_results, politics.tds restart identity cascade`,
    );
    ai.replies = {};
    ai.operations = [];
    sourceId = (await dbmod.pool.query<{ id: number }>("insert into politics.news_sources (slug, name, homepage_url) values ('rte', 'RTÉ News', 'https://www.rte.ie') returning id")).rows[0]!.id;
    tdId = (
      await dbmod.pool.query<{ id: number }>(
        `insert into politics.tds (name, party, offices) values ('Mary Lou McDonald', 'Sinn Féin', '[{"title": "Leader of the Opposition"}]') returning id`,
      )
    ).rows[0]!.id;
  });

  afterAll(async () => {
    if (dbmod) await dbmod.shutdown();
  });

  it('a TD only mentioned, and a quote the article does not contain: no stance, no evidence, no question', async () => {
    await addArticle({ title: 'Budget day in the Dáil', content: MENTIONED });
    modelStates('Mary Lou McDonald said she wants to abolish the property tax for every single home in Ireland.');

    const stats = await pipeline.runTdPipeline();

    expect(stats.stances).toMatchObject({ extracted: 1, accepted: 0, rejected: { quote_not_found: 1 } });
    expect(await count('article_tds')).toBe(1); // the mention itself is still recorded
    expect(await count('td_stances')).toBe(0);
    expect(await count('td_ideology_evidence')).toBe(0);
    expect(await count('policy_questions')).toBe(0);
    expect(ai.operations).toEqual(['tdStances']);
  });

  it('a verified stance: question made, stance saved with copies of the article, stance evidence recorded', async () => {
    const publishedAt = new Date(Date.now() - 2 * 3_600_000);
    const articleId = await addArticle({ title: 'Housing plan unveiled', content: STATED, publishedAt, url: 'https://www.rte.ie/news/housing' });
    modelStates();

    const stats = await pipeline.runTdPipeline();

    expect(stats.stances).toMatchObject({ extracted: 1, accepted: 1, mapped: 1 });
    expect(ai.operations).toEqual(['tdStances', 'policyQuestion', 'optionPositions', 'stanceOptions']);
    const { rows: questions } = await dbmod.pool.query<{ id: number }>('select id from politics.policy_questions where article_id = $1', [articleId]);
    expect(questions).toHaveLength(1);
    const questionId = questions[0]!.id;

    const { rows: stances } = await dbmod.pool.query('select * from politics.td_stances');
    expect(stances).toEqual([
      expect.objectContaining({
        td_id: tdId,
        article_id: articleId,
        question_id: questionId,
        option_key: 'option_a',
        option_text: 'Build public homes',
        quote: QUOTE,
        quote_kind: 'direct',
        policy_domain: 'housing',
        stated_at: publishedAt,
        article_url: 'https://www.rte.ie/news/housing',
        source_name: 'RTÉ News',
        headline: 'Housing plan unveiled',
      }),
    ]);

    const { rows: evidence } = await dbmod.pool.query('select source, source_ref, economic, welfare, social, weight, observed_at from politics.td_ideology_evidence');
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ source: 'stance', source_ref: `question:${questionId}`, economic: -10, welfare: -5, social: null, observed_at: publishedAt });
    expect(evidence[0].weight).toBeCloseTo(1.5 * 0.8 * 1, 5); // option weight × confidence × direct
    expect((await ideology.tdProfile(tdId))!.profile!.evidenceCount).toBe(1);
  });

  it('ten outlets, one event: only the canonical is processed, so there is one stance', async () => {
    const canonical = await addArticle({ title: 'Housing plan unveiled', content: STATED });
    const duplicates: number[] = [];
    for (let i = 0; i < 9; i++) duplicates.push(await addArticle({ title: `Housing plan, outlet ${i}`, content: STATED, duplicateOf: canonical }));
    modelStates();

    const stats = await pipeline.runTdPipeline();

    expect(stats.totalArticles).toBe(1);
    expect(ai.operations.filter((op) => op === 'tdStances')).toHaveLength(1);
    const { rows } = await dbmod.pool.query('select article_id from politics.td_stances');
    expect(rows).toEqual([{ article_id: canonical }]);
    expect(await count('td_ideology_evidence')).toBe(1);
    // And the table itself refuses a duplicate as a stance's article.
    const saved = await stancesRepo.saveStances(duplicates[0]!, [
      { tdId, questionId: null, optionKey: null, optionText: null, quote: QUOTE, quoteKind: 'direct', policyDomain: 'housing' },
    ]);
    expect(saved).toEqual([]);
    expect(await count('td_stances')).toBe(1);
  });

  it('constraints: kind, domain and answer are checked, an unknown option is refused, a deleted question clears the answer', async () => {
    const articleId = await addArticle({ title: 'Housing plan unveiled', content: STATED });
    modelStates();
    await pipeline.runTdPipeline();
    const insert = (kind: string, domain: string, optionKey: string | null) =>
      dbmod.pool.query(
        `insert into politics.td_stances (td_id, article_id, question_id, option_key, quote, quote_kind, policy_domain, stated_at, article_url, source_name, headline)
         select $1, $2, q.id, $3, 'q', $4, $5, now(), 'u', 's', 'h' from politics.policy_questions q where q.article_id = $2`,
        [tdId, articleId, optionKey, kind, domain],
      );
    await dbmod.pool.query('delete from politics.td_stances');
    await expect(insert('rumour', 'housing', 'option_a')).rejects.toThrow(/td_stances_quote_kind_chk/);
    await expect(insert('direct', 'sport', 'option_a')).rejects.toThrow(/td_stances_policy_domain_chk/);
    await expect(insert('direct', 'housing', 'option_z')).rejects.toThrow(/td_stances_option_fk/);
    // A question with no answer is not a state the table can hold: both, or neither.
    await expect(insert('direct', 'housing', null)).rejects.toThrow(/td_stances_answer_chk/);
    await insert('paraphrase', 'housing', 'option_b');

    await dbmod.pool.query('delete from politics.policy_questions');
    const { rows } = await dbmod.pool.query('select question_id, option_key, quote from politics.td_stances');
    expect(rows).toEqual([{ question_id: null, option_key: null, quote: 'q' }]);
  });

  it('a signed-in user who answered the same question sees it as a shared issue, blended into the %', async () => {
    await addArticle({ title: 'Housing plan unveiled', content: STATED });
    modelStates();
    await pipeline.runTdPipeline();
    const { rows } = await dbmod.pool.query<{ id: number; stated_at: Date }>('select q.id, s.stated_at from politics.policy_questions q join politics.td_stances s on s.question_id = q.id');
    const { id: questionId, stated_at: statedAt } = rows[0]!;
    await voting.castVote({ userId: 'agrees', questionId, optionKey: 'option_a', source: 'article' });
    await voting.castVote({ userId: 'differs', questionId, optionKey: 'option_b', source: 'article' });
    const now = new Date();

    const agrees = (await ideology.userMatches('agrees', {}, { tdId, now }))!.tds.find((t) => t.tdId === tdId)!;
    const differs = (await ideology.userMatches('differs', {}, { tdId, now }))!.tds.find((t) => t.tdId === tdId)!;
    expect(agrees.issues).toEqual({
      agree: 1,
      disagree: 0,
      items: [
        {
          questionId,
          question: 'How should the State meet housing demand?',
          domain: 'housing',
          yours: 'Build public homes',
          theirs: 'Build public homes',
          agrees: true,
          quote: QUOTE,
          quoteKind: 'direct',
          outlet: 'RTÉ News',
          url: expect.any(String),
          statedAt: statedAt.toISOString(),
        },
      ],
    });
    expect(differs.issues).toMatchObject({ agree: 0, disagree: 1, items: [{ yours: 'Leave it to the market', agrees: false }] });

    // Without the stance, the number is exactly the axis alignment...
    await dbmod.pool.query('delete from politics.td_stances');
    const axisAgrees = (await ideology.userMatches('agrees', {}, { tdId, now }))!.tds.find((t) => t.tdId === tdId)!;
    const axisDiffers = (await ideology.userMatches('differs', {}, { tdId, now }))!.tds.find((t) => t.tdId === tdId)!;
    expect(axisAgrees.issues).toEqual({ agree: 0, disagree: 0, items: [] });
    // ...and with it, the formula: (w·100·agree + PRIOR·axis) / (w + PRIOR).
    const w = agreement.stanceWeight('direct', statedAt, now);
    const blend = (agree: number, axis: number) => Math.round((w * 100 * agree + agreement.AXIS_PRIOR_WEIGHT * axis) / (w + agreement.AXIS_PRIOR_WEIGHT));
    expect(agrees.alignment).toBe(blend(1, axisAgrees.alignment));
    expect(differs.alignment).toBe(blend(0, axisDiffers.alignment));
    expect(agrees.alignment).toBeGreaterThan(axisAgrees.alignment);
    expect(differs.alignment).toBeLessThan(axisDiffers.alignment);
  });

  it('the rebuild reads canonical articles in the window that already have a question and a linked TD', async () => {
    const day = 86_400_000;
    const ago = (days: number) => new Date(Date.now() - days * day);
    const wanted = await addArticle({ title: 'Wanted', content: STATED, publishedAt: ago(10) });
    const noQuestion = await addArticle({ title: 'No question', content: STATED, publishedAt: ago(10) });
    const tooOld = await addArticle({ title: 'Too old', content: STATED, publishedAt: ago(200) });
    const duplicate = await addArticle({ title: 'Duplicate', content: STATED, publishedAt: ago(10), duplicateOf: wanted });
    const noTd = await addArticle({ title: 'No TD', content: STATED, publishedAt: ago(10) });
    for (const id of [wanted, tooOld, duplicate, noTd]) {
      await dbmod.pool.query(
        "insert into politics.policy_questions (article_id, question, policy_domain, policy_topic, headline) values ($1, 'Q?', 'housing', 'public_housing_targets', 'h')",
        [id],
      );
    }
    for (const id of [wanted, noQuestion, tooOld, duplicate]) {
      await dbmod.pool.query('insert into politics.article_tds (article_id, td_id) values ($1, $2)', [id, tdId]);
    }

    const found = await stancesRepo.rebuildArticles(ago(180));

    expect(found.map((a) => a.id)).toEqual([wanted]);
    expect(found[0]).toEqual({
      id: wanted,
      title: 'Wanted',
      content: STATED,
      tds: [{ id: tdId, name: 'Mary Lou McDonald', party: 'Sinn Féin', offices: [{ title: 'Leader of the Opposition' }] }],
    });
    expect(await stancesRepo.rebuildArticles(ago(365))).toHaveLength(2); // the window is real
  });
});
