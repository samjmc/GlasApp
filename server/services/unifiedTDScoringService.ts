/**
 * Unified TD Scoring Service
 * Combines multiple data sources into one comprehensive score
 * Now returns both ELO (1000-2000) and Percentage (0-100) for consistency
 */

import { supabaseDb } from '../db';
import { getArticleAge } from './eloScoringService';
import { 
  convertELOToPercentage, 
  calculateUnifiedScore,
  calculateDimensionalScores 
} from '../utils/scoreConverter';
import fs from 'fs';
import path from 'path';

// Load parliamentary data
let parliamentaryData: Record<string, any> = {};
try {
  const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
  parliamentaryData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (error) {
  console.error('Failed to load parliamentary data:', error);
}

// Component weights (must sum to 1.0)
const WEIGHTS = {
  news: 0.40,           // 40% - News impact (most visible)
  parliamentary: 0.30,   // 30% - Parliamentary activity (objective data)
  legislative: 0.10,     // 10% - Bills passed (rare but important)
  constituency: 0.15,    // 15% - Local service
  publicTrust: 0.05      // 5% - User votes
};

// K-factors for score changes
const K_FACTORS = {
  news: 40,
  parliamentary: 20,
  legislative: 100,
  constituency: 30,
  publicTrust: 10
};

export interface UnifiedTDScore {
  politician_name: string;
  constituency: string;
  party: string | null;
  
  // ============================================
  // PRIMARY SCORES (0-100 scale) ← Users see these
  // ============================================
  overall_score: number;           // THE main score (0-100)
  
  // Component scores (0-100 each)
  news_score: number;              // From news analysis
  parliamentary_score: number;     // From Dáil activity
  constituency_score: number;      // From local work
  public_trust_score: number;      // From user ratings
  
  // Dimensional scores (0-100 each)
  transparency_score: number;
  effectiveness_score: number;
  integrity_score: number;
  consistency_score: number;
  constituency_service_score: number;
  
  // ============================================
  // LEGACY ELO SCORES (for compatibility)
  // ============================================
  overall_elo: number;             // 1000-2000 scale (legacy)
  transparency_elo: number;
  effectiveness_elo: number;
  integrity_elo: number;
  consistency_elo: number;
  constituency_service_elo: number;
  
  // Rankings
  national_rank: number | null;
  constituency_rank: number | null;
  party_rank: number | null;
  
  // Trends (0-100 scale)
  weekly_change: number;           // Change in overall_score this week
  monthly_change: number;          // Change in overall_score this month
  
  // Statistics
  total_stories: number;
  positive_stories: number;
  negative_stories: number;
  questions_asked: number;
  attendance_percentage: number | null;
  
  // Quality indicators
  confidence_score: number;        // 0-1 based on data availability
  data_sources_count: number;
  last_updated: string;
}

/**
 * Calculate news component ELO for a TD
 */
export async function calculateNewsELO(tdName: string): Promise<number> {
  if (!supabaseDb) return 1500; // Neutral if no DB
  
  try {
    // Get all news articles mentioning this TD
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select('impact_score, published_date, credibility_score, story_type')
      .ilike('politician_name', `%${tdName}%`)
      .order('published_date', { ascending: false });
    
    if (error || !articles || articles.length === 0) {
      return 1500; // Baseline if no news
    }
    
    // Calculate cumulative ELO from news
    let elo = 1500; // Start at baseline
    
    for (const article of articles) {
      const impact = parseFloat(article.impact_score as string) || 0;
      const credibility = parseFloat(article.credibility_score as string) || 0.8;
      const age = getArticleAge(new Date(article.published_date));
      
      // Apply recency decay (newer = more impact)
      const recencyMultiplier = Math.max(0.3, 1 - (age / 365));
      
      // Apply story type multiplier
      const storyMultipliers: Record<string, number> = {
        'scandal': 1.5,
        'achievement': 1.3,
        'policy_work': 1.0,
        'controversy': 0.8,
        'neutral': 0.5
      };
      const typeMultiplier = storyMultipliers[article.story_type || 'neutral'] || 1.0;
      
      // Calculate ELO change
      const adjustedImpact = impact * credibility * recencyMultiplier * typeMultiplier;
      const eloChange = Math.round((adjustedImpact / 10) * K_FACTORS.news);
      
      elo += eloChange;
    }
    
    // Clamp to reasonable range (1000-2000)
    return Math.max(1000, Math.min(2000, elo));
    
  } catch (error) {
    console.error(`Error calculating news ELO for ${tdName}:`, error);
    return 1500;
  }
}

/**
 * Calculate parliamentary activity ELO for a TD
 */
export function calculateParliamentaryELO(tdName: string): number {
  const normalizedName = tdName.toLowerCase();
  const metrics = parliamentaryData[normalizedName];
  
  if (!metrics) {
    return 1500; // Neutral if no data
  }
  
  // Component 1: Questions Score (0-100)
  // Top performers: 200+ questions = 100
  // Average: 80 questions = 50
  // Bottom: <20 questions = 10
  const questionsScore = Math.min(100, Math.max(10, (metrics.questionsAsked / 200) * 100));
  
  // Component 2: Attendance Score (already a percentage)
  const attendanceScore = metrics.attendancePercentage || 50;
  
  // Component 3: Committee Engagement (0-100)
  // Based on "other attendance" (committees, etc.)
  const committeeScore = Math.min(100, Math.max(0, (metrics.otherAttendance / 30) * 100));
  
  // Weighted average: Questions 40%, Attendance 40%, Committee 20%
  const parliamentaryScore = (
    questionsScore * 0.4 +
    attendanceScore * 0.4 +
    committeeScore * 0.2
  );
  
  // Convert 0-100 score to ELO (1300-1700 range)
  // 100 = 1700, 50 = 1500, 0 = 1300
  return Math.round(1300 + (parliamentaryScore / 100) * 400);
}

/**
 * Calculate unified TD score combining all components
 */
export async function calculateUnifiedTDScore(tdName: string, constituency: string, party: string | null): Promise<UnifiedTDScore> {
  
  console.log(`📊 Calculating unified score for ${tdName}...`);
  
  // Calculate component ELOs
  const newsELO = await calculateNewsELO(tdName);
  const parliamentaryELO = calculateParliamentaryELO(tdName);
  const legislativeELO = 1500; // TODO: Implement when we add legislative tracking
  const constituencyELO = 1500; // TODO: Implement constituency tracking
  const publicTrustELO = 1500; // TODO: Implement user voting system
  
  // Calculate weighted overall ELO
  const overallELO = Math.round(
    newsELO * WEIGHTS.news +
    parliamentaryELO * WEIGHTS.parliamentary +
    legislativeELO * WEIGHTS.legislative +
    constituencyELO * WEIGHTS.constituency +
    publicTrustELO * WEIGHTS.publicTrust
  );
  
  console.log(`   News: ${newsELO}, Parliamentary: ${parliamentaryELO}, Overall: ${overallELO}`);
  
  // Calculate dimensional ELOs (based primarily on news for now)
  const dimensionalScores = await calculateDimensionalELOs(tdName);
  
  // Get statistics
  const stats = await getTDStatistics(tdName);
  
  // Calculate confidence (how much data we have)
  let dataSourcesCount = 0;
  if (stats.news_articles > 0) dataSourcesCount++;
  if (parliamentaryELO !== 1500) dataSourcesCount++;
  // TODO: Add more sources as implemented
  
  const confidenceScore = Math.min(1.0, dataSourcesCount / 5);
  
  // ============================================
  // CONVERT TO 0-100 SCALE (Primary display)
  // ============================================
  const percentageScores = calculateUnifiedScore({
    overall_elo: newsELO,  // Use ONLY news ELO, not weighted overall
    questionsAsked: stats.questions_asked,
    attendancePercentage: stats.attendance_percentage,
    constituency_service_score: convertELOToPercentage(constituencyELO),
    public_trust_score: convertELOToPercentage(publicTrustELO)
  });
  
  const dimensionalPercentages = calculateDimensionalScores(dimensionalScores);
  
  return {
    politician_name: tdName,
    constituency,
    party,
    
    // PRIMARY SCORES (0-100) - Users see these!
    overall_score: percentageScores.overall_score,
    news_score: percentageScores.news_score,
    parliamentary_score: percentageScores.parliamentary_score,
    constituency_score: percentageScores.constituency_score,
    public_trust_score: percentageScores.public_trust_score,
    
    // Dimensional scores (0-100)
    transparency_score: dimensionalPercentages.transparency,
    effectiveness_score: dimensionalPercentages.effectiveness,
    integrity_score: dimensionalPercentages.integrity,
    consistency_score: dimensionalPercentages.consistency,
    constituency_service_score: dimensionalPercentages.constituency_service,
    
    // Legacy ELO scores (for backward compatibility)
    overall_elo: overallELO,
    transparency_elo: dimensionalScores.transparency,
    effectiveness_elo: dimensionalScores.effectiveness,
    integrity_elo: dimensionalScores.integrity,
    consistency_elo: dimensionalScores.consistency,
    constituency_service_elo: dimensionalScores.constituency_service,
    
    national_rank: null, // Will be calculated after all TDs scored
    constituency_rank: null,
    party_rank: null,
    
    weekly_change: 0, // TODO: Calculate from history
    monthly_change: 0,
    
    total_stories: stats.news_articles,
    positive_stories: stats.positive_articles,
    negative_stories: stats.negative_articles,
    questions_asked: stats.questions_asked,
    attendance_percentage: stats.attendance_percentage,
    
    confidence_score: confidenceScore,
    data_sources_count: dataSourcesCount,
    last_updated: new Date().toISOString()
  };
}

/**
 * Calculate dimensional ELOs
 */
async function calculateDimensionalELOs(tdName: string) {
  if (!supabaseDb) {
    return {
      transparency: 1500,
      effectiveness: 1500,
      integrity: 1500,
      consistency: 1500,
      constituency_service: 1500
    };
  }
  
  // Get news impacts for each dimension
  const { data: articles } = await supabaseDb
    .from('news_articles')
    .select('transparency_impact, effectiveness_impact, integrity_impact, consistency_impact, constituency_service_impact, published_date, credibility_score')
    .ilike('politician_name', `%${tdName}%`);
  
  if (!articles || articles.length === 0) {
    // Use parliamentary data for effectiveness if available
    const parlELO = calculateParliamentaryELO(tdName);
    return {
      transparency: 1500,
      effectiveness: parlELO, // Parliamentary activity = effectiveness
      integrity: 1500,
      consistency: 1500,
      constituency_service: 1500
    };
  }
  
  // Calculate each dimensional ELO from news impacts
  const dimensions = {
    transparency: 1500,
    effectiveness: 1500,
    integrity: 1500,
    consistency: 1500,
    constituency_service: 1500
  };
  
  for (const article of articles) {
    const age = getArticleAge(new Date(article.published_date));
    const recency = Math.max(0.3, 1 - (age / 365));
    const credibility = parseFloat(article.credibility_score as string) || 0.8;
    
    // Update each dimension
    if (article.transparency_impact) {
      const impact = parseFloat(article.transparency_impact as string);
      dimensions.transparency += Math.round((impact / 10) * K_FACTORS.news * credibility * recency);
    }
    
    if (article.effectiveness_impact) {
      const impact = parseFloat(article.effectiveness_impact as string);
      dimensions.effectiveness += Math.round((impact / 10) * K_FACTORS.news * credibility * recency);
    }
    
    if (article.integrity_impact) {
      const impact = parseFloat(article.integrity_impact as string);
      dimensions.integrity += Math.round((impact / 10) * K_FACTORS.news * credibility * recency);
    }
    
    if (article.consistency_impact) {
      const impact = parseFloat(article.consistency_impact as string);
      dimensions.consistency += Math.round((impact / 10) * K_FACTORS.news * credibility * recency);
    }
    
    if (article.constituency_service_impact) {
      const impact = parseFloat(article.constituency_service_impact as string);
      dimensions.constituency_service += Math.round((impact / 10) * K_FACTORS.news * credibility * recency);
    }
  }
  
  // Blend effectiveness with parliamentary activity
  const parlELO = calculateParliamentaryELO(tdName);
  if (parlELO !== 1500) {
    dimensions.effectiveness = Math.round(dimensions.effectiveness * 0.6 + parlELO * 0.4);
  }
  
  // Clamp all to 1000-2000 range
  Object.keys(dimensions).forEach(key => {
    dimensions[key as keyof typeof dimensions] = Math.max(1000, Math.min(2000, dimensions[key as keyof typeof dimensions]));
  });
  
  return dimensions;
}

/**
 * Get TD statistics
 */
async function getTDStatistics(tdName: string) {
  const normalizedName = tdName.toLowerCase();
  const parliamentary = parliamentaryData[normalizedName] || {};
  
  let newsStats = {
    total: 0,
    positive: 0,
    negative: 0
  };
  
  if (supabaseDb) {
    const { data: articles } = await supabaseDb
      .from('news_articles')
      .select('sentiment')
      .ilike('politician_name', `%${tdName}%`);
    
    if (articles) {
      newsStats.total = articles.length;
      newsStats.positive = articles.filter(a => a.sentiment?.includes('positive')).length;
      newsStats.negative = articles.filter(a => a.sentiment?.includes('negative')).length;
    }
  }
  
  return {
    news_articles: newsStats.total,
    positive_articles: newsStats.positive,
    negative_articles: newsStats.negative,
    questions_asked: parliamentary.questionsAsked || 0,
    attendance_percentage: parliamentary.attendancePercentage || null
  };
}

/**
 * Save unified score to database
 */
export async function saveUnifiedScore(score: UnifiedTDScore): Promise<void> {
  if (!supabaseDb) {
    throw new Error('Supabase not connected');
  }
  
  const { data, error } = await supabaseDb
    .from('td_scores')
    .upsert({
      politician_name: score.politician_name,
      constituency: score.constituency,
      party: score.party,
      overall_elo: score.overall_elo,
      transparency_elo: score.transparency_elo,
      effectiveness_elo: score.effectiveness_elo,
      integrity_elo: score.integrity_elo,
      consistency_elo: score.consistency_elo,
      constituency_service_elo: score.constituency_service_elo,
      total_stories: score.total_stories,
      positive_stories: score.positive_stories,
      negative_stories: score.negative_stories,
      weekly_elo_change: score.elo_7d_change,
      monthly_elo_change: score.elo_30d_change,
      last_updated: new Date().toISOString()
    }, { onConflict: 'politician_name' })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save TD score: ${error.message}`);
  }
  
  console.log(`✅ Saved unified score for ${score.politician_name}: ${score.overall_elo}`);
}

/**
 * Calculate and save scores for all TDs with news coverage
 */
export async function recalculateAllTDScores(): Promise<{ processed: number; errors: number }> {
  if (!supabaseDb) {
    throw new Error('Supabase not connected');
  }
  
  console.log('\n🔄 Recalculating all TD scores...\n');
  
  // Get all unique TDs mentioned in news
  const { data: tdMentions } = await supabaseDb
    .from('news_articles')
    .select('politician_name, constituency, party')
    .not('politician_name', 'is', null);
  
  if (!tdMentions || tdMentions.length === 0) {
    console.log('⚠️  No TDs found in news articles yet');
    return { processed: 0, errors: 0 };
  }
  
  // Get unique TDs
  const uniqueTDs = new Map<string, { constituency: string; party: string | null }>();
  for (const mention of tdMentions) {
    if (mention.politician_name) {
      uniqueTDs.set(mention.politician_name, {
        constituency: mention.constituency || 'Unknown',
        party: mention.party
      });
    }
  }
  
  console.log(`Found ${uniqueTDs.size} unique TDs in news articles`);
  
  let processed = 0;
  let errors = 0;
  
  // Calculate score for each TD
  for (const [tdName, info] of uniqueTDs) {
    try {
      const score = await calculateUnifiedTDScore(tdName, info.constituency, info.party);
      await saveUnifiedScore(score);
      processed++;
      console.log(`   [${processed}/${uniqueTDs.size}] ${tdName}: ${score.overall_elo}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to score ${tdName}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n✅ Recalculation complete: ${processed} scored, ${errors} errors\n`);
  
  // Update rankings
  await updateRankings();
  
  return { processed, errors };
}

/**
 * Update national, constituency, and party rankings
 */
export async function updateRankings(): Promise<void> {
  if (!supabaseDb) return;
  
  console.log('📊 Updating rankings...');
  
  // Get all scores
  const { data: allScores } = await supabaseDb
    .from('td_scores')
    .select('politician_name, overall_elo, constituency, party')
    .order('overall_elo', { ascending: false });
  
  if (!allScores || allScores.length === 0) return;
  
  // Update national ranks
  for (let i = 0; i < allScores.length; i++) {
    await supabaseDb
      .from('td_scores')
      .update({ national_rank: i + 1 })
      .eq('politician_name', allScores[i].politician_name);
  }
  
  console.log(`✅ Updated ${allScores.length} rankings`);
}

/**
 * Get top TDs by overall ELO
 */
export async function getTopTDs(limit: number = 10): Promise<UnifiedTDScore[]> {
  if (!supabaseDb) return [];
  
  const { data } = await supabaseDb
    .from('td_scores')
    .select('*')
    .eq('is_active', true)  // Only active TDs
    .order('overall_elo', { ascending: false })
    .limit(limit);
  
  return (data || []) as UnifiedTDScore[];
}

/**
 * Get TD score by name
 */
export async function getTDScore(tdName: string): Promise<UnifiedTDScore | null> {
  if (!supabaseDb) return null;
  
  const { data } = await supabaseDb
    .from('td_scores')
    .select('*')
    .ilike('politician_name', tdName)
    .single();
  
  return data as UnifiedTDScore | null;
}

export const UnifiedTDScoringService = {
  calculateNewsELO,
  calculateParliamentaryELO,
  calculateUnifiedTDScore,
  recalculateAllTDScores,
  updateRankings,
  getTopTDs,
  getTDScore,
  saveUnifiedScore
};

