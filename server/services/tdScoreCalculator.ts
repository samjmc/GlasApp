/**
 * TD Score Calculator Service
 * Automatically calculates and updates all TD scores based on their articles
 * Called whenever articles are added/updated to keep scores in sync
 */

import { supabaseDb } from '../db';

export class TDScoreCalculator {
  /**
   * Recalculate a specific TD's scores from their articles
   * Uses a 3-month sliding window for relevance
   */
  static async recalculateTDScore(politicianName: string): Promise<void> {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    console.log(`📊 Recalculating scores for ${politicianName}...`);

    // Calculate 3-month sliding window (90 days ago)
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const windowStart = threeMonthsAgo.toISOString();

    // Get articles from the last 3 months only
    const { data: articles } = await supabaseDb
      .from('article_td_scores')
      .select('impact_score, created_at')
      .eq('politician_name', politicianName)
      .gte('created_at', windowStart) // Only last 3 months
      .order('created_at', { ascending: false });

    // Calculate News Impact Score
    // Baseline: 50/100
    // Each article's impact_score (-10 to +10) becomes -2 to +2 points (÷5)
    let newsImpactScore = 50; // Default baseline
    
    if (articles && articles.length > 0) {
      const totalImpactDelta = articles.reduce((sum, a) => 
        sum + (Number(a.impact_score) || 0), 0
      ) / 5;
      
      newsImpactScore = Math.round(
        Math.max(0, Math.min(100, 50 + totalImpactDelta))
      );
      
      console.log(`   📰 ${articles.length} articles in 3-month window`);
    } else {
      console.log(`   📰 No articles in 3-month window`);
    }

    // Get current TD data
    const { data: tdData } = await supabaseDb
      .from('td_scores')
      .select('*')
      .ilike('politician_name', politicianName)
      .single();

    if (!tdData) {
      console.warn(`⚠️  TD ${politicianName} not found in td_scores table`);
      return;
    }

    // Calculate component scores
    const parliamentaryScore = tdData.parliamentary_activity_score || 50;
    const consistencyScore = tdData.consistency_score || Math.round(((tdData.consistency_elo || 1500) - 1000) / 10);
    const effectivenessScore = tdData.effectiveness_score || Math.round(((tdData.effectiveness_elo || 1500) - 1000) / 10);
    const constituencyScore = tdData.constituency_service_score || Math.round(((tdData.constituency_service_elo || 1500) - 1000) / 10);

    // Calculate Overall Score: weighted combination
    // News: 30%, Parliamentary: 25%, Consistency: 20%, Effectiveness: 15%, Constituency: 10%
    const overallScore = Math.round(
      (newsImpactScore * 0.30) +
      (parliamentaryScore * 0.25) +
      (consistencyScore * 0.20) +
      (effectivenessScore * 0.15) +
      (constituencyScore * 0.10)
    );

    // Update td_scores table with calculated scores
    const { error: updateError } = await supabaseDb
      .from('td_scores')
      .update({
        news_impact_score: newsImpactScore,
        overall_score: overallScore,
        last_updated: new Date().toISOString()
      })
      .eq('politician_name', politicianName);

    if (updateError) {
      console.error(`❌ Failed to update scores for ${politicianName}:`, updateError);
      throw updateError;
    }

    console.log(`✅ Updated ${politicianName}: News=${newsImpactScore}/100, Overall=${overallScore}/100`);
  }

  /**
   * Recalculate scores for ALL TDs
   * Called after bulk article updates or as a maintenance job
   */
  static async recalculateAllScores(): Promise<void> {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    console.log('📊 Recalculating scores for ALL TDs...');

    // Get all active TDs
    const { data: allTDs, error } = await supabaseDb
      .from('td_scores')
      .select('politician_name')
      .eq('is_active', true);

    if (error) throw error;

    if (!allTDs || allTDs.length === 0) {
      console.log('No active TDs found');
      return;
    }

    console.log(`Found ${allTDs.length} active TDs to recalculate`);

    // Recalculate each TD sequentially
    for (const td of allTDs) {
      try {
        await this.recalculateTDScore(td.politician_name);
      } catch (error) {
        console.error(`Failed to recalculate ${td.politician_name}:`, error);
        // Continue with other TDs even if one fails
      }
    }

    console.log('✅ Finished recalculating all TD scores');
  }

  /**
   * Recalculate scores for TDs affected by a specific article
   * Called automatically after article scoring
   */
  static async recalculateFromArticle(articleId: number): Promise<void> {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    // Get all TDs affected by this article
    const { data: affectedTDs } = await supabaseDb
      .from('article_td_scores')
      .select('politician_name')
      .eq('article_id', articleId);

    if (!affectedTDs || affectedTDs.length === 0) {
      return;
    }

    console.log(`📰 Recalculating scores for ${affectedTDs.length} TDs affected by article #${articleId}`);

    // Get unique TD names
    const uniqueTDs = [...new Set(affectedTDs.map(t => t.politician_name))];

    // Recalculate each affected TD
    for (const tdName of uniqueTDs) {
      await this.recalculateTDScore(tdName);
    }
  }
}

