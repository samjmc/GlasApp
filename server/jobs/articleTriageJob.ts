/**
 * Article Triage Job
 * 
 * Layer 2: Lightweight job that runs frequently (every 15 mins)
 * 
 * Purpose:
 * 1. Score article importance (cheap LLM call)
 * 2. Set visible: true so articles appear in news feed
 * 3. Mark top articles for full multi-agent scoring
 * 
 * This ensures articles become visible quickly while expensive
 * scoring happens in the background.
 * 
 * Cost: ~$0.0005 per article (gpt-4o-mini)
 * Frequency: Every 15 minutes
 */

import { supabaseDb as supabase } from '../db.js';
import { ArticleImportanceService } from '../services/articleImportanceService.js';

interface TriageStats {
  articlesProcessed: number;
  articlesMarkedVisible: number;
  articlesMarkedForScoring: number;
  articlesSkipped: number;
  averageImportance: number;
  errors: number;
}

interface TriageOptions {
  batchSize?: number;
  topPercentile?: number;  // Top X% marked for full scoring
  minImportanceForScoring?: number;  // Minimum importance to be scored
}

/**
 * Run the article triage job
 * 
 * This is a FAST job that:
 * 1. Finds articles where visible = false
 * 2. Scores their importance (cheap LLM)
 * 3. Sets visible = true for ALL (so users see the news)
 * 4. Sets needs_scoring = true for top X%
 */
export async function runArticleTriage(
  options: TriageOptions = {}
): Promise<TriageStats> {
  
  const stats: TriageStats = {
    articlesProcessed: 0,
    articlesMarkedVisible: 0,
    articlesMarkedForScoring: 0,
    articlesSkipped: 0,
    averageImportance: 0,
    errors: 0
  };
  
  const batchSize = options.batchSize || 30;
  const topPercentile = options.topPercentile || 25;
  const minImportanceForScoring = options.minImportanceForScoring || 40;
  
  console.log('\n' + '═'.repeat(60));
  console.log('📋 ARTICLE TRIAGE JOB');
  console.log('═'.repeat(60));
  console.log(`\n⚙️  Config:`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Top percentile for scoring: ${topPercentile}%`);
  console.log(`   Min importance for scoring: ${minImportanceForScoring}`);
  
  try {
    // Step 1: Get articles that need triage (visible = false)
    console.log('\n' + '─'.repeat(60));
    console.log('STEP 1: Finding articles to triage...');
    
    const { data: articles, error } = await supabase
      .from('news_articles')
      .select('id, title, content, source, published_date')
      .eq('visible', false)
      .order('created_at', { ascending: false })
      .limit(batchSize);
    
    if (error) {
      console.error('❌ Error fetching articles:', error);
      return stats;
    }
    
    if (!articles || articles.length === 0) {
      console.log('✅ No articles need triage - all visible!');
      return stats;
    }
    
    console.log(`   Found ${articles.length} articles to triage`);
    stats.articlesProcessed = articles.length;
    
    // Step 2: Score importance for each article
    console.log('\n' + '─'.repeat(60));
    console.log('STEP 2: Scoring article importance...');
    
    const scoredArticles: Array<{
      id: number;
      title: string;
      importance: number;
      reasoning: string;
      topicCategory: string;
      isPrimarySubject: boolean;
    }> = [];
    
    // Process in small parallel batches
    const parallelLimit = 5;
    for (let i = 0; i < articles.length; i += parallelLimit) {
      const batch = articles.slice(i, i + parallelLimit);
      
      const results = await Promise.all(
        batch.map(async (article) => {
          try {
            const importance = await ArticleImportanceService.scoreArticleImportance({
              title: article.title,
              content: article.content || '',
              source: article.source,
              published_date: article.published_date
            });
            
            return {
              id: article.id,
              title: article.title,
              importance: importance.score,
              reasoning: importance.reasoning,
              topicCategory: importance.topicCategory,
              isPrimarySubject: importance.isPrimarySubject
            };
          } catch (err) {
            console.error(`   ❌ Error scoring ${article.title}:`, err);
            stats.errors++;
            return {
              id: article.id,
              title: article.title,
              importance: 50,  // Default to medium if error
              reasoning: 'Error scoring - defaulted to medium',
              topicCategory: 'general',
              isPrimarySubject: false
            };
          }
        })
      );
      
      scoredArticles.push(...results);
      console.log(`   Scored ${Math.min(i + parallelLimit, articles.length)}/${articles.length}`);
    }
    
    // Calculate average importance
    const totalImportance = scoredArticles.reduce((sum, a) => sum + a.importance, 0);
    stats.averageImportance = scoredArticles.length > 0 
      ? Math.round(totalImportance / scoredArticles.length) 
      : 0;
    
    console.log(`   Average importance: ${stats.averageImportance}`);
    
    // Step 3: Sort and determine which need full scoring
    console.log('\n' + '─'.repeat(60));
    console.log('STEP 3: Marking articles visible and selecting for scoring...');
    
    scoredArticles.sort((a, b) => b.importance - a.importance);
    
    const cutoffIndex = Math.ceil(scoredArticles.length * (topPercentile / 100));
    
    for (let i = 0; i < scoredArticles.length; i++) {
      const article = scoredArticles[i];
      
      // Determine if this article should get full multi-agent scoring
      const needsScoring = i < cutoffIndex && article.importance >= minImportanceForScoring;
      
      // Update database
      const { error: updateError } = await supabase
        .from('news_articles')
        .update({
          visible: true,  // ALL articles become visible
          importance_score: article.importance,
          importance_reasoning: article.reasoning,
          story_type: article.topicCategory,
          // If not scoring, mark as processed (won't be picked up by scorer)
          processed: !needsScoring,
          skipped_reason: needsScoring ? null : `Below top ${topPercentile}% (score: ${article.importance})`
        })
        .eq('id', article.id);
      
      if (updateError) {
        console.error(`   ❌ Error updating article ${article.id}:`, updateError);
        stats.errors++;
      } else {
        stats.articlesMarkedVisible++;
        if (needsScoring) {
          stats.articlesMarkedForScoring++;
        } else {
          stats.articlesSkipped++;
        }
      }
    }
    
    // Step 4: Summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ TRIAGE COMPLETE');
    console.log('═'.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Articles processed: ${stats.articlesProcessed}`);
    console.log(`   Marked visible: ${stats.articlesMarkedVisible}`);
    console.log(`   Queued for scoring (top ${topPercentile}%): ${stats.articlesMarkedForScoring}`);
    console.log(`   Skipped (low importance): ${stats.articlesSkipped}`);
    console.log(`   Average importance: ${stats.averageImportance}`);
    console.log(`   Errors: ${stats.errors}`);
    
    if (stats.articlesMarkedForScoring > 0) {
      console.log(`\n🔝 Top articles queued for multi-agent scoring:`);
      scoredArticles
        .slice(0, Math.min(5, stats.articlesMarkedForScoring))
        .forEach((a, i) => {
          console.log(`   ${i + 1}. [${a.importance}] ${a.title.substring(0, 50)}...`);
        });
    }
    
    console.log('═'.repeat(60) + '\n');
    
    return stats;
    
  } catch (error) {
    console.error('❌ Fatal error in article triage:', error);
    throw error;
  }
}

/**
 * Article Triage Job export for cronjob.org integration
 */
export const ArticleTriageJob = {
  run: runArticleTriage,
  
  /**
   * Quick health check
   */
  async getStatus(): Promise<{
    pendingTriage: number;
    pendingScoring: number;
  }> {
    const { count: pendingTriage } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('visible', false);
    
    const { count: pendingScoring } = await supabase
      .from('news_articles')
      .select('*', { count: 'exact', head: true })
      .eq('visible', true)
      .eq('processed', false);
    
    return {
      pendingTriage: pendingTriage || 0,
      pendingScoring: pendingScoring || 0
    };
  }
};

// Allow running from command line
if (import.meta.url === `file://${process.argv[1]}`) {
  runArticleTriage()
    .then(stats => {
      console.log('Job completed:', stats);
      process.exit(0);
    })
    .catch(err => {
      console.error('Job failed:', err);
      process.exit(1);
    });
}

