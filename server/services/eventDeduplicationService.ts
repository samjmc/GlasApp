/**
 * Event Deduplication Service
 * 
 * Clusters articles by event/story and selects the best article from each cluster.
 * Prevents scoring the same event multiple times (e.g., 3 articles about Herzog Park).
 * 
 * Uses a single LLM call to:
 * 1. Cluster articles by event
 * 2. Select the "canonical" article from each cluster
 * 
 * Cost: ~$0.001-0.002 per batch (gpt-4o-mini, ~500-1000 tokens)
 */

import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// Source reputation tiers (higher = more reputable)
const SOURCE_REPUTATION: Record<string, number> = {
  // Tier 1: Premium Irish sources
  'rte.ie': 95,
  'rte news': 95,
  'irishtimes.com': 95,
  'irish times': 95,
  'the irish times': 95,
  'irish examiner': 90,
  'irishexaminer.com': 90,
  
  // Tier 2: Quality national sources
  'thejournal.ie': 85,
  'the journal': 85,
  'independent.ie': 82,
  'irish independent': 82,
  'breakingnews.ie': 80,
  
  // Tier 3: Regional and specialized
  'businesspost.ie': 80,
  'business post': 80,
  'sunday business post': 80,
  'newstalk': 78,
  'todayfm': 75,
  'irishmirror.ie': 70,
  'irish mirror': 70,
  'irish daily mail': 70,
  
  // Tier 4: Other sources
  'thestar.ie': 65,
  'irish star': 65,
  'irishcentral.com': 60,
  'politico.eu': 85,
  'bbc.com': 90,
  'bbc news': 90,
  'the guardian': 88,
  'theguardian.com': 88,
};

interface ArticleForClustering {
  id: number;
  title: string;
  content: string;
  source?: string;
  published_date?: string;
  importance_score?: number;
}

interface ClusterResult {
  eventName: string;
  eventDescription: string;
  articles: number[];  // Article IDs in this cluster
  selectedArticleId: number;
  selectionReason: string;
}

interface DeduplicationResult {
  selectedArticles: ArticleForClustering[];
  clusters: ClusterResult[];
  stats: {
    inputCount: number;
    outputCount: number;
    clustersFound: number;
    duplicatesRemoved: number;
  };
}

const CLUSTERING_PROMPT = `
You are an expert at identifying when multiple news articles cover the SAME EVENT or STORY.

Your task:
1. Group articles that cover the SAME event/story
2. For each group, select the BEST article to represent that event

## What counts as "same event":
- Multiple reports about the same incident (e.g., "Minister linked to lobbying scandal")
- Follow-up coverage of a breaking story
- Different outlets covering identical news
- Updates on an ongoing situation from the same day

## What is NOT "same event":
- Articles about the same TOPIC but different incidents
- Articles about the same politician but different issues
- Articles from significantly different time periods about recurring issues

## Selection criteria (in order of priority):
1. **Source reputation**: Prefer Irish Times, RTE, Irish Examiner over tabloids
2. **Article depth**: Longer, more detailed articles with quotes
3. **Original reporting**: Prefer original investigation over aggregated coverage
4. **Clarity**: Clear attribution of actions to specific politicians
5. **Recency**: If similar quality, prefer more recent

## Response format:
Return JSON with clusters. Each cluster has:
- event_name: Short name for the event
- event_description: One sentence describing what happened
- article_ids: Array of article IDs that cover this event
- selected_id: The ID of the best article to use
- reason: Why this article was selected

Articles that don't cluster with others should be their own single-article cluster.

IMPORTANT: Every article must appear in exactly one cluster.
`;

/**
 * Cluster articles by event and select canonical articles
 */
export async function clusterAndDeduplicate(
  articles: ArticleForClustering[]
): Promise<DeduplicationResult> {
  
  if (articles.length === 0) {
    return {
      selectedArticles: [],
      clusters: [],
      stats: {
        inputCount: 0,
        outputCount: 0,
        clustersFound: 0,
        duplicatesRemoved: 0
      }
    };
  }
  
  // If only 1 article, no clustering needed
  if (articles.length === 1) {
    return {
      selectedArticles: articles,
      clusters: [{
        eventName: 'Single Article',
        eventDescription: articles[0].title,
        articles: [articles[0].id],
        selectedArticleId: articles[0].id,
        selectionReason: 'Only article in batch'
      }],
      stats: {
        inputCount: 1,
        outputCount: 1,
        clustersFound: 1,
        duplicatesRemoved: 0
      }
    };
  }
  
  console.log(`\n🔍 Clustering ${articles.length} articles by event...`);
  
  // Prepare articles for LLM (include source reputation hints)
  const articlesForLLM = articles.map(a => ({
    id: a.id,
    title: a.title,
    source: a.source || 'Unknown',
    source_reputation: getSourceReputation(a.source),
    word_count: (a.content || '').split(/\s+/).length,
    date: a.published_date,
    preview: (a.content || '').slice(0, 300) + '...'
  }));
  
  const input = `
ARTICLES TO CLUSTER:

${articlesForLLM.map((a, i) => `
[Article ${a.id}]
Title: ${a.title}
Source: ${a.source} (reputation: ${a.source_reputation}/100)
Words: ${a.word_count}
Date: ${a.date}
Preview: ${a.preview}
`).join('\n---\n')}

Cluster these articles by event and select the best representative for each cluster.
Return as JSON: { "clusters": [...] }
`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CLUSTERING_PROMPT },
        { role: "user", content: input }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500
    });
    
    const result = JSON.parse(response.choices[0].message.content || '{"clusters": []}');
    const clusters: ClusterResult[] = (result.clusters || []).map((c: any) => ({
      eventName: c.event_name || 'Unknown Event',
      eventDescription: c.event_description || '',
      articles: c.article_ids || [],
      selectedArticleId: c.selected_id,
      selectionReason: c.reason || ''
    }));
    
    // Validate that all articles are accounted for
    const clusteredIds = new Set(clusters.flatMap(c => c.articles));
    const missingArticles = articles.filter(a => !clusteredIds.has(a.id));
    
    // Add any missing articles as single-article clusters
    for (const missing of missingArticles) {
      clusters.push({
        eventName: 'Unclustered',
        eventDescription: missing.title,
        articles: [missing.id],
        selectedArticleId: missing.id,
        selectionReason: 'Not clustered by LLM - included as standalone'
      });
    }
    
    // Get selected articles
    const selectedIds = new Set(clusters.map(c => c.selectedArticleId));
    const selectedArticles = articles.filter(a => selectedIds.has(a.id));
    
    // Stats
    const duplicatesRemoved = articles.length - selectedArticles.length;
    
    console.log(`\n📊 Event Clustering Complete:`);
    console.log(`   Input: ${articles.length} articles`);
    console.log(`   Clusters found: ${clusters.length}`);
    console.log(`   Output: ${selectedArticles.length} unique events`);
    console.log(`   Duplicates removed: ${duplicatesRemoved}`);
    
    if (clusters.length > 0) {
      console.log(`\n   📰 Clusters:`);
      clusters.forEach((cluster, i) => {
        const selectedArticle = articles.find(a => a.id === cluster.selectedArticleId);
        const isMulti = cluster.articles.length > 1;
        const marker = isMulti ? '🔗' : '📄';
        console.log(`      ${marker} ${cluster.eventName} (${cluster.articles.length} articles)`);
        if (isMulti) {
          console.log(`         Selected: "${selectedArticle?.title.substring(0, 50)}..."`);
          console.log(`         Reason: ${cluster.selectionReason}`);
        }
      });
    }
    
    return {
      selectedArticles,
      clusters,
      stats: {
        inputCount: articles.length,
        outputCount: selectedArticles.length,
        clustersFound: clusters.length,
        duplicatesRemoved
      }
    };
    
  } catch (error) {
    console.error('❌ Event clustering failed:', error);
    
    // Fallback: Use simple title-based deduplication
    console.log('   ⚠️ Falling back to title-based deduplication...');
    return fallbackDeduplication(articles);
  }
}

/**
 * Get source reputation score
 */
function getSourceReputation(source?: string): number {
  if (!source) return 50;
  
  const normalizedSource = source.toLowerCase().trim();
  
  // Check for exact matches
  if (SOURCE_REPUTATION[normalizedSource]) {
    return SOURCE_REPUTATION[normalizedSource];
  }
  
  // Check for partial matches
  for (const [key, score] of Object.entries(SOURCE_REPUTATION)) {
    if (normalizedSource.includes(key) || key.includes(normalizedSource)) {
      return score;
    }
  }
  
  // Default reputation
  return 50;
}

/**
 * Fallback deduplication using simple title similarity
 */
function fallbackDeduplication(articles: ArticleForClustering[]): DeduplicationResult {
  const clusters: ClusterResult[] = [];
  const processedIds = new Set<number>();
  
  for (const article of articles) {
    if (processedIds.has(article.id)) continue;
    
    // Find similar articles by title
    const similarArticles = articles.filter(other => {
      if (processedIds.has(other.id)) return false;
      if (other.id === article.id) return true;
      return calculateTitleSimilarity(article.title, other.title) > 0.6;
    });
    
    // Mark all as processed
    similarArticles.forEach(a => processedIds.add(a.id));
    
    // Select best article from cluster
    const bestArticle = selectBestArticle(similarArticles);
    
    clusters.push({
      eventName: 'Auto-clustered',
      eventDescription: bestArticle.title,
      articles: similarArticles.map(a => a.id),
      selectedArticleId: bestArticle.id,
      selectionReason: 'Title similarity clustering (fallback)'
    });
  }
  
  const selectedIds = new Set(clusters.map(c => c.selectedArticleId));
  const selectedArticles = articles.filter(a => selectedIds.has(a.id));
  
  return {
    selectedArticles,
    clusters,
    stats: {
      inputCount: articles.length,
      outputCount: selectedArticles.length,
      clustersFound: clusters.length,
      duplicatesRemoved: articles.length - selectedArticles.length
    }
  };
}

/**
 * Simple title similarity calculation
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(title1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(title2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Select the best article from a cluster
 */
function selectBestArticle(articles: ArticleForClustering[]): ArticleForClustering {
  return articles.reduce((best, current) => {
    const bestScore = calculateArticleScore(best);
    const currentScore = calculateArticleScore(current);
    return currentScore > bestScore ? current : best;
  });
}

/**
 * Calculate overall score for article selection
 */
function calculateArticleScore(article: ArticleForClustering): number {
  let score = 0;
  
  // Source reputation (0-100 points)
  score += getSourceReputation(article.source);
  
  // Content length (up to 50 points)
  const wordCount = (article.content || '').split(/\s+/).length;
  score += Math.min(50, wordCount / 20);
  
  // Importance score if available (0-30 points)
  if (article.importance_score) {
    score += (article.importance_score / 100) * 30;
  }
  
  return score;
}

export const EventDeduplicationService = {
  clusterAndDeduplicate,
  getSourceReputation
};

