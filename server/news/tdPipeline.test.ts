import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ArticleOutcome, ArticleSource } from './articleSource';

const m = vi.hoisted(() => ({
  extractTDMentions: vi.fn(),
  findByName: vi.fn(),
  generateQuestionForArticle: vi.fn(),
  questionForArticle: vi.fn(),
  linkArticleTd: vi.fn(),
  saveStances: vi.fn(),
  /** The `stance` evidence each stance transaction wrote. */
  replaceEvidence: vi.fn(),
  recomputeTdProfile: vi.fn(),
  positionProbability: vi.fn(),
  /** Answers each model call by its operation name; an Error makes that call throw. */
  replies: {} as Record<string, unknown>,
  operations: [] as string[],
}));

vi.mock('../services/aiService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/aiService')>()),
  completeJson: vi.fn(async (_system: string, _user: string, _temperature: number, operation: string) => {
    m.operations.push(operation);
    const reply = m.replies[operation] ?? null;
    if (reply instanceof Error) throw reply;
    return reply;
  }),
}));
vi.mock('../services/tdExtractionService', () => ({
  TDExtractionService: {
    extractTDMentions: m.extractTDMentions,
    filterHighConfidenceMentions: (mentions: unknown[]) => mentions,
    isSubstantialMention: (_text: string, name: string) => !name.startsWith('Passing'),
  },
}));
vi.mock('../scoring', () => ({ repository: { findByName: m.findByName } }));
vi.mock('../voting', () => ({
  generateQuestionForArticle: m.generateQuestionForArticle,
  questionForArticle: m.questionForArticle,
  questionsWithPositions: async () => [QUESTION],
}));
vi.mock('./repository', () => ({ linkArticleTd: m.linkArticleTd }));
// extract → verify → map → evidence run for real; only the database is stubbed. A saved stance
// is read back as td_stances would give it to the evidence rebuild.
vi.mock('../stances/repository', () => {
  let saved: Array<{ tdId: number; questionId: number | null; optionKey: string | null; quoteKind: string }> = [];
  return {
    withStanceLock: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
    deleteArticleStancesExcept: async () => [],
    saveStances: async (id: number, rows: typeof saved) => {
      saved = rows;
      return m.saveStances(id, rows);
    },
    stanceRowsForEvidence: async () =>
      saved.filter((r) => r.optionKey).map((r, i) => ({ id: i + 1, tdId: r.tdId, questionId: r.questionId, optionKey: r.optionKey, quoteKind: r.quoteKind, discipline: null, statedAt: STATED_AT })),
    replaceStanceEvidenceOf: m.replaceEvidence,
    rebuildArticles: vi.fn(),
  };
});
vi.mock('../ideology/service', () => ({ recomputeTdProfile: m.recomputeTdProfile, recomputePartyProfile: vi.fn() }));
vi.mock('../stances/position', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../stances/position')>()),
  isJevConfigured: () => true,
  positionProbability: m.positionProbability,
}));

const { rankByRelevance, runTdPipeline } = await import('./tdPipeline');
const { AIError, OutOfCreditError } = await import('../services/aiService');

const STATED_AT = new Date('2026-09-25T10:00:00Z');
const QUOTE = 'We will build fifty thousand public homes every year until the housing crisis is over.';
const STATED = 'Mary Lou McDonald told the Dáil: "' + QUOTE + '" She was speaking on Tuesday. ';
/** What is stored: the quote widened to its whole sentence (server/stances/verify.ts). */
const SENTENCE = 'Mary Lou McDonald told the Dáil: "' + QUOTE + '"';
const MENTIONED = 'The Taoiseach met officials. Mary Lou McDonald was also in the chamber for the vote. ';

const article = (id: number, body = STATED, relevanceScore: number | null = 80): Article => ({
  id,
  title: `Story ${id}`,
  content: body.repeat(8),
  summary: null,
  source: 'RTÉ News',
  url: null,
  imageUrl: null,
  publishedDate: new Date('2026-09-25T10:00:00Z'),
  relevanceScore,
});

function fakeSource(articles: Article[]) {
  const outcomes = new Map<number, ArticleOutcome>();
  const released: number[] = [];
  const source: ArticleSource = {
    fetchUnprocessed: async () => articles,
    fetchById: async () => null,
    saveContent: async () => {},
    markProcessed: async (id, outcome) => void outcomes.set(id, outcome),
    release: async (id) => void released.push(id),
  };
  return { source, outcomes, released };
}

const zero = { economic: 0, social: 0, cultural: 0, authority: 0, environmental: 0, welfare: 0, globalism: 0, technocratic: 0 };
const QUESTION = {
  id: 55,
  articleId: 1,
  question: 'How should the State meet housing demand?',
  policyTopic: 'public_housing_targets',
  options: [
    { key: 'option_a', label: 'Build public homes', vector: { ...zero, economic: -2, welfare: -1 }, weight: 1.5, confidence: 0.8 },
    { key: 'option_b', label: 'Leave it to the market', vector: { ...zero, economic: 2 }, weight: 1, confidence: null },
    { key: 'option_c', label: 'Mix of both', vector: zero, weight: 1, confidence: 0.5 },
  ],
};

const stance = (quote: string, kind = 'direct') => ({ stances: [{ td_id: 7, policy_domain: 'housing', quote, quote_kind: kind }] });
const evidenceWritten = () => m.replaceEvidence.mock.calls.flatMap((call) => call[2]);
const outage = () => new AIError('503 Service Unavailable', { operation: 'tdStances', attempts: 3, elapsedMs: 1, status: 503 });
const noCredit = () => new OutOfCreditError('402 Insufficient Balance', { operation: 'tdStances', attempts: 1, elapsedMs: 1, status: 402 });

describe('rankByRelevance', () => {
  it('keeps the top share by stored relevance, an unranked row counted at the floor', () => {
    const claim = [article(1, STATED, 61), article(2, STATED, 95), article(3, STATED, null), article(4, STATED, 70)];
    const { top, skipped } = rankByRelevance(claim, 50);
    expect(top.map((a) => a.id)).toEqual([2, 4]);
    expect(skipped.map((a) => a.id)).toEqual([1, 3]);
  });
});

describe('runTdPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.replies = {};
    m.operations = [];
    m.findByName.mockImplementation(async (name: string) =>
      name === 'Mary Lou McDonald'
        ? { td: { id: 7, name, party: 'Sinn Féin', offices: [{ title: 'Leader of the Opposition', since: '2025-01-01' }] } }
        : null,
    );
    m.questionForArticle.mockResolvedValue(QUESTION);
    m.positionProbability.mockResolvedValue(0.9);
    m.saveStances.mockImplementation(async (_id: number, rows: Array<{ tdId: number }>) =>
      rows.map((row) => ({ tdId: row.tdId, statedAt: new Date('2026-09-25T10:00:00Z') })),
    );
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);
  });

  it('a verified stance gets the question, is saved with its answer, and becomes stance evidence', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.replies.stanceOptions = { matches: [{ index: 0, option_key: 'option_a' }] };

    const stats = await runTdPipeline({ source });

    expect(m.linkArticleTd).toHaveBeenCalledWith(1, 7);
    expect(m.positionProbability).toHaveBeenCalledWith({ td: expect.objectContaining({ id: 7 }), headline: 'Story 1', quote: SENTENCE });
    expect(m.generateQuestionForArticle).toHaveBeenCalledTimes(1);
    expect(m.generateQuestionForArticle.mock.calls[0][0]).toMatchObject({ id: 1, title: 'Story 1' });
    expect(m.saveStances).toHaveBeenCalledWith(1, [
      { tdId: 7, questionId: 55, optionKey: 'option_a', optionText: 'Build public homes', quote: SENTENCE, quoteKind: 'direct', policyDomain: 'housing' },
    ]);
    // In the same transaction: TD 7's stance evidence, rebuilt from its stances.
    expect(m.replaceEvidence).toHaveBeenCalledTimes(1);
    const [, tdIds, evidence] = m.replaceEvidence.mock.calls[0]!;
    expect(tdIds).toEqual([7]);
    expect(evidence).toEqual([
      expect.objectContaining({ tdId: 7, source: 'stance', sourceRef: 'question:55', economic: -10, welfare: -5, observedAt: STATED_AT, policyTopic: 'public_housing_targets' }),
    ]);
    expect(evidence[0].weight).toBeCloseTo(1.5 * 0.8 * 1, 9); // option weight × option confidence × direct
    expect(m.recomputeTdProfile).toHaveBeenCalledWith(7);
    expect(stats.stances).toEqual({
      extracted: 1,
      accepted: 1,
      mapped: 1,
      rejected: { invalid: 0, quote_not_found: 0, td_not_near: 0, duplicate: 0, not_position: 0, unchecked: 0 },
    });
    expect(outcomes.get(1)).toEqual({ importanceScore: 80, skippedReason: undefined });
  });

  it('Jev says it is not a policy position: the stance is held back, with no question, no save and no evidence', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.positionProbability.mockResolvedValue(0.3);

    const stats = await runTdPipeline({ source });

    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(m.operations).toEqual(['tdStances']); // no mapping call either
    expect(m.saveStances).toHaveBeenCalledWith(1, []); // the article keeps no stance (an earlier one is deleted)
    expect(evidenceWritten()).toEqual([]);
    expect(stats.stances).toMatchObject({ extracted: 1, accepted: 0, mapped: 0, rejected: { not_position: 1 } });
    expect(outcomes.get(1)?.errorMessage).toBeUndefined();
  });

  it('Jev configured but gives no answer (an outage): the article fails, to be read again, and nothing is saved', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.positionProbability.mockResolvedValue(null);

    const stats = await runTdPipeline({ source });

    expect(m.saveStances).not.toHaveBeenCalled();
    expect(stats).toMatchObject({ errors: 1, articlesProcessed: 0 });
    expect(outcomes.get(1)?.errorMessage).toMatch(/Jev gave no answer/);
  });

  it('a stance exactly at the threshold is kept', async () => {
    const { source } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.replies.stanceOptions = { matches: [{ index: 0, option_key: 'option_a' }] };
    m.positionProbability.mockResolvedValue(0.5);

    expect((await runTdPipeline({ source })).stances).toMatchObject({ accepted: 1, mapped: 1 });
  });

  it('a TD only mentioned, with a quote the article does not contain: no stance, no evidence, no question', async () => {
    const { source } = fakeSource([article(1, MENTIONED)]);
    m.replies.tdStances = stance('Mary Lou McDonald said she wants to abolish the property tax for every home in Ireland.');

    const stats = await runTdPipeline({ source });

    expect(m.linkArticleTd).toHaveBeenCalledWith(1, 7); // the mention is still a fact
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(m.saveStances).toHaveBeenCalledWith(1, []);
    expect(evidenceWritten()).toEqual([]);
    expect(m.operations).toEqual(['tdStances']); // no mapping call either
    expect(stats.stances).toMatchObject({ extracted: 1, accepted: 0, mapped: 0, rejected: { quote_not_found: 1 } });
  });

  it('a stance with no clear answer is saved without one and is not evidence', async () => {
    const { source } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE, 'paraphrase');
    m.replies.stanceOptions = { matches: [{ index: 0, option_key: null }] };

    const stats = await runTdPipeline({ source });

    expect(m.saveStances.mock.calls[0][1]).toEqual([
      expect.objectContaining({ questionId: null, optionKey: null, optionText: null, quoteKind: 'paraphrase' }),
    ]);
    expect(evidenceWritten()).toEqual([]);
    expect(stats.stances).toMatchObject({ accepted: 1, mapped: 0 });
  });

  it('when the model declines the question, the stance is still saved, unmatched', async () => {
    const { source } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.questionForArticle.mockResolvedValue(null);

    await runTdPipeline({ source });

    expect(m.operations).toEqual(['tdStances']);
    expect(m.saveStances.mock.calls[0][1]).toEqual([expect.objectContaining({ questionId: null, optionKey: null })]);
    expect(evidenceWritten()).toEqual([]);
  });

  it('makes no model call and no question for an article that names no TD in the TD table', async () => {
    const { source, outcomes } = fakeSource([article(1), article(2), article(3)]);
    m.extractTDMentions
      .mockResolvedValueOnce([]) // nobody
      .mockResolvedValueOnce([{ name: 'Passing Mention' }]) // only in passing
      .mockResolvedValueOnce([{ name: 'Not A Deputy' }]); // not in the TD table

    const stats = await runTdPipeline({ source, topPercentile: 100 });

    expect(m.linkArticleTd).not.toHaveBeenCalled();
    expect(m.operations).toEqual([]);
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(stats.tdsLinked).toBe(0);
    expect(outcomes.get(1)?.skippedReason).toBe('No TD mentioned');
    expect(outcomes.get(2)?.skippedReason).toBe('TDs mentioned only in passing');
    expect(outcomes.get(3)?.skippedReason).toBeUndefined();
  });

  it('a TD named twice is one candidate', async () => {
    const { source } = fakeSource([article(1)]);
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }, { name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = { stances: [] };

    await runTdPipeline({ source });

    expect(m.operations).toEqual(['tdStances']);
    expect(m.linkArticleTd).toHaveBeenCalledTimes(2); // idempotent in the repository
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
  });

  it('an article below the relevance cut is skipped before extraction, with its relevance stored', async () => {
    const { source, outcomes } = fakeSource([article(1, STATED, 90), article(2, STATED, 62)]);
    m.replies.tdStances = { stances: [] };

    await runTdPipeline({ source, topPercentile: 25 });

    expect(m.extractTDMentions).toHaveBeenCalledTimes(1);
    expect(outcomes.get(2)).toEqual({ importanceScore: 62, skippedReason: 'Not in the top 25% of its batch (relevance 62)' });
    expect(outcomes.get(1)).toEqual({ importanceScore: 90, skippedReason: undefined });
  });

  // ---- the model-outage paths (sweep P1, P28): nothing is marked done that was not done ----

  it('an extraction reply that is not usable fails the article, never marks it scored with no stances', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.replies.tdStances = { not: 'stances' };

    const stats = await runTdPipeline({ source });

    expect(stats).toMatchObject({ errors: 1, articlesProcessed: 0 });
    expect(outcomes.get(1)?.errorMessage).toMatch(/nothing usable/);
    expect(m.saveStances).not.toHaveBeenCalled();
  });

  it('a model that cannot be reached fails the article (claimed again later), and the run goes on to the next', async () => {
    const { source, outcomes } = fakeSource([article(1), article(2)]);
    m.replies.tdStances = outage();

    const stats = await runTdPipeline({ source, topPercentile: 100 });

    expect(stats).toMatchObject({ errors: 2, articlesProcessed: 0, stopped: null });
    expect(outcomes.get(1)?.errorMessage).toMatch(/503/);
    expect(outcomes.get(2)?.errorMessage).toMatch(/503/);
  });

  it('an outage while making the question fails the article rather than saving its stances unmatched', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.replies.tdStances = stance(QUOTE);
    m.generateQuestionForArticle.mockRejectedValueOnce(outage());

    await runTdPipeline({ source });

    expect(m.saveStances).not.toHaveBeenCalled();
    expect(outcomes.get(1)?.errorMessage).toMatch(/503/);
  });

  it('out of credit stops the run: that article and every later one are handed back untouched, not failed', async () => {
    const { source, outcomes, released } = fakeSource([article(1), article(2), article(3)]);
    m.replies.tdStances = noCredit();

    const stats = await runTdPipeline({ source, topPercentile: 100 });

    expect(m.operations).toEqual(['tdStances']); // one call, then no more
    expect(released).toEqual([1, 2, 3]);
    expect(outcomes.size).toBe(0);
    expect(stats).toMatchObject({ released: 3, errors: 0, articlesProcessed: 0 });
    expect(stats.stopped).toMatch(/no credit/);
  });
});
