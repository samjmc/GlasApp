/**
 * Consolidated Parliamentary Scores Routes
 * Handles all TD (Teachta Dála - Irish MP) scoring and performance tracking:
 * - TD ELO scores from news analysis
 * - Unified scoring system
 * - Performance scores
 * - Trust scores
 * - Top performers by questions
 * 
 * Consolidated from:
 * - tdScoresRoutes.ts
 * - unifiedTDScoresRoutes.ts
 * - performanceScoresRoutes.ts
 * - trustScoresRoutes.ts
 * - topTDsRoutes.ts
 */

import { Router, Request, Response } from 'express';
import { db, supabaseDb } from '../../db';
import { performanceScores } from '@shared/schema';
import { eq, desc, asc, sql } from 'drizzle-orm';
import { DailyNewsScraperJob } from '../../jobs/dailyNewsScraper';
import { UnifiedTDScoringService } from '../../services/unifiedTDScoringService';
import { convertELOToPercentage } from '../../utils/scoreConverter';
import fs from 'fs';
import path from 'path';
import { IDEOLOGY_DIMENSIONS, emptyIdeologyVector } from '../../constants/ideology.js';

const router = Router();

const convertToPercentage = (value: unknown, fallback = 50): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Math.round(fallback);

  // Treat 0-1 range as already normalised ratio
  if (numeric >= 0 && numeric <= 1) {
    return Math.round(Math.max(0, Math.min(100, numeric * 100)));
  }

  // Treat ELO-style values (typically 1000-2000) as percentage
  if (numeric > 200) {
    return Math.round(
      Math.max(0, Math.min(100, (numeric - 1000) / 10))
    );
  }

  return Math.round(Math.max(0, Math.min(100, numeric)));
};

type WeightedScoreInput = {
  score: number;
  weight: number;
};

const weightedAverage = (items: WeightedScoreInput[], fallback = 50): number => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return Math.round(fallback);
  const scoreSum = items.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round(scoreSum / totalWeight);
};

const serializeBreakdown = (
  entries: Array<WeightedScoreInput & { label: string; detail?: string }>
) => entries.map(entry => ({
  label: entry.label,
  score: Math.round(entry.score),
  weight: entry.weight,
  weight_percent: Math.round(entry.weight * 100),
  detail: entry.detail ?? null
}));

// ============================================
// TD ELO Scores (News-based scoring)
// From tdScoresRoutes.ts
// ============================================

/**
 * GET /api/parliamentary/scores/widget - Get data for homepage widget
 * Returns top performers, biggest movers, bottom performers, and stats
 */
router.get('/widget', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    // Get all ACTIVE TDs from td_scores table, sorted by ELO
    const { data: allTDs, error } = await supabaseDb
      .from('td_scores')
      .select('*')
      .eq('is_active', true)
      .order('overall_elo', { ascending: false });
    
    if (error) throw error;
    
    const validTDs = allTDs || [];
    
    // Debug logging
    console.log(`Widget: Retrieved ${validTDs.length} TDs from database`);
    if (validTDs.length > 0) {
      console.log(`Sample TD:`, {
        name: validTDs[0].politician_name,
        elo: validTDs[0].overall_elo,
        party: validTDs[0].party
      });
    }
    
    // Top 5 performers
    const topPerformers = validTDs.slice(0, 5).map((td, idx) => ({
      id: td.id,
      name: td.politician_name,
      constituency: td.constituency || 'Unknown',
      party: td.party || 'Unknown',
      image_url: td.image_url,
      overall_elo: td.overall_elo || 1500,
      overall_score: convertELOToPercentage(td.overall_elo || 1500),
      score: convertELOToPercentage(td.overall_elo || 1500),
      rank: idx + 1,
      baseline_modifier: td.baseline_modifier || 1.00
    }));
    
    // Bottom 5 performers
    const bottomPerformers = validTDs.slice(-5).reverse().map((td, idx) => ({
      id: td.id,
      name: td.politician_name,
      constituency: td.constituency || 'Unknown',
      party: td.party || 'Unknown',
      image_url: td.image_url,
      overall_elo: td.overall_elo || 1400,
      overall_score: convertELOToPercentage(td.overall_elo || 1400),
      score: convertELOToPercentage(td.overall_elo || 1400),
      rank: validTDs.length - idx,
      baseline_modifier: td.baseline_modifier || 1.00
    }));
    
    // Biggest movers - Calculate from td_score_history (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentChanges } = await supabaseDb
      .from('td_score_history')
      .select('politician_name, elo_change, article_title, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });
    
    // Aggregate changes by politician
    const changesByPolitician = new Map<string, { totalChange: number; articles: string[] }>();
    
    (recentChanges || []).forEach((change: any) => {
      const existing = changesByPolitician.get(change.politician_name) || { totalChange: 0, articles: [] };
      existing.totalChange += change.elo_change || 0;
      if (change.article_title && !existing.articles.includes(change.article_title)) {
        existing.articles.push(change.article_title);
      }
      changesByPolitician.set(change.politician_name, existing);
    });
    
    // Get TDs with biggest absolute changes
    const moversArray = Array.from(changesByPolitician.entries())
      .map(([name, data]) => {
        const td = validTDs.find(t => t.politician_name === name);
        const currentELO = td?.overall_elo || 1500;
        const previousELO = currentELO - data.totalChange;
        
        // Convert ELO change to /100 scale change (preserve decimals)
        const currentScoreUnrounded = (currentELO - 1000) / 10;
        const previousScoreUnrounded = (previousELO - 1000) / 10;
        const scoreChange = currentScoreUnrounded - previousScoreUnrounded;
        const currentScore = Math.round(currentScoreUnrounded);
        
        return {
          id: td?.id,
          name,
          image_url: td?.image_url,
          change: data.totalChange,  // Keep raw ELO for backend reference
          change_out_of_100: parseFloat(scoreChange.toFixed(1)),  // /100 scale with 1 decimal
          overall_elo: currentELO,
          overall_score: currentScore,
          score: currentScore,
          party: td?.party || 'Unknown',
          reason: data.totalChange > 0 
            ? `Positive news coverage (${data.articles.length} ${data.articles.length === 1 ? 'article' : 'articles'})` 
            : `Negative news coverage (${data.articles.length} ${data.articles.length === 1 ? 'article' : 'articles'})`,
          articles: data.articles.length
        };
      })
      .sort((a, b) => Math.abs(b.change_out_of_100) - Math.abs(a.change_out_of_100))
      .slice(0, 6);  // Top 6 biggest movers
    
    const biggestMovers = moversArray;
    
    // Stats
    const totalArticles = validTDs.reduce((sum, td) => sum + (td.total_stories || 0), 0);
    
    // Get news count from database
    let newsCount = totalArticles;
      try {
        const { count } = await supabaseDb
          .from('news_articles')
          .select('*', { count: 'exact', head: true });
        if (count) newsCount = count;
      } catch (e) {
        // Use fallback
    }
    
    res.json({
      success: true,
      top_performers: topPerformers,
      bottom_performers: bottomPerformers,
      biggest_movers: biggestMovers,
      stats: {
        total_tds: validTDs.length,  // Count of active TDs
        articles_analyzed: newsCount,
        last_update: new Date().toISOString(),
        sources_active: 11  // Updated to 11 sources!
      }
    });
  } catch (error) {
    console.error('Widget endpoint error:', error);
    // Return empty data if database fails
    res.json({
      success: true,
      top_performers: [],
      bottom_performers: [],
      biggest_movers: [],
      stats: {
        total_tds: 200,
        articles_analyzed: 0,
        last_update: new Date().toISOString(),
        sources_active: 11
      }
    });
  }
});

/**
 * GET /api/parliamentary/scores/all - Get all TD scores (unified 0-100 format)
 */
router.get('/all', async (req, res, next) => {
  try {
    // Get all TDs with unified scores
    const allTDs = await UnifiedTDScoringService.getTopTDs(200); // Get all TDs
    
    // Return in consistent 0-100 format
    res.json({
      success: true,
      scores: allTDs.map(td => ({
        politician_name: td.politician_name,
        constituency: td.constituency,
        party: td.party,
        
        // PRIMARY SCORES (0-100) - convert from ELO
        overall_score: convertELOToPercentage(td.overall_elo || 1500),
        transparency_score: convertELOToPercentage(td.transparency_elo || 1500),
        effectiveness_score: convertELOToPercentage(td.effectiveness_elo || 1500),
        integrity_score: convertELOToPercentage(td.integrity_elo || 1500),
        
        // Stats
        total_stories: td.total_stories || 0,
        positive_stories: td.positive_stories || 0,
        negative_stories: td.negative_stories || 0,
        national_rank: td.national_rank,
        weekly_change: td.weekly_elo_change || 0
      })),
      count: allTDs.length
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/td-scores - Get all TDs for selection/search
 * Used by Ask TD feature
 */
router.get('/td-scores', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      return res.json({ success: true, scores: [] });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);

    const { data: tds, error } = await supabaseDb
      .from('td_scores')
      .select('id, politician_name, party, constituency, image_url')
      .eq('is_active', true)
      .order('politician_name', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Error fetching TDs:', error);
      return res.json({ success: true, scores: [] });
    }

    res.json({
      success: true,
      scores: tds || [],
      count: tds?.length || 0
    });

  } catch (error) {
    console.error('TD scores endpoint error:', error);
    res.json({ success: true, scores: [] });
  }
});

/**
 * GET /api/parliamentary/scores/td/:name - Get specific TD ELO score
 */
router.get('/td/:name/elo', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    // In production:
    // const [score] = await db.select().from(tdScores).where(eq(tdScores.politicianName, name));
    
    res.json({
      success: true,
      score: {
        politician_name: name,
        message: 'Database not yet connected - scores will appear once DB is configured'
      }
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/parliamentary/scores/trigger-scrape - Trigger manual news scrape
 */
router.post('/trigger-scrape', async (req, res, next) => {
  try {
    console.log('🔄 Manual news scrape triggered...');
    
    const job = new DailyNewsScraperJob();
    
    // Run in background
    job.execute().catch(error => {
      console.error('❌ Background news scrape failed:', error);
    });
    
    res.json({
      success: true,
      message: 'News scraping job triggered in background'
    });
    
  } catch (error) {
    next(error);
  }
});

// ============================================
// Unified TD Scoring System
// From unifiedTDScoresRoutes.ts
// ============================================

/**
 * GET /api/parliamentary/scores/top - Get top TDs (unified scoring)
 */
router.get('/top', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const topTDs = await UnifiedTDScoringService.getTopTDs(limit);
    
    res.json({
      success: true,
      tds: topTDs,
      count: topTDs.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/td/:name - Get specific TD unified score (0-100 format)
 * This is the PRIMARY endpoint - returns clean 0-100 scores
 */
router.get('/td/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
  if (!supabaseDb) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected'
    });
  }

    // Fetch TD data directly from database (already calculated and stored)
  const { data: tdData, error: tdError } = await supabaseDb
    .from('td_scores')
    .select('*')
    .ilike('politician_name', name)
    .single();

  if (tdError || !tdData) {
    return res.status(404).json({
      success: false,
      message: `TD ${name} not found`
    });
  }

    // Load ideological vectors
  const { data: tdIdeologyProfile } = await supabaseDb
    .from('td_ideology_profiles')
    .select('*')
    .eq('politician_name', tdData.politician_name)
    .maybeSingle();

  const { data: partyIdeologyProfile } = tdData.party
    ? await supabaseDb
        .from('party_ideology_profiles')
        .select('*')
        .eq('party', tdData.party)
        .maybeSingle()
    : { data: null };

    const ideologyVector = emptyIdeologyVector();
    if (tdIdeologyProfile) {
      for (const dimension of IDEOLOGY_DIMENSIONS) {
        ideologyVector[dimension] = Number(tdIdeologyProfile[dimension]) || 0;
      }
    }

    const partyIdeologyVector = partyIdeologyProfile
      ? IDEOLOGY_DIMENSIONS.reduce<Record<string, number>>((acc, dimension) => {
          acc[dimension] = Number(partyIdeologyProfile[dimension]) || 0;
          return acc;
        }, {})
      : null;

    // Use actual 0-100 scores from database (preferred) or convert ELO as fallback
  const transparency_score = Math.round(((tdData.transparency_elo || 1500) - 1000) / 10);
  const effectiveness_score_raw = tdData.effectiveness_score || Math.round(((tdData.effectiveness_elo || 1500) - 1000) / 10);
  const integrity_score = Math.round(((tdData.integrity_elo || 1500) - 1000) / 10);
  const consistency_score = tdData.consistency_score || Math.round(((tdData.consistency_elo || 1500) - 1000) / 10);
  const constituency_service_score_raw = tdData.constituency_service_score || Math.round(((tdData.constituency_service_elo || 1500) - 1000) / 10);

    // Calculate News Impact score from article_td_scores (3-month sliding window)
    // Baseline: 50/100
    // Each article's impact_score (-10 to +10) adds/subtracts a small delta
    // Scale factor: divide by 5 to get -2 to +2 point adjustments per article
    
    // Use 3-month sliding window for relevance
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
  const { data: articles } = await supabaseDb
    .from('article_td_scores')
    .select('impact_score, created_at')
    .eq('politician_name', tdData.politician_name)
    .gte('created_at', threeMonthsAgo.toISOString()); // Only last 3 months

  let news_impact_score = 50; // Baseline for all TDs
  if (articles && articles.length > 0) {
    const totalImpactDelta = articles.reduce((sum, a) => sum + (Number(a.impact_score) || 0), 0) / 5;
    news_impact_score = Math.round(Math.max(0, Math.min(100, 50 + totalImpactDelta)));
  }

  // Latest debate metrics (running aggregates + recent period)
  let debatePerformanceScore = 50;
  let debateEffectivenessScore = 50;
  let debateInfluenceScore = 50;
  let debateEngagementScore = 50;
  let debateMetadata: Record<string, any> | null = null;
  let latestDebateWindow: { start: string | null; end: string | null } | null = null;

  const { data: debateRunningRow, error: debateRunningError } = await supabaseDb
    .from('td_debate_running_scores')
    .select('performance_score, effectiveness_score, influence_score, metadata, last_updated_at')
    .eq('td_id', tdData.id)
    .maybeSingle();

  if (debateRunningError && debateRunningError.code !== 'PGRST116') {
    console.warn(`⚠️ Failed to load debate running scores for ${tdData.politician_name}:`, debateRunningError.message);
  }

  if (debateRunningRow) {
    debatePerformanceScore = convertToPercentage(debateRunningRow.performance_score, debatePerformanceScore);
    debateEffectivenessScore = convertToPercentage(debateRunningRow.effectiveness_score, debateEffectivenessScore);
    debateInfluenceScore = convertToPercentage(debateRunningRow.influence_score, debateInfluenceScore);
    debateMetadata = debateRunningRow.metadata || null;
  }

  const { data: latestDebateMetrics, error: debateMetricsError } = await supabaseDb
    .from('td_debate_metrics')
    .select('engagement_score, effectiveness_score, influence_score, period_start, period_end, speeches, words_spoken, unique_topics, sentiment_score')
    .eq('td_id', tdData.id)
    .order('period_end', { ascending: false })
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (debateMetricsError && debateMetricsError.code !== 'PGRST116') {
    console.warn(`⚠️ Failed to load debate metrics for ${tdData.politician_name}:`, debateMetricsError.message);
  }

  if (latestDebateMetrics) {
    debateEngagementScore = convertToPercentage(latestDebateMetrics.engagement_score, debateEngagementScore);
    debateEffectivenessScore = convertToPercentage(latestDebateMetrics.effectiveness_score, debateEffectivenessScore);
    debateInfluenceScore = convertToPercentage(latestDebateMetrics.influence_score, debateInfluenceScore);
    latestDebateWindow = {
      start: latestDebateMetrics.period_start,
      end: latestDebateMetrics.period_end
    };
  }

  const impactDataAvailable = (articles && articles.length > 0) || !!debateRunningRow;

  // Latest debate metrics (running aggregates + recent period)
  const hasParliamentaryData =
    (tdData.question_count_oral || 0) + (tdData.question_count_written || 0) > 0 ||
    tdData.attendance_percentage != null ||
    tdData.parliamentary_activity_score != null;

  const hasConstituencyData =
    tdData.constituency_service_score != null ||
    tdData.constituency_service_elo != null ||
    tdData.constituency_service_news_score != null;

  const parliamentary_activity_score = tdData.parliamentary_activity_score != null
    ? convertToPercentage(tdData.parliamentary_activity_score, 50)
    : null;
  const effectiveness_score = effectiveness_score_raw != null
    ? convertToPercentage(effectiveness_score_raw, 50)
    : null;
  const constituency_service_score = constituency_service_score_raw != null
    ? convertToPercentage(constituency_service_score_raw, 50)
    : null;
  const attendance_percentage = tdData.attendance_percentage != null
    ? convertToPercentage(tdData.attendance_percentage, 50)
    : null;

  const effectivenessDataAvailable = hasParliamentaryData || !!latestDebateMetrics;
  const constituencyDataAvailable = hasConstituencyData;
  const engagementDataAvailable =
    attendance_percentage != null ||
    !!latestDebateMetrics ||
    tdData.transparency_elo != null;

  let impactBreakdown: Array<WeightedScoreInput & { label: string; detail?: string }> = [];
  let impactScore: number | null = null;
  if (impactDataAvailable) {
    impactBreakdown = [
      {
        label: 'News impact & sentiment',
        score: news_impact_score,
        weight: 0.6,
        detail: `${articles?.length || 0} articles analysed in the last 90 days`
      },
      {
        label: 'Debate influence & outcomes',
        score: debateInfluenceScore,
        weight: 0.4,
        detail: debateMetadata?.recentHighlight
          ? `Latest highlight: ${debateMetadata.recentHighlight}`
          : 'Weighted by debate performance and influence scores'
      }
    ];
    impactScore = weightedAverage(impactBreakdown, 50);
  }

  let effectivenessBreakdown: Array<WeightedScoreInput & { label: string; detail?: string }> = [];
  let effectivenessPillarScore: number | null = null;
  if (effectivenessDataAvailable) {
    const parliamentaryDetailQuestions = (tdData.question_count_oral || 0) + (tdData.question_count_written || 0);
    const attendanceDisplay = attendance_percentage != null ? `${attendance_percentage.toFixed(0)}%` : '—';
    effectivenessBreakdown = [
      {
        label: 'Parliamentary activity',
        score: parliamentary_activity_score ?? 50,
        weight: 0.6,
        detail: `${parliamentaryDetailQuestions} questions • ${attendanceDisplay} attendance`
      },
      {
        label: 'Debate effectiveness',
        score: debateEffectivenessScore,
        weight: 0.4,
        detail: 'Based on speaking time, topic leadership and outcomes'
      }
    ];
    effectivenessPillarScore = weightedAverage(effectivenessBreakdown, 50);
  }

  let constituencyBreakdown: Array<WeightedScoreInput & { label: string; detail?: string }> = [];
  let constituencyPillarScore: number | null = null;
  if (constituencyDataAvailable) {
    const constituencyCoverageScore = convertToPercentage(
      tdData.constituency_service_news_score ?? constituency_service_score ?? 50,
      constituency_service_score ?? 50
    );
    constituencyBreakdown = [
      {
        label: 'Constituency service delivery',
        score: constituency_service_score ?? 50,
        weight: 0.7,
        detail: 'Casework, clinics and local question focus'
      },
      {
        label: 'Local impact coverage',
        score: constituencyCoverageScore,
        weight: 0.3,
        detail: 'Localised media and debate attention'
      }
    ];
    constituencyPillarScore = weightedAverage(constituencyBreakdown, 50);
  }

  let engagementBreakdown: Array<WeightedScoreInput & { label: string; detail?: string }> = [];
  let engagementPillarScore: number | null = null;
  if (engagementDataAvailable) {
    const attendanceDisplay = attendance_percentage != null ? `${attendance_percentage}% of recorded votes attended` : 'Attendance data unavailable';
    engagementBreakdown = [
      {
        label: 'Transparency & openness',
        score: convertToPercentage(transparency_score, 50),
        weight: 0.35,
        detail: 'Declarations, disclosures and accountability signals'
      },
      {
        label: 'Parliamentary attendance',
        score: attendance_percentage ?? 50,
        weight: 0.4,
        detail: attendanceDisplay
      },
      {
        label: 'Debate engagement',
        score: debateEngagementScore,
        weight: 0.25,
        detail: latestDebateWindow
          ? `Latest debate window: ${latestDebateWindow.start} → ${latestDebateWindow.end}`
          : 'Recent debate participation'
      }
    ];
    engagementPillarScore = weightedAverage(engagementBreakdown, 50);
  }

  const pillarSet = [
    { score: impactScore, weight: 0.50, available: impactDataAvailable },
    { score: effectivenessPillarScore, weight: 0.25, available: effectivenessDataAvailable },
    { score: constituencyPillarScore, weight: 0.15, available: constituencyDataAvailable },
    { score: engagementPillarScore, weight: 0.10, available: engagementDataAvailable }
  ];

  const availableWeight = pillarSet.reduce((sum, pillar) => (
    pillar.available && typeof pillar.score === 'number' ? sum + pillar.weight : sum
  ), 0);

  let overall_score: number | null = null;
  if (availableWeight > 0) {
    const normalized = pillarSet.reduce((sum, pillar) => {
      if (!pillar.available || typeof pillar.score !== 'number') {
        return sum;
      }
      return sum + pillar.score * (pillar.weight / availableWeight);
    }, 0);
    overall_score = Math.round(normalized);
  }

  const dataSourcesCount = [
    impactDataAvailable,
    effectivenessDataAvailable,
    constituencyDataAvailable,
    engagementDataAvailable
  ].filter(Boolean).length;
  const confidenceScore = Math.min(1, dataSourcesCount / 4);

    // Calculate seniority
    let seniority = null;
    if (tdData.first_elected_date) {
      const years = new Date().getFullYear() - new Date(tdData.first_elected_date).getFullYear();
      if (years >= 20) seniority = 'Veteran (20+ years)';
      else if (years >= 10) seniority = 'Senior (10-20 years)';
      else if (years >= 5) seniority = 'Experienced (5-10 years)';
      else seniority = 'Junior (0-5 years)';
    }
    
    // Return with 0-100 scores prominently displayed + enhanced data
  res.json({
    success: true,
    td: {
      name: tdData.politician_name,
      politician_name: tdData.politician_name,
      constituency: tdData.constituency,
      party: tdData.party,

      // ⭐ MAIN SCORE - Show this everywhere!
      overall_score,
      overall_elo: tdData.overall_elo,

      // Pillar breakdown with public weights
      components: {
        impact: {
          label: 'Impact',
          score: impactScore,
          weight: 0.50,
          available: impactDataAvailable,
          breakdown: impactDataAvailable ? serializeBreakdown(impactBreakdown) : []
        },
        effectiveness: {
          label: 'Effectiveness',
          score: effectivenessPillarScore,
          weight: 0.25,
          available: effectivenessDataAvailable,
          breakdown: effectivenessDataAvailable ? serializeBreakdown(effectivenessBreakdown) : []
        },
        constituency_service: {
          label: 'Constituency Service',
          score: constituencyPillarScore,
          weight: 0.15,
          available: constituencyDataAvailable,
          breakdown: constituencyDataAvailable ? serializeBreakdown(constituencyBreakdown) : []
        },
        engagement_transparency: {
          label: 'Engagement & Transparency',
          score: engagementPillarScore,
          weight: 0.10,
          available: engagementDataAvailable,
          breakdown: engagementDataAvailable ? serializeBreakdown(engagementBreakdown) : []
        }
      },
      legacy_components: {
        news: impactDataAvailable ? impactScore : null,
        parliamentary: effectivenessDataAvailable ? effectivenessPillarScore : null,
        constituency: constituencyDataAvailable ? constituencyPillarScore : null,
        public_trust: engagementDataAvailable ? engagementPillarScore : null
      },

      ideology: {
        td: ideologyVector,
        tdTotalWeight: Number(tdIdeologyProfile?.total_weight) || 0,
        party: partyIdeologyVector,
        partyTotalWeight: Number(partyIdeologyProfile?.total_weight) || 0,
      },

      // Dimensional breakdown (0-100 each)
      dimensions: {
        transparency: transparency_score,
        effectiveness: effectiveness_score,
        integrity: integrity_score,
        consistency: consistency_score,
        constituency_service: constituency_service_score
      },

      // ELO scores for compatibility
      transparency_elo: tdData.transparency_elo,
      effectiveness_elo: tdData.effectiveness_elo,
      integrity_elo: tdData.integrity_elo,
      consistency_elo: tdData.consistency_elo,
      constituency_service_elo: tdData.constituency_service_elo,

      // Direct score fields for easy frontend access
      effectivenessScore: effectiveness_score,
      consistencyScore: consistency_score,
      constituencyServiceScore: constituency_service_score,

      // Statistics
      total_stories: tdData.total_stories || 0,
      positive_stories: tdData.positive_stories || 0,
      negative_stories: tdData.negative_stories || 0,
      questions_asked: (tdData.question_count_oral || 0) + (tdData.question_count_written || 0),
      bills_sponsored: tdData.bills_sponsored || 0,
      bills_details: tdData.bills_details || [],
      attendance_percentage,

      // Debate metrics snapshot
      debate_metrics: latestDebateMetrics
        ? {
            engagement_score: debateEngagementScore,
            effectiveness_score: debateEffectivenessScore,
            influence_score: debateInfluenceScore,
            speeches: latestDebateMetrics.speeches,
            words_spoken: latestDebateMetrics.words_spoken,
            unique_topics: latestDebateMetrics.unique_topics,
            sentiment_score: latestDebateMetrics.sentiment_score,
            period_start: latestDebateMetrics.period_start,
            period_end: latestDebateMetrics.period_end
          }
        : null,

      // Enhanced data
      gender: tdData.gender,
      image_url: tdData.image_url,
      wikipediaTitle: tdData.wikipedia_title,
      offices: tdData.offices || [],
      committees: tdData.committee_memberships || [],
      firstElectedDate: tdData.first_elected_date,
      currentTermStart: tdData.current_term_start,
      yearsInDail: tdData.first_elected_date ?
        new Date().getFullYear() - new Date(tdData.first_elected_date).getFullYear() : null,
      membershipHistory: tdData.membership_history || [],
      hasProfileImage: tdData.has_profile_image,
      memberCode: tdData.member_code,
      seniority,
      historical_summary: tdData.historical_summary,

      // Parliamentary activity from extracted data (camelCase for frontend)
      questionCountOral: tdData.question_count_oral || 0,
      questionCountWritten: tdData.question_count_written || 0,
      totalVotes: tdData.total_votes || 0,
      votesAttended: tdData.votes_attended || 0,
      attendancePercentage: attendance_percentage,
      parliamentaryActivityScore: parliamentary_activity_score,

      // Rankings
      national_rank: tdData.national_rank,
      constituency_rank: tdData.constituency_rank,
      party_rank: tdData.party_rank,
      ranks: {
        national: tdData.national_rank,
        constituency: tdData.constituency_rank,
        party: tdData.party_rank
      },

      // Trends
      weekly_change: tdData.weekly_elo_change || 0,
      monthly_change: tdData.monthly_elo_change || 0,
      trends: {
        weekly_change: tdData.weekly_elo_change || 0,
        monthly_change: tdData.monthly_elo_change || 0
      },

      // Quality
      confidence_score: confidenceScore,
      data_sources_count: dataSourcesCount,
      confidence: confidenceScore,
      data_sources: dataSourcesCount,
      last_updated: tdData.last_updated,

      // Legacy ELO scores (for apps that still use them)
      legacy_elo: {
        overall: tdData.overall_elo,
        transparency: tdData.transparency_elo,
        effectiveness: tdData.effectiveness_elo,
        integrity: tdData.integrity_elo
      }
    }
  });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/constituency/:constituency - Get TDs by constituency
 */
router.get('/constituency/:constituency', async (req, res, next) => {
  try {
    const { constituency } = req.params;
    
    if (!supabaseDb) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }
    
    const { data: tds, error } = await supabaseDb
      .from('td_scores')
      .select('*')
      .eq('is_active', true)  // Only active TDs
      .ilike('constituency', constituency)
      .order('overall_elo', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      constituency,
      tds: tds || [],
      count: tds?.length || 0
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/parliamentary/scores/recalculate - Trigger comprehensive score recalculation (admin)
 */
router.post('/recalculate', async (req, res, next) => {
  try {
    console.log('🔄 Manual comprehensive score recalculation triggered...');
    
    // Import the job
    const { unifiedScoreJob } = await import('../../jobs/unifiedScoreCalculationJob');
    
    // Run in background
    setTimeout(async () => {
      try {
        await unifiedScoreJob.triggerManual();
        console.log('✅ Comprehensive score recalculation completed');
      } catch (error) {
        console.error('❌ Score recalculation failed:', error);
      }
    }, 100);
    
    res.json({
      success: true,
      message: 'Comprehensive score recalculation triggered in background',
      note: 'This combines news, parliamentary, constituency, and trust data into unified 0-100 scores'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Performance Scores
// From performanceScoresRoutes.ts
// ============================================

/**
 * GET /api/parliamentary/scores/performance/:name - Get performance score for TD
 */
router.get('/performance/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    const performanceScore = await db
      .select()
      .from(performanceScores)
      .where(eq(performanceScores.politicianName, name))
      .limit(1);

    if (performanceScore.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Performance score not found for ${name}`
      });
    }

    res.json({
      success: true,
      data: performanceScore[0]
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/top-performers - Get top performing TDs
 */
router.get('/top-performers', async (req, res, next) => {
  try {
    const topPerformers = await db
      .select()
      .from(performanceScores)
      .orderBy(desc(performanceScores.overallScore))
      .limit(10);

    res.json({
      success: true,
      data: topPerformers
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/lowest-performers - Get lowest performing TDs
 */
router.get('/lowest-performers', async (req, res, next) => {
  try {
    const lowestPerformers = await db
      .select()
      .from(performanceScores)
      .orderBy(asc(performanceScores.overallScore))
      .limit(10);

    res.json({
      success: true,
      data: lowestPerformers
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Trust Scores
// From trustScoresRoutes.ts
// ============================================

/**
 * GET /api/parliamentary/scores/trust/:name - Get detailed trust scores for TD
 */
router.get('/trust/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    const trustData = await db.execute(
      sql`SELECT * FROM politician_trust_scores WHERE politician_name = ${name}`
    );

    if (trustData.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Trust score data not found for this politician' 
      });
    }

    res.json({ 
      success: true, 
      data: trustData.rows[0] 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/trust/constituency/:constituency - Get trust scores by constituency
 */
router.get('/trust/constituency/:constituency', async (req, res, next) => {
  try {
    const { constituency } = req.params;
    
    const trustData = await db.execute(
      sql`SELECT * FROM politician_trust_scores WHERE constituency = ${constituency} ORDER BY overall_trust_score DESC`
    );

    res.json({ 
      success: true, 
      data: trustData.rows 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/top-trustworthy - Get top trustworthy TDs
 */
router.get('/top-trustworthy', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const trustData = await db.execute(
      sql`SELECT * FROM politician_trust_scores ORDER BY overall_trust_score DESC LIMIT ${limit}`
    );

    res.json({ 
      success: true, 
      data: trustData.rows 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/least-trustworthy - Get least trustworthy TDs
 */
router.get('/least-trustworthy', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const trustData = await db.execute(
      sql`SELECT * FROM politician_trust_scores ORDER BY overall_trust_score ASC LIMIT ${limit}`
    );

    res.json({ 
      success: true, 
      data: trustData.rows 
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Top TDs by Parliamentary Questions
// From topTDsRoutes.ts
// ============================================

// TD to constituency mapping based on verified 2024 electoral data
const tdConstituencyMap: Record<string, string> = {
  'Michael Cahill': 'Cork South-West',
  'Pa Daly': 'Kerry', 
  'Matt Carthy': 'Cavan–Monaghan',
  'James Geoghegan': 'Dublin Bay North',
  'Paul Murphy': 'Dublin South-West',
  'Mary Lou McDonald': 'Dublin Central',
  'Paschal Donohoe': 'Dublin Central',
  'Gary Gannon': 'Dublin Central',
  'Neasa Hourigan': 'Dublin Central',
  'John McGuinness': 'Carlow–Kilkenny',
  'Jennifer Murnane O\'Connor': 'Carlow–Kilkenny',
  'Kathleen Funchion': 'Carlow–Kilkenny',
  'John Paul Phelan': 'Carlow–Kilkenny',
  'Malcolm Noonan': 'Carlow–Kilkenny',
  'James Lawless': 'Kildare North',
  'Bernard Durkan': 'Kildare North',
  'Réada Cronin': 'Kildare North',
  'Catherine Murphy': 'Kildare North',
  'Seán Ó Fearghaíl': 'Kildare South',
  'Martin Heydon': 'Kildare South',
  'Patricia Ryan': 'Kildare South',
  'Cathal Berry': 'Kildare South',
  'Charlie McConalogue': 'Donegal',
  'Pearse Doherty': 'Donegal',
  'Pádraig Mac Lochlainn': 'Donegal',
  'Joe McHugh': 'Donegal',
  'Thomas Pringle': 'Donegal',
  'Norma Foley': 'Kerry',
  'Brendan Griffin': 'Kerry',
  'Michael Healy-Rae': 'Kerry',
  'Danny Healy-Rae': 'Kerry'
};

// Load parliamentary data from JSON file
function loadParliamentaryData() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error loading parliamentary data:', error);
    return null;
  }
}

/**
 * GET /api/parliamentary/scores/top-by-questions - Get top TDs by question count
 */
router.get('/top-by-questions', async (req, res, next) => {
  try {
    const parliamentaryData = loadParliamentaryData();
    
    if (!parliamentaryData) {
      return res.status(500).json({
        success: false,
        message: 'Parliamentary data not available'
      });
    }

    // Convert the parliamentary data object to an array and sort by questions asked
    const tdsWithQuestions = Object.entries(parliamentaryData)
      .map(([key, data]: [string, any]) => ({
        name: data.fullName || key,
        questionsAsked: parseInt(data.questionsAsked) || 0,
        party: data.party || 'Independent',
        attendancePercentage: data.attendancePercentage || 0,
        constituency: tdConstituencyMap[data.fullName || key] || 'Unknown'
      }))
      .filter(td => td.questionsAsked > 0) // Only include TDs with question data
      .sort((a, b) => b.questionsAsked - a.questionsAsked) // Sort by questions descending
      .slice(0, 5); // Top 5 TDs for the dashboard

    return res.json({
      success: true,
      data: tdsWithQuestions
    });

  } catch (error) {
    next(error);
  }
});

// ============================================
// Simple Unified Score Endpoints
// These are the easiest to use - just get the 0-100 score
// ============================================

/**
 * GET /api/parliamentary/scores/simple/:name - Super simple endpoint
 * Returns JUST the overall score (0-100) - perfect for widgets
 */
router.get('/simple/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const score = await UnifiedTDScoringService.getTDScore(name);
    
    if (!score) {
      return res.status(404).json({
        success: false,
        message: `TD ${name} not found`
      });
    }
    
    // Super simple response - just what you need!
    res.json({
      name: score.politician_name,
      score: score.overall_score,  // 0-100
      label: getScoreLabel(score.overall_score),
      change: score.weekly_change,
      rank: score.national_rank
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/leaderboard - Leaderboard with simple scores
 */
router.get('/leaderboard', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const tds = await UnifiedTDScoringService.getTopTDs(limit);
    
    // Simple leaderboard format
    res.json({
      success: true,
      leaderboard: tds.map((td, index) => ({
        rank: index + 1,
        name: td.politician_name,
        party: td.party,
        constituency: td.constituency,
        score: td.overall_score,  // 0-100
        label: getScoreLabel(td.overall_score),
        change: td.weekly_change
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/parliamentary/scores/leaderboard/all - Full leaderboard (all active TDs)
 */
router.get('/leaderboard/all', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    const { data: tds, error } = await supabaseDb
      .from('td_scores')
      .select('*')
      .eq('is_active', true)  // Only active TDs
      .order('overall_elo', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      leaderboard: (tds || []).map((td: any, index: number) => ({
        id: td.id,
        rank: index + 1,
        politician_name: td.politician_name,
        party: td.party,
        constituency: td.constituency,
        image_url: td.image_url,
        overall_elo: td.overall_elo,
        overall_score: Math.round(((td.overall_elo || 1500) - 1000) / 10),
        transparency_elo: td.transparency_elo,
        effectiveness_elo: td.effectiveness_elo,
        integrity_elo: td.integrity_elo,
        baseline_modifier: td.baseline_modifier,
        historical_summary: td.historical_summary,
        weekly_elo_change: td.weekly_elo_change || 0,
        total_stories: td.total_stories || 0
      })),
      count: tds?.length || 0
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to get score label
function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Below Average';
  return 'Poor';
}

/**
 * GET /api/parliamentary/scores/parties - Get party performance rankings
 */
router.get('/parties', async (req, res, next) => {
  try {
    if (!supabaseDb) {
      throw new Error('Database not connected');
    }

    // Get all parties with their scores (performance + ideology)
    const { data: partyScores, error } = await supabaseDb
      .from('party_performance_scores')
      .select(`
        *,
        parties:party_id (
          name,
          abbreviation,
          color,
          logo,
          economic_score,
          social_score,
          cultural_score,
          globalism_score,
          environmental_score,
          authority_score,
          welfare_score,
          technocratic_score
        )
      `)
      .eq('score_type', 'parliamentary_activity')
      .order('overall_score', { ascending: false });

    if (error) throw error;

    // Get active member counts for each party
    const partyCounts: Record<string, number> = {};
    const { data: activeTDs } = await supabaseDb
      .from('td_scores')
      .select('party')
      .eq('is_active', true);
    
    (activeTDs || []).forEach((td: any) => {
      const partyName = td.party || 'Unknown';
      partyCounts[partyName] = (partyCounts[partyName] || 0) + 1;
    });

    // Format the response
    const rankings = (partyScores || []).map((score: any, idx: number) => ({
      rank: idx + 1,
      name: score.parties?.name || 'Unknown',
      abbreviation: score.parties?.abbreviation,
      color: score.parties?.color || '#808080',
      logo: score.parties?.logo,
      active_members: partyCounts[score.parties?.name] || 0,
      
      // Performance scores (0-100)
      overall_score: score.overall_score || 0,
      parliamentary_activity_score: score.parliamentary_activity_score || 0,
      transparency_score: score.transparency_score || 0,
      policy_consistency_score: score.policy_consistency_score || 0,
      integrity_score: score.integrity_score || 0,
      pledge_fulfillment_score: score.pledge_fulfillment_score || 0,
      factual_accuracy_score: score.factual_accuracy_score || 0,
      public_accountability_score: score.public_accountability_score || 0,
      conflict_avoidance_score: score.conflict_avoidance_score || 0,
      
      // 8 Dimensional Political Compass Scores (-10 to +10)
      ideology: {
        economic: parseFloat(score.parties?.economic_score as string) || 0,
        social: parseFloat(score.parties?.social_score as string) || 0,
        cultural: parseFloat(score.parties?.cultural_score as string) || 0,
        globalism: parseFloat(score.parties?.globalism_score as string) || 0,
        environmental: parseFloat(score.parties?.environmental_score as string) || 0,
        authority: parseFloat(score.parties?.authority_score as string) || 0,
        welfare: parseFloat(score.parties?.welfare_score as string) || 0,
        technocratic: parseFloat(score.parties?.technocratic_score as string) || 0
      },
      
      government_status: score.government_status || 'opposition'
    }));

    res.json({
      success: true,
      parties: rankings,
      count: rankings.length
    });
  } catch (error) {
    console.error('Party rankings endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch party rankings'
    });
  }
});

export default router;

