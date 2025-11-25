/**
 * News to TD Scoring Service
 * Connects news aggregation to TD ELO scoring system
 * 
 * This service:
 * 1. Fetches unprocessed news articles
 * 2. Extracts TD mentions from articles
 * 3. Analyzes impact using AI
 * 4. Updates TD ELO scores
 * 5. Logs score changes to history
 * 6. Triggers party aggregate recalculation
 */

import { supabaseDb as supabase } from '../db.js';
import { TDExtractionService } from './tdExtractionService.js';
import { AINewsAnalysisService, type ArticleAnalysis } from './aiNewsAnalysisService.js';
import { ELOScoringService, type TDScore } from './eloScoringService.js';
import { TDScoreCalculator } from './tdScoreCalculator.js';
import { TDIdeologyProfileService } from './tdIdeologyProfileService.js';

interface ProcessingStats {
  articlesProcessed: number;
  tdsUpdated: number;
  scoresChanged: number;
  errors: number;
  articlesFailed: string[];
}

/**
 * Map policy topic to ideological dimension for personal rankings
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
  
  return 'general'; // Default if can't categorize
}

/**
 * Process unprocessed news articles and update TD scores
 */
export async function processUnprocessedArticles(
  options: {
    batchSize?: number;
    crossCheck?: boolean;
  } = {}
): Promise<ProcessingStats> {
  
  const stats: ProcessingStats = {
    articlesProcessed: 0,
    tdsUpdated: 0,
    scoresChanged: 0,
    errors: 0,
    articlesFailed: []
  };
  
  const batchSize = options.batchSize || 50;
  
  console.log('\n' + '='.repeat(70));
  console.log('📰 NEWS TO TD SCORING SERVICE');
  console.log('='.repeat(70));
  console.log(`Processing up to ${batchSize} unprocessed articles...\n`);
  
  try {
    // Step 1: Fetch unprocessed articles
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
    
    console.log(`📋 Found ${articles.length} unprocessed articles`);
    console.log('-'.repeat(70));
    
    // Step 2: Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`\n[${i + 1}/${articles.length}] Processing: ${article.title.substring(0, 60)}...`);
      
      try {
        await processArticle(article, stats, options.crossCheck);
        stats.articlesProcessed++;
        
        // Mark article as processed
        await supabase
          .from('news_articles')
          .update({ processed: true })
          .eq('id', article.id);
        
      } catch (error) {
        console.error(`   ❌ Failed to process article:`, error);
        stats.errors++;
        stats.articlesFailed.push(article.title);
      }
    }
    
    // Step 3: Recalculate TD overall scores from articles (AUTOMATED)
    if (stats.tdsUpdated > 0) {
      console.log('\n' + '-'.repeat(70));
      console.log('🔄 Recalculating TD scores from articles...');
      await TDScoreCalculator.recalculateAllScores();
      console.log('✅ TD scores recalculated');
    }
    
    // Step 4: Recalculate party aggregates if any TD scores changed
    if (stats.tdsUpdated > 0) {
      console.log('\n' + '-'.repeat(70));
      console.log('🏛️  Recalculating party aggregate scores...');
      await recalculatePartyScores();
      console.log('✅ Party scores updated');
    }
    
    // Step 4: Print summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ PROCESSING COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Statistics:`);
    console.log(`   Articles Processed: ${stats.articlesProcessed}/${articles.length}`);
    console.log(`   TDs Updated: ${stats.tdsUpdated}`);
    console.log(`   Score Changes Logged: ${stats.scoresChanged}`);
    console.log(`   Errors: ${stats.errors}`);
    
    if (stats.articlesFailed.length > 0) {
      console.log(`\n⚠️  Failed articles:`);
      stats.articlesFailed.forEach(title => console.log(`   - ${title}`));
    }
    
    console.log('='.repeat(70) + '\n');
    
    return stats;
    
  } catch (error) {
    console.error('❌ Fatal error in processUnprocessedArticles:', error);
    throw error;
  }
}

/**
 * Process a single article
 */
async function processArticle(
  article: any,
  stats: ProcessingStats,
  crossCheck: boolean = false
): Promise<void> {
  
  // Step 1: Extract TD mentions
  console.log(`   🔍 Extracting TD mentions...`);
  const fullText = `${article.title} ${article.content || ''}`;
  const tdMentions = await TDExtractionService.extractTDMentions(fullText);
  
  if (tdMentions.length === 0) {
    console.log(`   ℹ️  No TD mentions found`);
    return;
  }
  
  // Filter for high confidence mentions only
  const highConfidenceMentions = TDExtractionService.filterHighConfidenceMentions(
    tdMentions,
    0.7
  );
  
  if (highConfidenceMentions.length === 0) {
    console.log(`   ℹ️  No high-confidence TD mentions found`);
    return;
  }
  
  console.log(`   ✅ Found ${highConfidenceMentions.length} TD mention(s):`);
  highConfidenceMentions.forEach(mention => {
    console.log(`      - ${mention.name} (${mention.party}) [${(mention.confidence * 100).toFixed(0)}% confidence]`);
  });
  
  // Step 2: Process each TD mention
  for (const mention of highConfidenceMentions) {
    // Check if this is a substantial mention (not just passing reference)
    if (!TDExtractionService.isSubstantialMention(fullText, mention.name)) {
      console.log(`   ⏭️  Skipping ${mention.name} - only passing mention`);
      continue;
    }
    
    try {
      await processTDMention(article, mention, stats, crossCheck);
    } catch (error) {
      console.error(`   ❌ Error processing ${mention.name}:`, error);
      stats.errors++;
    }
  }
}

/**
 * Process a single TD mention in an article
 */
async function processTDMention(
  article: any,
  tdMention: any,
  stats: ProcessingStats,
  crossCheck: boolean
): Promise<void> {
  
  console.log(`\n   📊 Analyzing impact on ${tdMention.name}...`);
  
  // Step 1: Get current TD scores from database
  const { data: currentTD, error: tdError } = await supabase
    .from('td_scores')
    .select('*')
    .eq('politician_name', tdMention.name)
    .single();
  
  if (tdError || !currentTD) {
    console.log(`   ⚠️  TD not found in database: ${tdMention.name}`);
    return;
  }
  
  // Step 2: Analyze article impact using AI
  const analysis = await AINewsAnalysisService.analyzeArticle(
    article,
    {
      name: tdMention.name,
      constituency: tdMention.constituency,
      party: tdMention.party
    },
    { crossCheck }
  );
  
  console.log(`   📈 Impact Analysis:`);
  console.log(`      Story Type: ${analysis.story_type}`);
  console.log(`      Sentiment: ${analysis.sentiment}`);
  console.log(`      Overall Impact: ${analysis.impact_score}`);
  console.log(`      Confidence: ${(analysis.confidence * 100).toFixed(0)}%`);
  
  // Step 3: Calculate ELO changes
  const currentScores: TDScore = {
    overall_elo: currentTD.overall_elo || 1500,
    transparency_elo: currentTD.transparency_elo || 1500,
    effectiveness_elo: currentTD.effectiveness_elo || 1500,
    integrity_elo: currentTD.integrity_elo || 1500,
    consistency_elo: currentTD.consistency_elo || 1500,
    constituency_service_elo: currentTD.constituency_service_elo || 1500
  };
  
  const articleAge = ELOScoringService.getArticleAge(new Date(article.published_date));
  const credibilityScore = article.credibility_score || 0.8;
  
  const { updated, changes } = ELOScoringService.updateTDScores(
    currentScores,
    analysis,
    credibilityScore,
    articleAge
  );
  
  // Step 4: Update TD scores in database
  if (changes.overall) {
    console.log(`   🎯 ELO Changes:`);
    console.log(`      Overall: ${changes.overall.oldScore} → ${changes.overall.newScore} (${changes.overall.change >= 0 ? '+' : ''}${changes.overall.change})`);
    
    if (changes.transparency) {
      console.log(`      Transparency: ${changes.transparency.change >= 0 ? '+' : ''}${changes.transparency.change}`);
    }
    if (changes.effectiveness) {
      console.log(`      Effectiveness: ${changes.effectiveness.change >= 0 ? '+' : ''}${changes.effectiveness.change}`);
    }
    if (changes.integrity) {
      console.log(`      Integrity: ${changes.integrity.change >= 0 ? '+' : ''}${changes.integrity.change}`);
    }
    if (changes.consistency) {
      console.log(`      Consistency: ${changes.consistency.change >= 0 ? '+' : ''}${changes.consistency.change}`);
    }
    if (changes.constituency_service) {
      console.log(`      Service: ${changes.constituency_service.change >= 0 ? '+' : ''}${changes.constituency_service.change}`);
    }
    
    // Update td_scores table
    const { error: updateError } = await supabase
      .from('td_scores')
      .update({
        overall_elo: updated.overall_elo,
        transparency_elo: updated.transparency_elo,
        effectiveness_elo: updated.effectiveness_elo,
        integrity_elo: updated.integrity_elo,
        consistency_elo: updated.consistency_elo,
        constituency_service_elo: updated.constituency_service_elo,
        total_stories: (currentTD.total_stories || 0) + 1,
        positive_stories: analysis.sentiment.includes('positive')
          ? (currentTD.positive_stories || 0) + 1
          : currentTD.positive_stories || 0,
        negative_stories: analysis.sentiment.includes('negative')
          ? (currentTD.negative_stories || 0) + 1
          : currentTD.negative_stories || 0,
        neutral_stories: analysis.sentiment === 'neutral'
          ? (currentTD.neutral_stories || 0) + 1
          : currentTD.neutral_stories || 0,
        last_updated: new Date().toISOString()
      })
      .eq('id', currentTD.id);
    
    if (updateError) {
      console.error(`   ❌ Error updating TD scores:`, updateError);
      throw updateError;
    }
    
    // Step 5: Log to td_score_history
    const { error: historyError } = await supabase
      .from('td_score_history')
      .insert({
        politician_name: tdMention.name,
        article_id: article.id,
        old_overall_elo: changes.overall.oldScore,
        new_overall_elo: changes.overall.newScore,
        elo_change: changes.overall.change,
        dimension_affected: 'overall',
        impact_score: analysis.impact_score,
        story_type: analysis.story_type,
        article_url: article.url,
        article_title: article.title
      });
    
    if (historyError) {
      console.error(`   ⚠️  Warning: Failed to log history:`, historyError);
      // Don't throw - history logging failure shouldn't stop the process
    }
    
    // Step 6: Update article with TD info and NEUTRAL FACTS
    const { error: articleUpdateError } = await supabase
      .from('news_articles')
      .update({
        politician_name: tdMention.name,
        constituency: tdMention.constituency,
        party: tdMention.party,
        story_type: analysis.story_type,
        sentiment: analysis.sentiment,
        impact_score: analysis.impact_score,
        
        // Legacy dimensional impacts
        transparency_impact: analysis.transparency_impact,
        effectiveness_impact: analysis.effectiveness_impact,
        integrity_impact: analysis.integrity_impact,
        consistency_impact: analysis.consistency_impact,
        constituency_service_impact: analysis.constituency_service_impact,
        
        // NEW: Objective process scores (0-100)
        transparency_score: analysis.transparency_score,
        effectiveness_score: analysis.effectiveness_score,
        integrity_score: analysis.integrity_score,
        consistency_score: analysis.consistency_score,
        
        // NEW: Individual reasoning for each score
        transparency_reasoning: analysis.transparency_reasoning,
        effectiveness_reasoning: analysis.effectiveness_reasoning,
        integrity_reasoning: analysis.integrity_reasoning,
        consistency_reasoning: analysis.consistency_reasoning,
        
        // NEW: Neutral policy facts (for user voting)
        policy_facts: analysis.policy_facts ? JSON.stringify(analysis.policy_facts) : null,
        perspectives: analysis.perspectives ? JSON.stringify(analysis.perspectives) : null,
        is_ideological_policy: analysis.is_ideological_policy || false,
        policy_direction: analysis.policy_direction || null,
        
        // NEW: Opposition advocacy detection (LLM determined)
        is_opposition_advocacy: analysis.is_opposition_advocacy || false,
        
        // NEW: Human review flags (flip-flop detection)
        needs_review: analysis.historical_context?.needsHumanReview || false,
        
        ai_summary: analysis.summary,
        ai_reasoning: analysis.reasoning,
        key_quotes: analysis.key_quotes?.join(' | ') || null,
        credibility_score: credibilityScore,
        analyzed_by: analysis.analyzed_by,
        cross_checked: analysis.analyzed_by === 'both',
        score_applied: true
      })
      .eq('id', article.id);
    
    if (articleUpdateError) {
      console.error(`   ⚠️  Warning: Failed to update article:`, articleUpdateError);
    }
    
    // Step 7: ALSO save to article_td_scores junction table (for multiple TDs per article)
    const { error: junctionError } = await supabase
      .from('article_td_scores')
      .upsert({
        article_id: article.id,
        politician_name: tdMention.name,
        transparency_score: analysis.transparency_score,
        integrity_score: analysis.integrity_score,
        effectiveness_score: analysis.effectiveness_score,
        consistency_score: analysis.consistency_score,
        transparency_reasoning: analysis.transparency_reasoning,
        effectiveness_reasoning: analysis.effectiveness_reasoning,
        integrity_reasoning: analysis.integrity_reasoning,
        consistency_reasoning: analysis.consistency_reasoning,
        impact_score: analysis.impact_score,
        story_type: analysis.story_type,
        sentiment: analysis.sentiment,
        flip_flop_detected: analysis.historical_context?.flipFlopSeverity || 'none',
        flip_flop_explanation: analysis.historical_context?.flipFlopDetails,
        suspicious_timing: analysis.historical_context?.suspiciousTiming || false,
        needs_review: analysis.historical_context?.needsHumanReview || false,
        old_overall_elo: changes.overall.oldScore,
        new_overall_elo: changes.overall.newScore,
        elo_change: changes.overall.change,
        ai_reasoning: analysis.reasoning,
        is_opposition_advocacy: analysis.is_opposition_advocacy || false,
        analyzed_by: analysis.analyzed_by
      }, { 
        onConflict: 'article_id,politician_name'
      });
    
    if (junctionError) {
      console.error(`   ⚠️  Warning: Failed to save to article_td_scores:`, junctionError);
    }
    
    // Step 8: Save TD policy stance for personal rankings
    if (analysis.td_policy_stance && analysis.td_policy_stance.stance !== 'unclear') {
      const { error: stanceError } = await supabase
        .from('td_policy_stances')
        .upsert({
          article_id: article.id,
          politician_name: tdMention.name,
          stance: analysis.td_policy_stance.stance,
          stance_strength: analysis.td_policy_stance.strength,
          evidence: analysis.td_policy_stance.evidence,
          policy_topic: analysis.td_policy_stance.policy_topic,
          policy_dimension: mapPolicyToDimension(analysis.td_policy_stance.policy_topic)
        }, {
          onConflict: 'article_id,politician_name'
        });
      
      if (stanceError) {
        console.error(`   ⚠️  Warning: Failed to save TD policy stance:`, stanceError);
      }
      
      // NEW: Update TD ideology profiles if ideology_delta detected (WITH ENHANCEMENTS)
      if (analysis.td_policy_stance.ideology_delta) {
        console.log(`   🧭 Updating ${tdMention.name}'s ideology profile from policy stance...`);
        
        // Import enhancement functions
        const {
          calculateEnhancedArticleWeight,
          applyIssueSalienceWeighting,
          checkArticleConsistency,
        } = await import('./articleIdeologyEnhancements.js');
        
        // Step 1: Determine source reliability
        const sourceUrl = article.url?.toLowerCase() || '';
        let sourceReliability = 0.7;
        if (sourceUrl.includes('rte.ie') || sourceUrl.includes('oireachtas.ie')) {
          sourceReliability = 0.9;
        } else if (sourceUrl.includes('irishtimes.com') || sourceUrl.includes('independent.ie')) {
          sourceReliability = 0.85;
        } else if (sourceUrl.includes('thejournal.ie') || sourceUrl.includes('examiner.ie')) {
          sourceReliability = 0.75;
        } else if (sourceUrl.includes('twitter.com') || sourceUrl.includes('facebook.com')) {
          sourceReliability = 0.3; // Social media
        }
        
        // Step 2: Base weight calculation
        const baseWeight = (analysis.td_policy_stance.strength / 5) * (analysis.confidence || 0.8) * sourceReliability;
        
        // Step 3: Apply political science enhancements
        const { effectiveWeight, adjustments } = await calculateEnhancedArticleWeight(
          tdMention.name,
          tdMention.party,
          tdMention.role,
          {
            stance: analysis.td_policy_stance.stance,
            strength: analysis.td_policy_stance.strength,
            policy_topic: analysis.td_policy_stance.policy_topic,
            is_opposition_advocacy: analysis.is_opposition_advocacy,
            is_ideological_policy: analysis.is_ideological_policy,
            speech_classification: analysis.speech_classification,
          },
          baseWeight,
        );
        
        // Step 4: Apply issue salience weighting per dimension
        const salienceAdjustedDeltas = applyIssueSalienceWeighting(
          analysis.td_policy_stance.ideology_delta,
          analysis.td_policy_stance.policy_topic,
        );
        
        // Step 5: Check for consistency with previous statements
        const consistencyCheck = await checkArticleConsistency(
          tdMention.name,
          analysis.td_policy_stance.policy_topic,
          salienceAdjustedDeltas,
          article.published_at || new Date(),
        );
        
        let finalWeight = effectiveWeight;
        if (consistencyCheck.hasContradiction) {
          finalWeight *= consistencyCheck.penalty;
        }
        
        // Step 6: Apply ideology adjustments with enhanced weight
        await TDIdeologyProfileService.applyAdjustments(
          tdMention.name,
          salienceAdjustedDeltas,
          {
            sourceType: 'article',
            sourceId: article.id,
            policyTopic: analysis.td_policy_stance.policy_topic,
            weight: finalWeight,
            confidence: analysis.confidence || 0.8,
            sourceDate: article.published_at || new Date(),
            sourceReliability,
          }
        );
        console.log(`   ✅ Ideology profile updated (final weight: ${finalWeight.toFixed(3)})`);
      }
    }
    
    stats.tdsUpdated++;
    stats.scoresChanged++;
    
    console.log(`   ✅ Score update saved successfully`);
  } else {
    console.log(`   ℹ️  No score change (impact too small)`);
  }
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
  articleId: number,
  crossCheck: boolean = false
): Promise<void> {
  
  const { data: article, error } = await supabase
    .from('news_articles')
    .select('*')
    .eq('id', articleId)
    .single();
  
  if (error || !article) {
    throw new Error(`Article not found: ${articleId}`);
  }
  
  const stats: ProcessingStats = {
    articlesProcessed: 0,
    tdsUpdated: 0,
    scoresChanged: 0,
    errors: 0,
    articlesFailed: []
  };
  
  await processArticle(article, stats, crossCheck);
  
  // Mark as processed
  await supabase
    .from('news_articles')
    .update({ processed: true })
    .eq('id', articleId);
  
  console.log(`\n✅ Article processed. TD updates: ${stats.tdsUpdated}`);
}

export const NewsToTDScoringService = {
  processUnprocessedArticles,
  processArticleById
};

