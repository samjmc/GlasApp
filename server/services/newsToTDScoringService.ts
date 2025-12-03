/**
 * News to TD Scoring Service (v3 - Multi-Agent with Event Deduplication)
 * 
 * Connects news aggregation to TD ELO scoring system using:
 * 1. Importance filtering (top 25% of articles)
 * 2. Event deduplication (clusters same-story articles, picks best)
 * 3. Multi-agent scoring team (no single-LLM scoring)
 * 
 * Pipeline:
 * 1. Fetch unprocessed news articles
 * 2. Score article importance (cheap LLM triage)
 * 3. Select top 25% most important articles
 * 4. Cluster articles by event, select canonical article per event
 * 5. Extract TD mentions from selected articles
 * 6. Run multi-agent scoring team on unique events
 * 7. Update TD ELO scores AND ideology profiles
 * 8. Log score changes to history
 * 9. Trigger party aggregate recalculation
 */

import { supabaseDb as supabase } from '../db.js';
import { TDExtractionService } from './tdExtractionService.js';
import { ArticleImportanceService } from './articleImportanceService.js';
import { EventDeduplicationService } from './eventDeduplicationService.js';
import { NewsArticleScoringTeam } from './multiAgentTDScoring.js';
import { TDScoreCalculator } from './tdScoreCalculator.js';
import { PolicyOpportunityService } from './policyOpportunityService.js';

interface ProcessingStats {
  totalArticles: number;
  importanceScored: number;
  selectedForScoring: number;
  skippedLowImportance: number;
  // Deduplication stats
  clustersFound: number;
  duplicatesRemoved: number;
  uniqueEventsToScore: number;
  // Processing stats
  articlesProcessed: number;
  tdsUpdated: number;
  scoresChanged: number;
  errors: number;
  articlesFailed: string[];
}

interface ProcessingOptions {
  batchSize?: number;
  topPercentile?: number;    // Default 25 = top 25%
  minImportanceScore?: number;  // Default 40
}

/**
 * Process unprocessed news articles with importance filtering and multi-agent scoring
 */
export async function processUnprocessedArticles(
  options: ProcessingOptions = {}
): Promise<ProcessingStats> {
  
  const stats: ProcessingStats = {
    totalArticles: 0,
    importanceScored: 0,
    selectedForScoring: 0,
    skippedLowImportance: 0,
    // Deduplication stats
    clustersFound: 0,
    duplicatesRemoved: 0,
    uniqueEventsToScore: 0,
    // Processing stats
    articlesProcessed: 0,
    tdsUpdated: 0,
    scoresChanged: 0,
    errors: 0,
    articlesFailed: []
  };
  
  const batchSize = options.batchSize || 50;
  const topPercentile = options.topPercentile || 25;
  const minImportanceScore = options.minImportanceScore || 40;
  
  console.log('\n' + '═'.repeat(70));
  console.log('📰 NEWS TO TD SCORING SERVICE (v2 - Multi-Agent)');
  console.log('═'.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   Batch Size: ${batchSize}`);
  console.log(`   Top Percentile: ${topPercentile}%`);
  console.log(`   Min Importance Score: ${minImportanceScore}`);
  console.log(`   Scoring Method: Multi-Agent Team (6-8 LLM calls per article)`);
  
  try {
    // Step 1: Fetch unprocessed articles
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 1: Fetching unprocessed articles...');
    
    const { data: articles, error: fetchError } = await supabase
      .from('news_articles')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(batchSize);
    
    if (fetchError) {
      console.error('❌ Error fetching articles:', fetchError);
      return stats;
    }
    
    if (!articles || articles.length === 0) {
      console.log('✅ No unprocessed articles found - all caught up!');
      return stats;
    }
    
    stats.totalArticles = articles.length;
    console.log(`   Found ${articles.length} unprocessed articles`);
    
    // Step 2: Score article importance (cheap LLM triage)
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 2: Scoring article importance...');
    
    const { topArticles, skippedArticles, stats: importanceStats } = 
      await ArticleImportanceService.batchScoreAndRank(articles, {
        topPercentile,
        minScore: minImportanceScore,
        parallelLimit: 5
      });
    
    stats.importanceScored = importanceStats.scored;
    stats.selectedForScoring = topArticles.length;
    stats.skippedLowImportance = skippedArticles.length;
    
    // Step 3: Mark skipped articles as processed (but not scored)
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 3: Marking low-importance articles as processed...');
    
    for (const { article, importance } of skippedArticles) {
      await supabase
        .from('news_articles')
        .update({ 
          processed: true,
          score_applied: false,
          importance_score: importance.score,
          importance_reasoning: importance.reasoning,
          skipped_reason: `Below ${topPercentile}th percentile (score: ${importance.score})`
        })
        .eq('id', article.id);
    }
    console.log(`   Marked ${skippedArticles.length} articles as skipped`);
    
    if (topArticles.length === 0) {
      console.log('\n⚠️ No articles met importance threshold - nothing to score');
      return stats;
    }
    
    // Step 4: Event deduplication - cluster articles and select canonical articles
    console.log('\n' + '─'.repeat(70));
    console.log('STEP 4: Event deduplication (clustering same-story articles)...');
    
    // Prepare articles with importance scores for clustering
    const articlesForClustering = topArticles.map(({ article, importance }) => ({
      id: article.id,
      title: article.title,
      content: article.content || '',
      source: article.source,
      published_date: article.published_date,
      importance_score: importance.score
    }));
    
    const deduplicationResult = await EventDeduplicationService.clusterAndDeduplicate(
      articlesForClustering
    );
    
    stats.clustersFound = deduplicationResult.stats.clustersFound;
    stats.duplicatesRemoved = deduplicationResult.stats.duplicatesRemoved;
    stats.uniqueEventsToScore = deduplicationResult.stats.outputCount;
    
    // Mark duplicate articles as processed (but not scored)
    const selectedIds = new Set(deduplicationResult.selectedArticles.map(a => a.id));
    const duplicateArticles = topArticles.filter(({ article }) => !selectedIds.has(article.id));
    
    for (const { article, importance } of duplicateArticles) {
      const cluster = deduplicationResult.clusters.find(c => c.articles.includes(article.id));
      const canonicalId = cluster?.selectedArticleId;
      
      await supabase
        .from('news_articles')
        .update({ 
          processed: true,
          score_applied: false,
          importance_score: importance.score,
          importance_reasoning: importance.reasoning,
          skipped_reason: `Duplicate of article ${canonicalId} (same event: ${cluster?.eventName || 'unknown'})`
        })
        .eq('id', article.id);
    }
    
    if (duplicateArticles.length > 0) {
      console.log(`   Marked ${duplicateArticles.length} duplicate articles as skipped`);
    }
    
    // Get the canonical articles to process
    const canonicalArticles = topArticles.filter(({ article }) => selectedIds.has(article.id));
    
    if (canonicalArticles.length === 0) {
      console.log('\n⚠️ No unique events to score after deduplication');
      return stats;
    }
    
    // Step 5: Process canonical articles with multi-agent team
    console.log('\n' + '─'.repeat(70));
    console.log(`STEP 5: Multi-agent scoring of ${canonicalArticles.length} unique events...`);
    console.log('─'.repeat(70));
    
    for (let i = 0; i < canonicalArticles.length; i++) {
      const { article, importance } = canonicalArticles[i];
      
      console.log(`\n[${i + 1}/${canonicalArticles.length}] Processing: ${article.title.substring(0, 50)}...`);
      console.log(`   Importance: ${importance.score} (${importance.topicCategory})`);
      
      try {
        await processArticleWithMultiAgent(article, importance, stats);
        stats.articlesProcessed++;
        
      } catch (error) {
        console.error(`   ❌ Failed to process article:`, error);
        stats.errors++;
        stats.articlesFailed.push(article.title);
        
        // Still mark as processed to avoid infinite retries
        await supabase
          .from('news_articles')
          .update({ 
            processed: true,
            score_applied: false,
            error_message: String(error)
          })
          .eq('id', article.id);
      }
    }
    
    // Step 6: Recalculate TD overall scores
    if (stats.tdsUpdated > 0) {
      console.log('\n' + '─'.repeat(70));
      console.log('STEP 6: Recalculating TD scores from articles...');
      await TDScoreCalculator.recalculateAllScores();
      console.log('✅ TD scores recalculated');
    }
    
    // Step 7: Recalculate party aggregates
    if (stats.tdsUpdated > 0) {
      console.log('\n' + '─'.repeat(70));
      console.log('STEP 7: Recalculating party aggregate scores...');
      await recalculatePartyScores();
      console.log('✅ Party scores updated');
    }
    
    // Summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ PROCESSING COMPLETE');
    console.log('═'.repeat(70));
    console.log(`📊 Statistics:`);
    console.log(`   Total Articles: ${stats.totalArticles}`);
    console.log(`   Importance Scored: ${stats.importanceScored}`);
    console.log(`   Selected for Multi-Agent (top ${topPercentile}%): ${stats.selectedForScoring}`);
    console.log(`   Skipped (low importance): ${stats.skippedLowImportance}`);
    console.log(`\n   🔗 Deduplication:`);
    console.log(`   Event Clusters Found: ${stats.clustersFound}`);
    console.log(`   Duplicates Removed: ${stats.duplicatesRemoved}`);
    console.log(`   Unique Events Scored: ${stats.uniqueEventsToScore}`);
    console.log(`\n   📝 Results:`);
    console.log(`   Successfully Processed: ${stats.articlesProcessed}`);
    console.log(`   TDs Updated: ${stats.tdsUpdated}`);
    console.log(`   Score Changes Logged: ${stats.scoresChanged}`);
    console.log(`   Errors: ${stats.errors}`);
    
    if (stats.articlesFailed.length > 0) {
      console.log(`\n⚠️  Failed articles:`);
      stats.articlesFailed.forEach(title => console.log(`   - ${title}`));
    }
    
    console.log('═'.repeat(70) + '\n');
    
    return stats;
    
  } catch (error) {
    console.error('❌ Fatal error in processUnprocessedArticles:', error);
    throw error;
  }
}

/**
 * Process a single article using multi-agent scoring team
 */
async function processArticleWithMultiAgent(
  article: any,
  importance: { score: number; politiciansMentioned: string[]; topicCategory: string; isPrimarySubject: boolean; reasoning: string },
  stats: ProcessingStats
): Promise<void> {
  
  // Step 1: Extract TD mentions (verify and get full details)
  console.log(`   🔍 Extracting TD mentions...`);
  const fullText = `${article.title} ${article.content || ''}`;
  const tdMentions = await TDExtractionService.extractTDMentions(fullText);
  
  // Filter for high confidence mentions
  const highConfidenceMentions = TDExtractionService.filterHighConfidenceMentions(
    tdMentions,
    0.7
  );
  
  if (highConfidenceMentions.length === 0) {
    console.log(`   ℹ️ No high-confidence TD mentions found`);
    await markArticleProcessed(article.id, importance, null, false);
    return;
  }
  
  console.log(`   ✅ Found ${highConfidenceMentions.length} TD mention(s):`);
  highConfidenceMentions.forEach(mention => {
    console.log(`      - ${mention.name} (${mention.party}) [${(mention.confidence * 100).toFixed(0)}%]`);
  });
  
  // Step 2: Process each substantial TD mention
  for (const mention of highConfidenceMentions) {
    // Check if this is a substantial mention
    if (!TDExtractionService.isSubstantialMention(fullText, mention.name)) {
      console.log(`   ⏭️ Skipping ${mention.name} - only passing mention`);
      continue;
    }
    
    try {
      await processTDWithMultiAgent(article, mention, importance, stats);
    } catch (error) {
      console.error(`   ❌ Error processing ${mention.name}:`, error);
      stats.errors++;
    }
  }
  
  // Mark article as processed
  await markArticleProcessed(article.id, importance, highConfidenceMentions[0], true);
}

/**
 * Process a single TD mention using multi-agent scoring
 */
async function processTDWithMultiAgent(
  article: any,
  tdMention: { name: string; party: string; constituency: string; confidence: number },
  importance: { score: number; topicCategory: string },
  stats: ProcessingStats
): Promise<void> {
  
  console.log(`\n   🎯 Multi-agent scoring for ${tdMention.name}...`);
  
  // Determine if TD is in government
  const governmentParties = ['Fine Gael', 'Fianna Fáil', 'Green Party'];
  const isGovernment = governmentParties.includes(tdMention.party);
  
  // Run multi-agent scoring team
  const multiAgentResult = await NewsArticleScoringTeam.runTeamScoring(
    {
      id: article.id,
      title: article.title,
      content: article.content || '',
      source: article.source
    },
    {
      name: tdMention.name,
      party: tdMention.party,
      constituency: tdMention.constituency,
      isGovernment
    },
    `Importance: ${importance.score} (${importance.topicCategory})`
  );
  
  // Apply process scores to ELO (transparency, integrity, etc.)
  await NewsArticleScoringTeam.applyProcessScoresToELO(
    multiAgentResult,
    {
      id: article.id,
      published_date: article.published_date,
      url: article.url,
      title: article.title
    },
    { name: tdMention.name },
    article.credibility_score || 0.8
  );
  
  // Apply ideology to profile (with data science enhancements)
  await NewsArticleScoringTeam.applyIdeologyToProfile(
    multiAgentResult,
    {
      id: article.id,
      published_date: article.published_date,
      source: article.source
    },
    { name: tdMention.name }
  );
  
  // Save to article_td_scores junction table
  const converted = NewsArticleScoringTeam.convertToArticleAnalysis(multiAgentResult);
  
  await supabase
    .from('article_td_scores')
    .upsert({
      article_id: article.id,
      politician_name: tdMention.name,
      transparency_score: converted.transparency_score,
      integrity_score: converted.integrity_score,
      effectiveness_score: converted.effectiveness_score,
      consistency_score: converted.consistency_score,
      impact_score: converted.impact_score,
      story_type: importance.topicCategory,
      sentiment: converted.impact_score > 2 ? 'positive' : converted.impact_score < -2 ? 'negative' : 'neutral',
      needs_review: converted.needs_review,
      ai_reasoning: converted.ai_reasoning,
      analyzed_by: converted.analyzed_by,
      // Ideology data
      is_ideological_policy: converted.is_ideological_policy,
      policy_direction: converted.policy_direction
    }, { 
      onConflict: 'article_id,politician_name'
    });
  
  // Save TD policy stance if present
  if (converted.td_policy_stance) {
    await supabase
      .from('td_policy_stances')
      .upsert({
        article_id: article.id,
        politician_name: tdMention.name,
        stance: converted.td_policy_stance.stance,
        stance_strength: converted.td_policy_stance.strength,
        evidence: converted.td_policy_stance.evidence,
        policy_topic: converted.td_policy_stance.policy_topic,
        policy_dimension: mapPolicyToDimension(converted.td_policy_stance.policy_topic)
      }, {
        onConflict: 'article_id,politician_name'
      });
  }
  
  stats.tdsUpdated++;
  stats.scoresChanged++;
  
  console.log(`   ✅ ${tdMention.name} scored and updated`);
  
  // Generate policy vote opportunity (only for multi-agent scored articles)
  if (converted.is_ideological_policy && converted.td_policy_stance) {
    console.log(`   🗳️ Generating policy vote opportunity...`);
    try {
      const created = await PolicyOpportunityService.generateAndSave(
        article.id,
        {
          title: article.title,
          content: article.content || '',
          source: article.source || 'Unknown',
          published_date: article.published_date ? new Date(article.published_date) : new Date()
        }
      );
      if (created) {
        console.log(`   ✅ Policy vote opportunity created`);
      } else {
        console.log(`   ℹ️ No policy vote opportunity created (not suitable)`);
      }
    } catch (error) {
      console.error(`   ⚠️ Failed to create policy vote opportunity:`, error);
    }
  }
}

/**
 * Mark article as processed
 */
async function markArticleProcessed(
  articleId: number,
  importance: { score: number; reasoning: string },
  primaryTD: { name: string; party: string; constituency: string } | null,
  scoreApplied: boolean
): Promise<void> {
  
  const updateData: any = {
    processed: true,
    score_applied: scoreApplied,
    importance_score: importance.score,
    importance_reasoning: importance.reasoning,
    analyzed_by: scoreApplied ? 'multi-agent' : null
  };
  
  if (primaryTD) {
    updateData.politician_name = primaryTD.name;
    updateData.party = primaryTD.party;
    updateData.constituency = primaryTD.constituency;
  }
  
  await supabase
    .from('news_articles')
    .update(updateData)
    .eq('id', articleId);
}

/**
 * Map policy topic to ideological dimension
 */
function mapPolicyToDimension(policyTopic: string): string {
  const topic = policyTopic.toLowerCase();
  
  if (topic.includes('immigration') || topic.includes('asylum') || topic.includes('refugee') || topic.includes('ipas')) {
    return 'immigration';
  }
  if (topic.includes('health') || topic.includes('hospital') || topic.includes('medical')) {
    return 'healthcare';
  }
  if (topic.includes('housing') || topic.includes('rent') || topic.includes('homeless')) {
    return 'housing';
  }
  if (topic.includes('tax') || topic.includes('budget') || topic.includes('economy') || topic.includes('business')) {
    return 'economy';
  }
  if (topic.includes('climate') || topic.includes('environment') || topic.includes('green')) {
    return 'environment';
  }
  if (topic.includes('welfare') || topic.includes('social') || topic.includes('benefit')) {
    return 'social_issues';
  }
  if (topic.includes('crime') || topic.includes('police') || topic.includes('justice') || topic.includes('court')) {
    return 'justice';
  }
  if (topic.includes('education') || topic.includes('school') || topic.includes('university')) {
    return 'education';
  }
  
  return 'general';
}

/**
 * Recalculate party aggregate scores
 */
async function recalculatePartyScores(): Promise<void> {
  try {
    // Get all active TDs grouped by party
    const { data: tds } = await supabase
      .from('td_scores')
      .select('party, overall_elo, transparency_elo, effectiveness_elo, integrity_elo, consistency_elo, constituency_service_elo')
      .eq('is_active', true)
      .not('party', 'is', null);
    
    if (!tds || tds.length === 0) {
      return;
    }
    
    // Group by party
    const partyGroups = new Map<string, any[]>();
    for (const td of tds) {
      if (!partyGroups.has(td.party)) {
        partyGroups.set(td.party, []);
      }
      partyGroups.get(td.party)!.push(td);
    }
    
    // Calculate averages for each party
    for (const [partyName, partyTDs] of partyGroups) {
      const avgOverallElo = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.overall_elo || 1500), 0) / partyTDs.length
      );
      
      const avgTransparency = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.transparency_elo || 1500), 0) / partyTDs.length
      );
      
      const avgEffectiveness = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.effectiveness_elo || 1500), 0) / partyTDs.length
      );
      
      const avgIntegrity = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.integrity_elo || 1500), 0) / partyTDs.length
      );
      
      const avgConsistency = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.consistency_elo || 1500), 0) / partyTDs.length
      );
      
      const avgService = Math.round(
        partyTDs.reduce((sum, td) => sum + (td.constituency_service_elo || 1500), 0) / partyTDs.length
      );
      
      // Get party ID
      const { data: party } = await supabase
        .from('parties')
        .select('id')
        .eq('name', partyName)
        .single();
      
      if (!party) continue;
      
      // Check if score record exists
      const { data: existingScore } = await supabase
        .from('party_performance_scores')
        .select('id')
        .eq('party_id', party.id)
        .eq('score_type', 'news_impact')
        .single();
      
      const scoreData = {
        party_id: party.id,
        score_type: 'news_impact',
        overall_score: avgOverallElo,
        transparency_score: avgTransparency,
        integrity_score: avgIntegrity,
        policy_consistency_score: avgConsistency,
        public_accountability_score: avgService,
        pledge_fulfillment_score: avgEffectiveness,
        calculated_at: new Date().toISOString()
      };
      
      if (existingScore) {
        await supabase
          .from('party_performance_scores')
          .update(scoreData)
          .eq('id', existingScore.id);
      } else {
        await supabase
          .from('party_performance_scores')
          .insert(scoreData);
      }
      
      console.log(`   ✅ ${partyName}: Overall ELO ${avgOverallElo} (${partyTDs.length} TDs)`);
    }
    
  } catch (error) {
    console.error('   ❌ Error recalculating party scores:', error);
  }
}

/**
 * Process a specific article by ID (for manual testing)
 */
export async function processArticleById(
  articleId: number
): Promise<void> {
  
  const { data: article, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('id', articleId)
    .single();
  
  if (error || !article) {
    throw new Error(`Article not found: ${articleId}`);
  }
  
  // Score importance
  const importance = await ArticleImportanceService.scoreArticleImportance(article);
  
  console.log(`\n📰 Processing article ${articleId}: "${article.title}"`);
  console.log(`   Importance: ${importance.score} (${importance.topicCategory})`);
  
  const stats: ProcessingStats = {
    totalArticles: 1,
    importanceScored: 1,
    selectedForScoring: 1,
    skippedLowImportance: 0,
    articlesProcessed: 0,
    tdsUpdated: 0,
    scoresChanged: 0,
    errors: 0,
    articlesFailed: []
  };
  
  await processArticleWithMultiAgent(article, importance, stats);
  
  console.log(`\n✅ Article processed. TDs updated: ${stats.tdsUpdated}`);
}

export const NewsToTDScoringService = {
  processUnprocessedArticles,
  processArticleById
};
