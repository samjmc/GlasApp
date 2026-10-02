import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ArticleOutcome, ArticleSource } from './articleSource';

const m = vi.hoisted(() => ({
  batchScoreAndRank: vi.fn(),
  extractTDMentions: vi.fn(),
  findByName: vi.fn(),
  generateQuestionForArticle: vi.fn(),
  questionForArticle: vi.fn(),
  linkArticleTd: vi.fn(),
  saveStances: vi.fn(),
  recordTdEvidence: vi.fn(),
  /** Answers each model call by its operation name. */
  replies: {} as Record<string, unknown>,
  operations: [] as string[],
}));

vi.mock('../services/articleImportanceService', () => ({
  ArticleImportanceService: { batchScoreAndRank: m.batchScoreAndRank, scoreArticleImportance: vi.fn() },
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
  completeJson: vi.fn(async (_system: string, _user: string, _temperature: number, operation: string) => {
    m.operations.push(operation);
    return m.replies[operation] ?? null;
  }),
}));
vi.mock('./repository', () => ({ linkArticleTd: m.linkArticleTd }));
// extract → verify → map run for real; only the writes are stubbed.
vi.mock('../stances/repository', () => ({ saveStances: m.saveStances, rebuildArticles: vi.fn() }));
vi.mock('../ideology', () => ({ recordTdEvidence: m.recordTdEvidence }));

const { runTdPipeline } = await import('./tdPipeline');

const QUOTE = 'We will build fifty thousand public homes every year until the housing crisis is over.';
const STATED = 'Mary Lou McDonald told the Dáil: "' + QUOTE + '" She was speaking on Tuesday. ';
const MENTIONED = 'The Taoiseach met officials. Mary Lou McDonald was also in the chamber for the vote. ';

const article = (id: number, body = STATED): Article => ({
  id,
  title: `Story ${id}`,
  content: body.repeat(8),
  summary: null,
  source: 'RTÉ News',
  url: null,
  imageUrl: null,
  publishedDate: new Date('2026-09-25T10:00:00Z'),
});

function fakeSource(articles: Article[]) {
  const outcomes = new Map<number, ArticleOutcome>();
  const source: ArticleSource = {
    fetchUnprocessed: async () => articles,
    fetchById: async () => null,
    saveContent: async () => {},
    markProcessed: async (id, outcome) => void outcomes.set(id, outcome),
  };
  return { source, outcomes };
}

const importance = (score: number) => ({ score, reasoning: 'r', topicCategory: 'policy' });
const oneTop = (id: number) => ({ topArticles: [{ article: { id }, importance: importance(80) }], skippedArticles: [], stats: { scored: 1 } });

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
    m.saveStances.mockImplementation(async (_id: number, rows: Array<{ tdId: number }>) =>
      rows.map((row) => ({ tdId: row.tdId, statedAt: new Date('2026-09-25T10:00:00Z') })),
    );
  });

  it('a verified stance gets the question, is saved with its answer, and becomes stance evidence', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.batchScoreAndRank.mockResolvedValue(oneTop(1));
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = stance(QUOTE);
    m.replies.stanceOptions = { matches: [{ index: 0, option_key: 'option_a' }] };

    const stats = await runTdPipeline({ source });

    expect(m.linkArticleTd).toHaveBeenCalledWith(1, 7);
    expect(m.generateQuestionForArticle).toHaveBeenCalledTimes(1);
    expect(m.generateQuestionForArticle.mock.calls[0][0]).toMatchObject({ id: 1, title: 'Story 1' });
    expect(m.saveStances).toHaveBeenCalledWith(1, [
      { tdId: 7, questionId: 55, optionKey: 'option_a', optionText: 'Build public homes', quote: QUOTE, quoteKind: 'direct', policyDomain: 'housing' },
    ]);
    expect(m.recordTdEvidence).toHaveBeenCalledWith({
      td: 7,
      source: 'stance',
      sourceRef: 'question:55',
      raw: QUESTION.options[0]!.vector,
      weight: 1.5 * 0.8 * 1, // option weight × option confidence × direct
      observedAt: new Date('2026-09-25T10:00:00Z'),
      policyTopic: 'public_housing_targets',
    });
    expect(stats.stances).toEqual({
      extracted: 1,
      accepted: 1,
      mapped: 1,
      rejected: { invalid: 0, quote_not_found: 0, td_not_near: 0, duplicate: 0 },
    });
    expect(outcomes.get(1)).toEqual({ importanceScore: 80, importanceReasoning: 'r', skippedReason: undefined });
  });

  it('a TD only mentioned, with a quote the article does not contain: no stance, no evidence, no question', async () => {
    const { source } = fakeSource([article(1, MENTIONED)]);
    m.batchScoreAndRank.mockResolvedValue(oneTop(1));
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = stance('Mary Lou McDonald said she wants to abolish the property tax for every home in Ireland.');

    const stats = await runTdPipeline({ source });

    expect(m.linkArticleTd).toHaveBeenCalledWith(1, 7); // the mention is still a fact
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(m.saveStances).not.toHaveBeenCalled();
    expect(m.recordTdEvidence).not.toHaveBeenCalled();
    expect(m.operations).toEqual(['tdStances']); // no mapping call either
    expect(stats.stances).toMatchObject({ extracted: 1, accepted: 0, mapped: 0, rejected: { quote_not_found: 1 } });
  });

  it('a stance with no clear answer is saved without one and is not evidence', async () => {
    const { source } = fakeSource([article(1)]);
    m.batchScoreAndRank.mockResolvedValue(oneTop(1));
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = stance(QUOTE, 'paraphrase');
    m.replies.stanceOptions = { matches: [{ index: 0, option_key: null }] };

    const stats = await runTdPipeline({ source });

    expect(m.saveStances.mock.calls[0][1]).toEqual([
      expect.objectContaining({ questionId: null, optionKey: null, optionText: null, quoteKind: 'paraphrase' }),
    ]);
    expect(m.recordTdEvidence).not.toHaveBeenCalled();
    expect(stats.stances).toMatchObject({ accepted: 1, mapped: 0 });
  });

  it('when the model declines the question, the stance is still saved, unmatched', async () => {
    const { source } = fakeSource([article(1)]);
    m.batchScoreAndRank.mockResolvedValue(oneTop(1));
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = stance(QUOTE);
    m.questionForArticle.mockResolvedValue(null);

    await runTdPipeline({ source });

    expect(m.operations).toEqual(['tdStances']);
    expect(m.saveStances.mock.calls[0][1]).toEqual([expect.objectContaining({ questionId: null, optionKey: null })]);
    expect(m.recordTdEvidence).not.toHaveBeenCalled();
  });

  it('makes no model call and no question for an article that names no TD in the TD table', async () => {
    const { source, outcomes } = fakeSource([article(1), article(2), article(3)]);
    m.batchScoreAndRank.mockResolvedValue({
      topArticles: [1, 2, 3].map((id) => ({ article: { id }, importance: importance(70) })),
      skippedArticles: [],
      stats: { scored: 3 },
    });
    m.extractTDMentions
      .mockResolvedValueOnce([]) // nobody
      .mockResolvedValueOnce([{ name: 'Passing Mention' }]) // only in passing
      .mockResolvedValueOnce([{ name: 'Not A Deputy' }]); // not in the TD table

    const stats = await runTdPipeline({ source });

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
    m.batchScoreAndRank.mockResolvedValue(oneTop(1));
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }, { name: 'Mary Lou McDonald' }]);
    m.replies.tdStances = { stances: [] };

    await runTdPipeline({ source });

    expect(m.operations).toEqual(['tdStances']);
    expect(m.linkArticleTd).toHaveBeenCalledTimes(2); // idempotent in the repository
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
  });

  it('an article below the importance cut is skipped before extraction', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.batchScoreAndRank.mockResolvedValue({ topArticles: [], skippedArticles: [{ article: { id: 1 }, importance: importance(10) }], stats: { scored: 1 } });

    await runTdPipeline({ source, topPercentile: 25 });

    expect(m.extractTDMentions).not.toHaveBeenCalled();
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(outcomes.get(1)?.skippedReason).toBe('Below 25th percentile (score: 10)');
  });
});
