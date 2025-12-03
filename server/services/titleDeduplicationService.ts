/**
 * Title Deduplication Service
 * 
 * Layer 1: Quick title-based deduplication at scrape time
 * Catches obvious duplicates (same story from different sources) immediately.
 * 
 * Cost: FREE (just string comparison, no LLM calls)
 * Speed: <10ms per check
 */

import { supabaseDb as supabase } from '../db.js';

interface SimilarityResult {
  isDuplicate: boolean;
  similarArticleId?: number;
  similarTitle?: string;
  similarSource?: string;
  similarityScore: number;
  reason?: string;
}

/**
 * Normalize a title for comparison
 * Removes common words, punctuation, and normalizes case
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[''""]/g, "'") // Normalize quotes
    .replace(/[^\w\s']/g, ' ') // Remove punctuation except apostrophes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract significant words from a title (skip common words)
 */
function extractSignificantWords(title: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
    'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'also', 'now', 'new', 'says', 'said', 'over',
    'after', 'before', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'about', 'into', 'through', 'during', 'above',
    // Irish political common words
    'ireland', 'irish', 'government', 'minister', 'td', 'tds', 'dail',
    'calls', 'call', 'amid', 'following', 'latest', 'breaking', 'update'
  ]);
  
  const normalized = normalizeTitle(title);
  const words = normalized.split(' ').filter(word => 
    word.length > 2 && !stopWords.has(word)
  );
  
  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two sets of words
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Calculate n-gram similarity for catching reworded titles
 */
function ngramSimilarity(title1: string, title2: string, n: number = 3): number {
  const getNgrams = (text: string): Set<string> => {
    const ngrams = new Set<string>();
    const normalized = normalizeTitle(text);
    for (let i = 0; i <= normalized.length - n; i++) {
      ngrams.add(normalized.slice(i, i + n));
    }
    return ngrams;
  };
  
  const ngrams1 = getNgrams(title1);
  const ngrams2 = getNgrams(title2);
  
  return jaccardSimilarity(ngrams1, ngrams2);
}

/**
 * Calculate combined similarity score
 */
function calculateSimilarity(title1: string, title2: string): number {
  const words1 = extractSignificantWords(title1);
  const words2 = extractSignificantWords(title2);
  
  // Word overlap (most important)
  const wordSimilarity = jaccardSimilarity(words1, words2);
  
  // Character n-gram similarity (catches typos, minor rewording)
  const charSimilarity = ngramSimilarity(title1, title2, 4);
  
  // Weighted combination
  return (wordSimilarity * 0.7) + (charSimilarity * 0.3);
}

/**
 * Check if an article title is a duplicate of recent articles
 * 
 * @param title - The title to check
 * @param lookbackHours - How far back to check (default 48 hours)
 * @param threshold - Similarity threshold (default 0.6 = 60%)
 * @returns SimilarityResult indicating if it's a duplicate
 */
export async function checkForDuplicate(
  title: string,
  options: {
    lookbackHours?: number;
    threshold?: number;
    excludeSource?: string;  // Don't compare against same source
  } = {}
): Promise<SimilarityResult> {
  
  const lookbackHours = options.lookbackHours || 48;
  const threshold = options.threshold || 0.6;
  
  try {
    // Get recent articles from database
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - lookbackHours);
    
    let query = supabase
      .from('news_articles')
      .select('id, title, source, published_date')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);  // Check last 200 articles max
    
    const { data: recentArticles, error } = await query;
    
    if (error) {
      console.error('Error fetching recent articles for dedup:', error);
      return { isDuplicate: false, similarityScore: 0 };
    }
    
    if (!recentArticles || recentArticles.length === 0) {
      return { isDuplicate: false, similarityScore: 0 };
    }
    
    // Check similarity against each recent article
    let highestSimilarity = 0;
    let mostSimilarArticle: typeof recentArticles[0] | null = null;
    
    for (const article of recentArticles) {
      // Optionally skip same source (they might have the same title legitimately)
      if (options.excludeSource && article.source === options.excludeSource) {
        continue;
      }
      
      const similarity = calculateSimilarity(title, article.title);
      
      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        mostSimilarArticle = article;
      }
      
      // Early exit if we find a very high match
      if (similarity > 0.85) {
        break;
      }
    }
    
    const isDuplicate = highestSimilarity >= threshold;
    
    return {
      isDuplicate,
      similarArticleId: isDuplicate && mostSimilarArticle ? mostSimilarArticle.id : undefined,
      similarTitle: isDuplicate && mostSimilarArticle ? mostSimilarArticle.title : undefined,
      similarSource: isDuplicate && mostSimilarArticle ? mostSimilarArticle.source : undefined,
      similarityScore: highestSimilarity,
      reason: isDuplicate 
        ? `${Math.round(highestSimilarity * 100)}% similar to existing article from ${mostSimilarArticle?.source}`
        : undefined
    };
    
  } catch (error) {
    console.error('Error in duplicate check:', error);
    return { isDuplicate: false, similarityScore: 0 };
  }
}

/**
 * Batch check multiple titles for duplicates
 * More efficient than checking one by one
 */
export async function batchCheckForDuplicates(
  titles: Array<{ title: string; source: string }>,
  options: {
    lookbackHours?: number;
    threshold?: number;
  } = {}
): Promise<Map<string, SimilarityResult>> {
  
  const lookbackHours = options.lookbackHours || 48;
  const threshold = options.threshold || 0.6;
  const results = new Map<string, SimilarityResult>();
  
  try {
    // Get recent articles from database (single query)
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - lookbackHours);
    
    const { data: recentArticles, error } = await supabase
      .from('news_articles')
      .select('id, title, source, published_date')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(300);
    
    if (error) {
      console.error('Error fetching recent articles for batch dedup:', error);
      titles.forEach(t => results.set(t.title, { isDuplicate: false, similarityScore: 0 }));
      return results;
    }
    
    const existingArticles = recentArticles || [];
    
    // Check each new title
    for (const { title, source } of titles) {
      let highestSimilarity = 0;
      let mostSimilarArticle: typeof existingArticles[0] | null = null;
      
      // Also check against OTHER titles in the incoming batch (catch duplicates within same scrape)
      const otherNewTitles = titles.filter(t => t.title !== title);
      
      // Check against existing DB articles
      for (const article of existingArticles) {
        const similarity = calculateSimilarity(title, article.title);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          mostSimilarArticle = article;
        }
      }
      
      // Check against other incoming articles (from different sources)
      for (const other of otherNewTitles) {
        if (other.source !== source) {  // Different source
          const similarity = calculateSimilarity(title, other.title);
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            mostSimilarArticle = { id: -1, title: other.title, source: other.source, published_date: null };
          }
        }
      }
      
      const isDuplicate = highestSimilarity >= threshold;
      
      results.set(title, {
        isDuplicate,
        similarArticleId: isDuplicate && mostSimilarArticle && mostSimilarArticle.id > 0 
          ? mostSimilarArticle.id 
          : undefined,
        similarTitle: isDuplicate && mostSimilarArticle ? mostSimilarArticle.title : undefined,
        similarSource: isDuplicate && mostSimilarArticle ? mostSimilarArticle.source : undefined,
        similarityScore: highestSimilarity,
        reason: isDuplicate 
          ? `${Math.round(highestSimilarity * 100)}% similar to ${mostSimilarArticle?.source}`
          : undefined
      });
    }
    
    return results;
    
  } catch (error) {
    console.error('Error in batch duplicate check:', error);
    titles.forEach(t => results.set(t.title, { isDuplicate: false, similarityScore: 0 }));
    return results;
  }
}

export const TitleDeduplicationService = {
  checkForDuplicate,
  batchCheckForDuplicates,
  calculateSimilarity,  // Exported for testing
  extractSignificantWords  // Exported for testing
};

