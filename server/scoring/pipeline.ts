/**
 * News → TD scoring pipeline.
 *
 * 1. Fetch unprocessed articles. Same-event duplicates were linked at ingest and are never
 *    claimed, so every article here is the one canonical report of its event.
 * 2. Cheap LLM importance triage; keep the top slice.
 * 3. Find the TDs each article is substantially about.
 * 4. Run the multi-agent panel per (article, TD); apply the result to that TD's ELOs,
 *    record the article↔TD verdict and any policy stance, feed the ideology profile.
 * 5. Recompute derived scores, ranks, trends and party aggregates.
 */
import { ArticleImportanceService } from '../services/articleImportanceService';
import { generateQuestionForArticle } from '../voting';
import { TDExtractionService } from '../services/tdExtractionService';
import { type Article, type ArticleSource, articleSource } from './articleSource';
import { applyIdeologyToProfile, applyPanelResult, convertToArticleAnalysis, runPanel } from './panel';
import { recalculateAll } from './recalculate';
import * as repo from './repository';

export interface PipelineStats {
  totalArticles: number;
  importanceScored: number;
  selectedForScoring: number;
  skippedLowImportance: number;
  articlesProcessed: number;
  tdsUpdated: number;
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

const GOVERNMENT_PARTIES = new Set(['Fine Gael', 'Fianna Fáil', 'Green Party']);
const MIN_MENTION_CONFIDENCE = 0.7;
const MIN_CONTENT_CHARS = 500;

function emptyStats(): PipelineStats {
  return {
    totalArticles: 0,
    importanceScored: 0,
    selectedForScoring: 0,
    skippedLowImportance: 0,
    articlesProcessed: 0,
    tdsUpdated: 0,
    errors: 0,
    articlesFailed: [],
  };
}

type Importance = Awaited<ReturnType<typeof ArticleImportanceService.scoreArticleImportance>>;

export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineStats> {
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
      scoreApplied: false,
      skippedReason: `Below ${topPercentile}th percentile (score: ${importance.score})`,
    });
  }
  if (topArticles.length === 0) return stats;

  const byId = new Map(articles.map((a) => [a.id, a]));
  for (const { article: scored, importance } of topArticles) {
    const article = byId.get(scored.id)!;
    try {
      await ensureFullContent(article, source);
      await scoreArticle(article, importance, source, stats);
      stats.articlesProcessed++;
    } catch (error) {
      stats.errors++;
      stats.articlesFailed.push(article.title);
      await source.markProcessed(article.id, {
        importanceScore: importance.score,
        importanceReasoning: importance.reasoning,
        scoreApplied: false,
        errorMessage: String(error),
      });
    }
  }

  if (stats.tdsUpdated > 0) await recalculateAll();
  return stats;
}

/** Score a single article by id, bypassing triage. A duplicate's id scores its canonical. For manual runs. */
export async function scoreArticleById(articleId: number, source: ArticleSource = articleSource): Promise<PipelineStats> {
  const article = await source.fetchById(articleId);
  if (!article) throw new Error(`Article not found: ${articleId}`);
  if (article.id !== articleId) console.log(`Article ${articleId} is a duplicate; scoring its canonical, article ${article.id}.`);
  const importance = await ArticleImportanceService.scoreArticleImportance({
    title: article.title,
    content: article.content,
    source: article.source ?? undefined,
  });
  const stats = emptyStats();
  stats.totalArticles = 1;
  await ensureFullContent(article, source);
  await scoreArticle(article, importance, source, stats);
  stats.articlesProcessed = 1;
  if (stats.tdsUpdated > 0) await recalculateAll();
  return stats;
}

async function ensureFullContent(article: Article, source: ArticleSource): Promise<void> {
  if (article.content.length >= MIN_CONTENT_CHARS || !article.url) return;
  try {
    const { scrapeArticleContent } = await import('../news/content');
    const full = await scrapeArticleContent(article.url);
    if (full && full.length > 200) {
      article.content = full;
      await source.saveContent(article.id, full);
    }
  } catch (error) {
    console.warn(`Could not fetch full content for article ${article.id}:`, error instanceof Error ? error.message : error);
  }
}

async function scoreArticle(article: Article, importance: Importance, source: ArticleSource, stats: PipelineStats): Promise<void> {
  const text = `${article.title} ${article.content}`;
  const mentions = TDExtractionService.filterHighConfidenceMentions(
    await TDExtractionService.extractTDMentions(text),
    MIN_MENTION_CONFIDENCE,
  );
  const substantial = mentions.filter((m) => TDExtractionService.isSubstantialMention(text, m.name));

  if (substantial.length === 0) {
    await source.markProcessed(article.id, {
      importanceScore: importance.score,
      importanceReasoning: importance.reasoning,
      scoreApplied: false,
      skippedReason: mentions.length === 0 ? 'No TD mentioned' : 'TDs mentioned only in passing',
    });
    return;
  }

  let anyScored = false;
  for (const mention of substantial) {
    const td = await repo.findByName(mention.name);
    if (!td) {
      console.warn(`Extraction named "${mention.name}" but no such TD exists`);
      continue;
    }
    try {
      await scoreTd(article, td, importance, stats);
      anyScored = true;
    } catch (error) {
      console.error(`Scoring ${mention.name} for article ${article.id} failed:`, error);
      stats.errors++;
    }
  }

  const primary = substantial[0];
  await source.markProcessed(article.id, {
    importanceScore: importance.score,
    importanceReasoning: importance.reasoning,
    scoreApplied: anyScored,
    primaryTd: { name: primary.name, party: primary.party || null, constituency: primary.constituency || null },
  });
}

async function scoreTd(article: Article, { td, score }: repo.TdWithScore, importance: Importance, stats: PipelineStats): Promise<void> {
  const result = await runPanel(
    { id: article.id, title: article.title, content: article.content, source: article.source ?? undefined },
    {
      name: td.name,
      party: td.party ?? undefined,
      constituency: td.constituency ?? undefined,
      isGovernment: td.party ? GOVERNMENT_PARTIES.has(td.party) : false,
    },
    `Importance: ${importance.score} (${importance.topicCategory})`,
  );

  await applyPanelResult(result, { id: article.id, publishedDate: article.publishedDate, credibility: article.credibility }, td.id, repo.ratingsOf(score));
  await applyIdeologyToProfile(result, { id: article.id, published_date: article.publishedDate ?? undefined, source: article.source ?? undefined }, { name: td.name });

  const verdict = convertToArticleAnalysis(result);
  await repo.upsertArticleScore({
    articleId: article.id,
    tdId: td.id,
    impact: verdict.impact_score,
    dimensionScores: {
      transparency: verdict.transparency_score,
      effectiveness: verdict.effectiveness_score,
      integrity: verdict.integrity_score,
      consistency: verdict.consistency_score,
    },
    storyType: importance.topicCategory,
    sentiment: verdict.impact_score > 2 ? 'positive' : verdict.impact_score < -2 ? 'negative' : 'neutral',
    needsReview: verdict.needs_review,
    reasoning: verdict.ai_reasoning,
    analyzedBy: verdict.analyzed_by,
    isIdeologicalPolicy: verdict.is_ideological_policy,
    policyDirection: verdict.policy_direction,
  });

  if (verdict.td_policy_stance) {
    await repo.upsertPolicyStance({
      articleId: article.id,
      tdId: td.id,
      stance: verdict.td_policy_stance.stance,
      stanceStrength: verdict.td_policy_stance.strength,
      evidence: verdict.td_policy_stance.evidence,
      policyTopic: verdict.td_policy_stance.policy_topic,
      policyDimension: policyDimension(verdict.td_policy_stance.policy_topic),
    });
  }

  stats.tdsUpdated++;

  // The one place questions are made. Called per (article, TD), but an article with a
  // question already is skipped before any model call.
  if (verdict.is_ideological_policy && verdict.td_policy_stance) {
    try {
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
  }
}

const POLICY_DIMENSIONS: Array<[RegExp, string]> = [
  [/immigration|asylum|refugee|ipas/, 'immigration'],
  [/health|hospital|medical/, 'healthcare'],
  [/housing|rent|homeless/, 'housing'],
  [/tax|budget|economy|business/, 'economy'],
  [/climate|environment|green/, 'environment'],
  [/welfare|social|benefit/, 'social_issues'],
  [/crime|police|justice|court/, 'justice'],
  [/education|school|university/, 'education'],
];

function policyDimension(topic: string): string {
  const t = topic.toLowerCase();
  return POLICY_DIMENSIONS.find(([re]) => re.test(t))?.[1] ?? 'general';
}
