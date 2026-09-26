import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ArticleOutcome, ArticleSource } from './articleSource';

const m = vi.hoisted(() => ({
  batchScoreAndRank: vi.fn(),
  extractTDMentions: vi.fn(),
  findByName: vi.fn(),
  generateQuestionForArticle: vi.fn(),
  linkArticleTd: vi.fn(),
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
vi.mock('../voting', () => ({ generateQuestionForArticle: m.generateQuestionForArticle }));
vi.mock('./repository', () => ({ linkArticleTd: m.linkArticleTd }));

const { runTdPipeline } = await import('./tdPipeline');

const article = (id: number): Article => ({
  id,
  title: `Story ${id}`,
  content: 'x'.repeat(600),
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

describe('runTdPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.findByName.mockImplementation(async (name: string) => (name === 'Mary Lou McDonald' ? { td: { id: 7, name } } : null));
  });

  it('links an important article to the TD it names and makes its question, scoring nobody', async () => {
    const { source, outcomes } = fakeSource([article(1)]);
    m.batchScoreAndRank.mockResolvedValue({ topArticles: [{ article: { id: 1 }, importance: importance(80) }], skippedArticles: [], stats: { scored: 1 } });
    m.extractTDMentions.mockResolvedValue([{ name: 'Mary Lou McDonald' }]);

    const stats = await runTdPipeline({ source });

    expect(m.linkArticleTd).toHaveBeenCalledWith(1, 7);
    expect(m.generateQuestionForArticle).toHaveBeenCalledTimes(1);
    expect(m.generateQuestionForArticle.mock.calls[0][0]).toMatchObject({ id: 1, title: 'Story 1' });
    expect(stats).toMatchObject({ articlesProcessed: 1, tdsLinked: 1, errors: 0 });
    expect(outcomes.get(1)).toEqual({ importanceScore: 80, importanceReasoning: 'r', skippedReason: undefined });
  });

  it('makes no question for an article that names no TD in the TD table', async () => {
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
    expect(m.generateQuestionForArticle).not.toHaveBeenCalled();
    expect(stats.tdsLinked).toBe(0);
    expect(outcomes.get(1)?.skippedReason).toBe('No TD mentioned');
    expect(outcomes.get(2)?.skippedReason).toBe('TDs mentioned only in passing');
    expect(outcomes.get(3)?.skippedReason).toBeUndefined();
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
