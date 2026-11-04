/**
 * News → TD pipeline. It links articles to the TDs they name and makes daily-vote questions.
 * It does NOT score anyone: a TD's score is built only from Oireachtas facts (docs/scoring.md).
 *
 * 1. Claim unprocessed articles (and failed ones with attempts left). Same-event duplicates were
 *    linked at ingest and are never claimed, so every article here is the one canonical report
 *    of its event.
 * 2. Keep the top slice by the relevance score ingest stored (server/news/relevance.ts).
 * 3. Find the TDs each article is substantially about and record each link in `article_tds`.
 * 4. Record what those TDs said (server/stances): a quote checked against the article and by Jev
 *    as a policy position, never a score. Only an article with at least one accepted stance gets
 *    a daily-vote question, and each stance is matched to one of its answers.
 *
 * Fails closed: when a model cannot be reached the article is marked `failed`, and a later run
 * claims it again (at most MAX_ATTEMPTS claims). When the provider is out of credit the run
 * stops and hands its remaining articles back untouched.
 */
import { AIError, completeJson, OutOfCreditError } from '../services/aiService';
import { TDExtractionService } from '../services/tdExtractionService';
import { emptyStanceStats, isJevConfigured, positionProbability, recordStances, toCandidate, type StanceStats } from '../stances';
import type { CandidateTd } from '../stances/extract';
import { generateQuestionForArticle, questionForArticle, type QuestionPositions } from '../voting';
import { type Article, type ArticleSource, articleSource } from './articleSource';
import { RELEVANCE_FLOOR } from './relevance';
import { linkArticleTd } from './repository';

export interface PipelineStats {
  totalArticles: number;
  selectedForScoring: number;
  skippedLowImportance: number;
  articlesProcessed: number;
  /** Article ↔ TD links recorded. */
  tdsLinked: number;
  stances: StanceStats;
  errors: number;
  articlesFailed: string[];
  /** Articles handed back unprocessed after the provider ran out of credit. */
  released: number;
  /** Why the run stopped early, if it did. */
  stopped: string | null;
}

export interface PipelineOptions {
  batchSize?: number;
  /** Keep the top N percent by relevance. */
  topPercentile?: number;
  source?: ArticleSource;
}

const MIN_CONTENT_CHARS = 500;

function emptyStats(): PipelineStats {
  return {
    totalArticles: 0,
    selectedForScoring: 0,
    skippedLowImportance: 0,
    articlesProcessed: 0,
    tdsLinked: 0,
    stances: emptyStanceStats(),
    errors: 0,
    articlesFailed: [],
    released: 0,
    stopped: null,
  };
}

/** The stored relevance; a row ingest could not rank (an admin's manual add) counts as just visible. */
const relevanceOf = (article: Article) => article.relevanceScore ?? RELEVANCE_FLOOR;

/** The top `topPercentile` percent of a claim by stored relevance, newest first on a tie. Pure. */
export function rankByRelevance(articles: Article[], topPercentile: number): { top: Article[]; skipped: Article[] } {
  const ranked = [...articles].sort((a, b) => relevanceOf(b) - relevanceOf(a) || (b.publishedDate?.getTime() ?? 0) - (a.publishedDate?.getTime() ?? 0));
  const topCount = Math.ceil(articles.length * (topPercentile / 100));
  return { top: ranked.slice(0, topCount), skipped: ranked.slice(topCount) };
}

export async function runTdPipeline(options: PipelineOptions = {}): Promise<PipelineStats> {
  const source = options.source ?? articleSource;
  const batchSize = options.batchSize ?? 50;
  const topPercentile = options.topPercentile ?? 25;
  const stats = emptyStats();
  if (!isJevConfigured()) console.warn('[stances] JEV_API_KEY or CLOUDFLARE_ACCOUNT_ID is not set: every stance is held back as unchecked');

  const articles = await source.fetchUnprocessed(batchSize);
  stats.totalArticles = articles.length;
  if (articles.length === 0) return stats;

  const { top, skipped } = rankByRelevance(articles, topPercentile);
  stats.selectedForScoring = top.length;
  stats.skippedLowImportance = skipped.length;
  for (const article of skipped) {
    await source.markProcessed(article.id, {
      importanceScore: relevanceOf(article),
      skippedReason: `Not in the top ${topPercentile}% of its batch (relevance ${relevanceOf(article)})`,
    });
  }

  for (const article of top) {
    if (stats.stopped) {
      await source.release(article.id);
      stats.released++;
      continue;
    }
    try {
      await ensureFullContent(article, source);
      await processArticle(article, source, stats);
      stats.articlesProcessed++;
    } catch (error) {
      if (error instanceof OutOfCreditError) {
        stats.stopped = `the model provider has no credit left (${error.message})`;
        await source.release(article.id);
        stats.released++;
        continue;
      }
      stats.errors++;
      stats.articlesFailed.push(article.title);
      await source.markProcessed(article.id, { importanceScore: relevanceOf(article), errorMessage: String(error) });
    }
  }
  return stats;
}

/** Process one article by id, bypassing the relevance cut. A duplicate's id processes its canonical. For manual runs. */
export async function processArticleById(articleId: number, source: ArticleSource = articleSource): Promise<PipelineStats> {
  const article = await source.fetchById(articleId);
  if (!article) throw new Error(`Article not found: ${articleId}`);
  if (article.id !== articleId) console.log(`Article ${articleId} is a duplicate; processing its canonical, article ${article.id}.`);
  const stats = emptyStats();
  stats.totalArticles = 1;
  await ensureFullContent(article, source);
  await processArticle(article, source, stats);
  stats.articlesProcessed = 1;
  return stats;
}

async function ensureFullContent(article: Article, source: ArticleSource): Promise<void> {
  if (article.content.length >= MIN_CONTENT_CHARS || !article.url) return;
  try {
    const { scrapeArticleContent } = await import('./content');
    const full = await scrapeArticleContent(article.url);
    if (full && full.length > 200) {
      article.content = full;
      await source.saveContent(article.id, full);
    }
  } catch (error) {
    console.warn(`Could not fetch full content for article ${article.id}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * The article's question, made first if it has none. Null when the model declines or answers
 * with nothing usable; throws when the model cannot be reached, so the article is retried.
 */
async function ensureQuestion(article: Article): Promise<QuestionPositions | null> {
  try {
    // Returns null, without a model call, when the article already has a question.
    await generateQuestionForArticle(
      {
        id: article.id,
        title: article.title,
        content: article.content,
        source: article.source ?? 'Unknown',
        publishedAt: article.publishedDate,
        url: article.url,
        imageUrl: article.imageUrl,
        summary: article.summary,
      },
      {},
      completeJson,
    );
  } catch (error) {
    if (error instanceof AIError) throw error;
    console.warn(`Policy question for article ${article.id} failed:`, error instanceof Error ? error.message : error);
  }
  return questionForArticle(article.id);
}

async function processArticle(article: Article, source: ArticleSource, stats: PipelineStats): Promise<void> {
  const text = `${article.title} ${article.content}`;
  const mentions = await TDExtractionService.extractTDMentions(text);
  const substantial = mentions.filter((m) => TDExtractionService.isSubstantialMention(text, m.name));

  // One mention per TD, each with its row: no lookup per mention.
  const candidates: CandidateTd[] = [];
  for (const { td } of substantial) {
    await linkArticleTd(article.id, td.id);
    candidates.push(toCandidate(td));
  }
  stats.tdsLinked += candidates.length;

  await recordStances({ id: article.id, title: article.title, content: article.content }, candidates, stats.stances, {
    complete: completeJson,
    position: (passage) => positionProbability(passage),
    question: () => ensureQuestion(article),
  });

  await source.markProcessed(article.id, {
    importanceScore: relevanceOf(article),
    skippedReason: substantial.length > 0 ? undefined : mentions.length === 0 ? 'No TD mentioned' : 'TDs mentioned only in passing',
  });
}
