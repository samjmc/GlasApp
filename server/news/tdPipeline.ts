/**
 * News → TD pipeline. It links articles to the TDs they name and makes daily-vote questions.
 * It does NOT score anyone: a TD's score is built only from Oireachtas facts (docs/scoring.md).
 *
 * 1. Claim unprocessed articles. Same-event duplicates were linked at ingest and are never
 *    claimed, so every article here is the one canonical report of its event.
 * 2. Cheap LLM importance triage; keep the top slice.
 * 3. Find the TDs each article is substantially about and record each link in `article_tds`.
 * 4. Record what those TDs said (server/stances): a quote checked against the article, never a
 *    score. Only an article with at least one verified stance gets a daily-vote question, and
 *    each stance is matched to one of its answers.
 */
import { ArticleImportanceService } from '../services/articleImportanceService';
import { TDExtractionService } from '../services/tdExtractionService';
import { repository as tdRepo } from '../scoring';
import { emptyStanceStats, recordStances, toCandidate, type StanceStats } from '../stances';
import type { CandidateTd } from '../stances/extract';
import { completeJson, generateQuestionForArticle, questionForArticle, type QuestionPositions } from '../voting';
import { type Article, type ArticleSource, articleSource } from './articleSource';
import { linkArticleTd } from './repository';

export interface PipelineStats {
  totalArticles: number;
  importanceScored: number;
  selectedForScoring: number;
  skippedLowImportance: number;
  articlesProcessed: number;
  /** Article ↔ TD links recorded. */
  tdsLinked: number;
  stances: StanceStats;
  errors: number;
  articlesFailed: string[];
}

export interface PipelineOptions {
  batchSize?: number;
  /** Keep the top N percent by importance. */
  topPercentile?: number;
  minImportanceScore?: number;
  source?: ArticleSource;
}

const MIN_MENTION_CONFIDENCE = 0.7;
const MIN_CONTENT_CHARS = 500;

function emptyStats(): PipelineStats {
  return {
    totalArticles: 0,
    importanceScored: 0,
    selectedForScoring: 0,
    skippedLowImportance: 0,
    articlesProcessed: 0,
    tdsLinked: 0,
    stances: emptyStanceStats(),
    errors: 0,
    articlesFailed: [],
  };
}

type Importance = Awaited<ReturnType<typeof ArticleImportanceService.scoreArticleImportance>>;

export async function runTdPipeline(options: PipelineOptions = {}): Promise<PipelineStats> {
  const source = options.source ?? articleSource;
  const batchSize = options.batchSize ?? 50;
  const topPercentile = options.topPercentile ?? 25;
  const minImportanceScore = options.minImportanceScore ?? 40;
  const stats = emptyStats();

  const articles = await source.fetchUnprocessed(batchSize);
  stats.totalArticles = articles.length;
  if (articles.length === 0) return stats;

  const importanceInput = articles.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    source: a.source ?? undefined,
    published_date: a.publishedDate?.toISOString(),
  }));
  const { topArticles, skippedArticles, stats: importanceStats } = await ArticleImportanceService.batchScoreAndRank(
    importanceInput,
    { topPercentile, minScore: minImportanceScore, parallelLimit: 5 },
  );
  stats.importanceScored = importanceStats.scored;
  stats.selectedForScoring = topArticles.length;
  stats.skippedLowImportance = skippedArticles.length;

  for (const { article, importance } of skippedArticles) {
    await source.markProcessed(article.id, {
      importanceScore: importance.score,
      importanceReasoning: importance.reasoning,
      skippedReason: `Below ${topPercentile}th percentile (score: ${importance.score})`,
    });
  }

  const byId = new Map(articles.map((a) => [a.id, a]));
  for (const { article: ranked, importance } of topArticles) {
    const article = byId.get(ranked.id)!;
    try {
      await ensureFullContent(article, source);
      await processArticle(article, importance, source, stats);
      stats.articlesProcessed++;
    } catch (error) {
      stats.errors++;
      stats.articlesFailed.push(article.title);
      await source.markProcessed(article.id, {
        importanceScore: importance.score,
        importanceReasoning: importance.reasoning,
        errorMessage: String(error),
      });
    }
  }
  return stats;
}

/** Process one article by id, bypassing triage. A duplicate's id processes its canonical. For manual runs. */
export async function processArticleById(articleId: number, source: ArticleSource = articleSource): Promise<PipelineStats> {
  const article = await source.fetchById(articleId);
  if (!article) throw new Error(`Article not found: ${articleId}`);
  if (article.id !== articleId) console.log(`Article ${articleId} is a duplicate; processing its canonical, article ${article.id}.`);
  const importance = await ArticleImportanceService.scoreArticleImportance({
    title: article.title,
    content: article.content,
    source: article.source ?? undefined,
  });
  const stats = emptyStats();
  stats.totalArticles = 1;
  await ensureFullContent(article, source);
  await processArticle(article, importance, source, stats);
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

/** The article's question, made first if it has none. Null when the model declines or fails. */
async function ensureQuestion(article: Article): Promise<QuestionPositions | null> {
  try {
    // Returns null, without a model call, when the article already has a question.
    await generateQuestionForArticle({
      id: article.id,
      title: article.title,
      content: article.content,
      source: article.source ?? 'Unknown',
      publishedAt: article.publishedDate,
      url: article.url,
      imageUrl: article.imageUrl,
      summary: article.summary,
    });
  } catch (error) {
    console.warn(`Policy question for article ${article.id} failed:`, error instanceof Error ? error.message : error);
  }
  return questionForArticle(article.id);
}

async function processArticle(article: Article, importance: Importance, source: ArticleSource, stats: PipelineStats): Promise<void> {
  const text = `${article.title} ${article.content}`;
  const mentions = TDExtractionService.filterHighConfidenceMentions(
    await TDExtractionService.extractTDMentions(text),
    MIN_MENTION_CONFIDENCE,
  );
  const substantial = mentions.filter((m) => TDExtractionService.isSubstantialMention(text, m.name));

  let linked = 0;
  const candidates: CandidateTd[] = [];
  for (const mention of substantial) {
    const found = await tdRepo.findByName(mention.name);
    if (!found) {
      console.warn(`Extraction named "${mention.name}" but no such TD exists`);
      continue;
    }
    await linkArticleTd(article.id, found.td.id);
    linked++;
    if (!candidates.some((c) => c.id === found.td.id)) candidates.push(toCandidate(found.td));
  }
  stats.tdsLinked += linked;

  await recordStances({ id: article.id, title: article.title, content: article.content }, candidates, stats.stances, {
    complete: completeJson,
    question: () => ensureQuestion(article),
  });

  await source.markProcessed(article.id, {
    importanceScore: importance.score,
    importanceReasoning: importance.reasoning,
    skippedReason: substantial.length > 0 ? undefined : mentions.length === 0 ? 'No TD mentioned' : 'TDs mentioned only in passing',
  });
}
