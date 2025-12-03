/**
 * Article Importance Service
 * 
 * Uses a cheap LLM call to score article importance (0-100)
 * Only the top 25% of articles get full multi-agent scoring
 * 
 * Cost: ~$0.0005 per article (gpt-4o-mini, ~200 tokens)
 */

import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export interface ImportanceResult {
  score: number;              // 0-100
  reasoning: string;          // Brief explanation
  politiciansMentioned: string[];  // Names detected
  topicCategory: string;      // scandal, policy, constituency, general
  isPrimarySubject: boolean;  // Is a politician the main subject?
}

const IMPORTANCE_PROMPT = `
You are an article importance scorer for an Irish political accountability system.

Score this article's IMPORTANCE for politician scoring (0-100).

HIGH IMPORTANCE (80-100):
- Politician is PRIMARY subject (not just mentioned)
- Scandal, corruption, ethics violations
- Major policy announcements/failures
- Cabinet ministers, Taoiseach, Tánaiste
- Clear actions with consequences
- Breaking news, exclusive stories

MEDIUM IMPORTANCE (50-79):
- Politician takes clear position on policy
- Parliamentary activity (votes, questions, speeches)
- Local/constituency matters with substance
- Party leaders, senior TDs
- Policy debates with quotes

LOW IMPORTANCE (20-49):
- Politician briefly mentioned
- General news mentioning multiple politicians
- Routine announcements
- Press releases without substance
- Backbenchers with minor mentions

VERY LOW IMPORTANCE (0-19):
- Politician name appears but no real story
- Social/ceremonial events
- Generic party statements
- No accountability implications

SENIOR POLITICIANS (bonus +10-20 if primary subject):
- Taoiseach, Tánaiste, Ministers: +20
- Party Leaders, Ministers of State: +15
- Senior TDs (front bench): +10

Respond with ONLY JSON:
{
  "score": 75,
  "reasoning": "Brief 1-sentence explanation",
  "politicians_mentioned": ["Name 1", "Name 2"],
  "topic_category": "scandal|policy|constituency|parliamentary|general",
  "is_primary_subject": true
}
`;

/**
 * Score a single article's importance
 */
export async function scoreArticleImportance(
  article: { 
    title: string; 
    content: string; 
    source?: string;
    published_date?: string;
  }
): Promise<ImportanceResult> {
  
  const input = `
ARTICLE:
Title: ${article.title}
Source: ${article.source || 'Unknown'}
Date: ${article.published_date || 'Recent'}

Content (first 1500 chars):
${(article.content || '').slice(0, 1500)}

Score the importance of this article for political accountability.
`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: IMPORTANCE_PROMPT },
        { role: "user", content: input }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,  // Low temperature for consistent scoring
      max_tokens: 200    // Keep response short
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      score: Math.max(0, Math.min(100, result.score || 0)),
      reasoning: result.reasoning || '',
      politiciansMentioned: result.politicians_mentioned || [],
      topicCategory: result.topic_category || 'general',
      isPrimarySubject: result.is_primary_subject || false
    };
    
  } catch (error) {
    console.error('Article importance scoring failed:', error);
    // Return moderate score on error to not exclude potentially important articles
    return {
      score: 50,
      reasoning: 'Error scoring - defaulting to medium importance',
      politiciansMentioned: [],
      topicCategory: 'general',
      isPrimarySubject: false
    };
  }
}

/**
 * Batch score multiple articles and return sorted by importance
 */
export async function batchScoreAndRank(
  articles: Array<{
    id: number;
    title: string;
    content: string;
    source?: string;
    published_date?: string;
  }>,
  options: {
    topPercentile?: number;  // Default 25 = top 25%
    minScore?: number;       // Minimum score to include (default 40)
    parallelLimit?: number;  // How many to score in parallel (default 5)
  } = {}
): Promise<{
  topArticles: Array<{ article: typeof articles[0]; importance: ImportanceResult }>;
  skippedArticles: Array<{ article: typeof articles[0]; importance: ImportanceResult }>;
  stats: {
    total: number;
    scored: number;
    avgScore: number;
    topCount: number;
    skippedCount: number;
  };
}> {
  
  const topPercentile = options.topPercentile || 25;
  const minScore = options.minScore || 40;
  const parallelLimit = options.parallelLimit || 5;
  
  console.log(`\n📊 Scoring importance of ${articles.length} articles...`);
  
  const scoredArticles: Array<{ article: typeof articles[0]; importance: ImportanceResult }> = [];
  
  // Score in batches to avoid rate limits
  for (let i = 0; i < articles.length; i += parallelLimit) {
    const batch = articles.slice(i, i + parallelLimit);
    
    const batchResults = await Promise.all(
      batch.map(async (article) => {
        const importance = await scoreArticleImportance(article);
        return { article, importance };
      })
    );
    
    scoredArticles.push(...batchResults);
    
    // Progress
    const progress = Math.min(i + parallelLimit, articles.length);
    console.log(`   Scored ${progress}/${articles.length} articles...`);
  }
  
  // Sort by importance score (highest first)
  scoredArticles.sort((a, b) => b.importance.score - a.importance.score);
  
  // Calculate cutoff
  const topCount = Math.ceil(articles.length * (topPercentile / 100));
  
  // Split into top and skipped
  const topArticles = scoredArticles
    .slice(0, topCount)
    .filter(a => a.importance.score >= minScore);  // Also apply minimum score
  
  const skippedArticles = scoredArticles.slice(topCount);
  // Also add any from top that didn't meet minimum
  const belowMinimum = scoredArticles
    .slice(0, topCount)
    .filter(a => a.importance.score < minScore);
  skippedArticles.push(...belowMinimum);
  
  // Calculate stats
  const totalScore = scoredArticles.reduce((sum, a) => sum + a.importance.score, 0);
  const avgScore = articles.length > 0 ? totalScore / articles.length : 0;
  
  console.log(`\n📊 Importance Scoring Complete:`);
  console.log(`   Total Articles: ${articles.length}`);
  console.log(`   Average Score: ${avgScore.toFixed(1)}`);
  console.log(`   Top ${topPercentile}% (≥${minScore}): ${topArticles.length} articles`);
  console.log(`   Skipped: ${skippedArticles.length} articles`);
  
  if (topArticles.length > 0) {
    console.log(`\n   🔝 Top Articles:`);
    topArticles.slice(0, 5).forEach((a, i) => {
      console.log(`      ${i + 1}. [${a.importance.score}] ${a.article.title.substring(0, 50)}...`);
    });
  }
  
  return {
    topArticles,
    skippedArticles,
    stats: {
      total: articles.length,
      scored: scoredArticles.length,
      avgScore,
      topCount: topArticles.length,
      skippedCount: skippedArticles.length
    }
  };
}

export const ArticleImportanceService = {
  scoreArticleImportance,
  batchScoreAndRank
};

