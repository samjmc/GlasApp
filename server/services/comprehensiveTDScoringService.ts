/**
 * Comprehensive TD Scoring Service
 * 
 * This is the AUTHORITATIVE scoring service that combines ALL data sources
 * into a single unified 0-100 score per TD.
 * 
 * Data Sources:
 * - News analysis (50% weight) - AI analysis of news articles
 * - Parliamentary activity (30% weight) - Questions, attendance, committee work
 * - Constituency service (15% weight) - Clinics, casework, local engagement
 * - Public trust (5% weight) - User ratings and feedback
 */

import { db, supabaseDb } from '../db';
import { unifiedTDScores, unifiedScoreHistory, newsArticles, userTDRatings } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { convertELOToPercentage } from '../utils/scoreConverter';
import fs from 'fs';
import path from 'path';

// ============================================
// CONFIGURABLE WEIGHTS
// ============================================

export const COMPONENT_WEIGHTS = {
  news: 0.50,           // 50% - Most visible/impactful
  parliamentary: 0.30,   // 30% - Objective, measurable
  constituency: 0.15,    // 15% - Important but hard to track
  publicTrust: 0.05      // 5% - Subjective but valuable
};

// Load parliamentary data
let parliamentaryData: Record<string, any> = {};
try {
  const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
  if (fs.existsSync(dataPath)) {
    parliamentaryData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
} catch (error) {
  console.error('Failed to load parliamentary data:', error);
}

// ============================================
// COMPONENT SCORE CALCULATORS
// ============================================

/**
 * Calculate news-based score (0-100)
 * Based on AI analysis of news articles
 */
export async function calculateNewsScore(tdName: string): Promise<{
  score: number;
  transparency: number;
  effectiveness: number;
  integrity: number;
  consistency: number;
  constituencyService: number;
  articleCount: number;
}> {
  if (!supabaseDb) {
    return {
      score: 50,
      transparency: 50,
      effectiveness: 50,
      integrity: 50,
      consistency: 50,
      constituencyService: 50,
      articleCount: 0
    };
  }
  
  try {
    // Get all news articles mentioning this TD
    const { data: articles, error } = await supabaseDb
      .from('news_articles')
      .select('*')
      .ilike('politician_name', `%${tdName}%`)
      .order('published_date', { ascending: false })
      .limit(100); // Last 100 articles
    
    if (error || !articles || articles.length === 0) {
      return {
        score: 50,
        transparency: 50,
        effectiveness: 50,
        integrity: 50,
        consistency: 50,
        constituencyService: 50,
        articleCount: 0
      };
    }
    
    // Calculate average impact with recency weighting
    let weightedImpactSum = 0;
    let weightSum = 0;
    let dimensionSums = {
      transparency: 0,
      effectiveness: 0,
      integrity: 0,
      consistency: 0,
      constituencyService: 0
    };
    
    const now = new Date();
    
    for (const article of articles) {
      const publishedDate = new Date(article.published_date);
      const ageInDays = (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Recency weight (newer = more important)
      // Full weight for last 30 days, then exponential decay
      const recencyWeight = ageInDays <= 30 
        ? 1.0 
        : Math.exp(-(ageInDays - 30) / 90); // 90-day half-life
      
      // Source credibility weight
      const credibility = parseFloat(article.credibility_score as string) || 0.8;
      
      // Combined weight
      const weight = recencyWeight * credibility;
      
      // Weighted impact
      const impact = parseFloat(article.impact_score as string) || 0;
      weightedImpactSum += impact * weight;
      weightSum += weight;
      
      // Dimensional impacts
      dimensionSums.transparency += (parseFloat(article.transparency_impact as string) || 0) * weight;
      dimensionSums.effectiveness += (parseFloat(article.effectiveness_impact as string) || 0) * weight;
      dimensionSums.integrity += (parseFloat(article.integrity_impact as string) || 0) * weight;
      dimensionSums.consistency += (parseFloat(article.consistency_impact as string) || 0) * weight;
      dimensionSums.constituencyService += (parseFloat(article.constituency_service_impact as string) || 0) * weight;
    }
    
    // Calculate averages
    const avgImpact = weightSum > 0 ? weightedImpactSum / weightSum : 0;
    
    // Convert impact (-10 to +10) to score (0-100)
    // 0 impact = 50 score (neutral)
    // +10 impact = 100 score (perfect)
    // -10 impact = 0 score (terrible)
    const newsScore = 50 + (avgImpact * 5);
    
    // Calculate dimensional scores
    const dimensionScores = {
      transparency: 50 + ((weightSum > 0 ? dimensionSums.transparency / weightSum : 0) * 5),
      effectiveness: 50 + ((weightSum > 0 ? dimensionSums.effectiveness / weightSum : 0) * 5),
      integrity: 50 + ((weightSum > 0 ? dimensionSums.integrity / weightSum : 0) * 5),
      consistency: 50 + ((weightSum > 0 ? dimensionSums.consistency / weightSum : 0) * 5),
      constituencyService: 50 + ((weightSum > 0 ? dimensionSums.constituencyService / weightSum : 0) * 5)
    };
    
    return {
      score: Math.min(100, Math.max(0, newsScore)),
      transparency: Math.min(100, Math.max(0, dimensionScores.transparency)),
      effectiveness: Math.min(100, Math.max(0, dimensionScores.effectiveness)),
      integrity: Math.min(100, Math.max(0, dimensionScores.integrity)),
      consistency: Math.min(100, Math.max(0, dimensionScores.consistency)),
      constituencyService: Math.min(100, Math.max(0, dimensionScores.constituencyService)),
      articleCount: articles.length
    };
    
  } catch (error) {
    console.error(`Error calculating news score for ${tdName}:`, error);
    return {
      score: 50,
      transparency: 50,
      effectiveness: 50,
      integrity: 50,
      consistency: 50,
      constituencyService: 50,
      articleCount: 0
    };
  }
}

/**
 * Calculate parliamentary activity score (0-100)
 * Based on questions asked, attendance, committee work
 */
export function calculateParliamentaryScore(tdName: string): {
  score: number;
  questionsScore: number;
  attendanceScore: number;
  committeeScore: number;
  questionsAsked: number;
  attendancePercentage: number | null;
} {
  const normalizedName = tdName.toLowerCase();
  const metrics = parliamentaryData[normalizedName];
  
  if (!metrics) {
    return {
      score: 50,
      questionsScore: 50,
      attendanceScore: 50,
      committeeScore: 50,
      questionsAsked: 0,
      attendancePercentage: null
    };
  }
  
  // 1. Questions Score (0-100)
  const questionsAsked = parseInt(metrics.questionsAsked) || 0;
  const EXCELLENT_QUESTIONS = 200; // Top performers ask 200+ questions
  const questionsScore = Math.min(100, (questionsAsked / EXCELLENT_QUESTIONS) * 100);
  
  // 2. Attendance Score (0-100)
  const attendance = parseFloat(metrics.attendancePercentage) || 0;
  const attendanceScore = attendance; // Already 0-100
  
  // 3. Committee Score (placeholder - TODO: implement when we have data)
  const committeeScore = 50;
  
  // Weighted average
  const parliamentaryScore = (
    questionsScore * 0.60 +      // Questions are most important
    attendanceScore * 0.30 +      // Attendance matters
    committeeScore * 0.10         // Committee work (when available)
  );
  
  return {
    score: Math.min(100, Math.max(0, Math.round(parliamentaryScore))),
    questionsScore: Math.round(questionsScore),
    attendanceScore: Math.round(attendanceScore),
    committeeScore: Math.round(committeeScore),
    questionsAsked,
    attendancePercentage: attendance
  };
}

/**
 * Calculate constituency service score (0-100)
 * TODO: Implement when we have constituency data
 */
export async function calculateConstituencyScore(tdName: string): Promise<{
  score: number;
  clinicsHeld: number;
  casesResolved: number;
}> {
  // TODO: Implement constituency tracking
  // For now, return neutral score
  return {
    score: 50,
    clinicsHeld: 0,
    casesResolved: 0
  };
}

/**
 * Calculate public trust score (0-100)
 * Based on user ratings across all dimensions
 */
export async function calculatePublicTrustScore(tdName: string): Promise<{
  score: number;
  ratingCount: number;
  averageRating: number;
  dimensionalRatings?: {
    transparency: number;
    effectiveness: number;
    integrity: number;
    consistency: number;
    constituencyService: number;
  };
}> {
  if (!supabaseDb) {
    return { score: 50, ratingCount: 0, averageRating: 0 };
  }
  
  try {
    // Get all user ratings for this TD
    const { data: ratings, error } = await supabaseDb
      .from('user_td_ratings')
      .select('*')
      .eq('politician_name', tdName);
    
    if (error || !ratings || ratings.length === 0) {
      return { score: 50, ratingCount: 0, averageRating: 0 };
    }
    
    // Calculate averages for each dimension
    const totals = {
      transparency: 0,
      effectiveness: 0,
      integrity: 0,
      consistency: 0,
      constituencyService: 0,
      count: {
        transparency: 0,
        effectiveness: 0,
        integrity: 0,
        consistency: 0,
        constituencyService: 0
      }
    };
    
    ratings.forEach(r => {
      if (r.transparency_rating != null) {
        totals.transparency += r.transparency_rating;
        totals.count.transparency++;
      }
      if (r.effectiveness_rating != null) {
        totals.effectiveness += r.effectiveness_rating;
        totals.count.effectiveness++;
      }
      if (r.integrity_rating != null) {
        totals.integrity += r.integrity_rating;
        totals.count.integrity++;
      }
      if (r.consistency_rating != null) {
        totals.consistency += r.consistency_rating;
        totals.count.consistency++;
      }
      if (r.constituency_service_rating != null) {
        totals.constituencyService += r.constituency_service_rating;
        totals.count.constituencyService++;
      }
    });
    
    // Calculate dimensional averages
    const dimensionalRatings = {
      transparency: totals.count.transparency > 0 
        ? Math.round(totals.transparency / totals.count.transparency) 
        : 50,
      effectiveness: totals.count.effectiveness > 0 
        ? Math.round(totals.effectiveness / totals.count.effectiveness) 
        : 50,
      integrity: totals.count.integrity > 0 
        ? Math.round(totals.integrity / totals.count.integrity) 
        : 50,
      consistency: totals.count.consistency > 0 
        ? Math.round(totals.consistency / totals.count.consistency) 
        : 50,
      constituencyService: totals.count.constituencyService > 0 
        ? Math.round(totals.constituencyService / totals.count.constituencyService) 
        : 50
    };
    
    // Calculate overall score (average of all dimensions)
    const allDimensionScores = Object.values(dimensionalRatings);
    const overallScore = Math.round(
      allDimensionScores.reduce((sum, val) => sum + val, 0) / allDimensionScores.length
    );
    
    return {
      score: overallScore,
      ratingCount: ratings.length,
      averageRating: overallScore,
      dimensionalRatings
    };
    
  } catch (error) {
    console.error(`Error calculating public trust for ${tdName}:`, error);
    return { score: 50, ratingCount: 0, averageRating: 0 };
  }
}

// ============================================
// MAIN UNIFIED SCORE CALCULATION
// ============================================

/**
 * Calculate comprehensive unified score for a TD
 * Combines ALL data sources with proper weighting
 */
export async function calculateComprehensiveScore(
  tdName: string,
  constituency: string,
  party: string | null
): Promise<{
  overall_score: number;
  component_scores: {
    news: number;
    parliamentary: number;
    constituency: number;
    publicTrust: number;
  };
  dimensional_scores: {
    transparency: number;
    effectiveness: number;
    integrity: number;
    consistency: number;
    constituencyService: number;
  };
  statistics: any;
  confidence: number;
}> {
  console.log(`📊 Calculating comprehensive score for ${tdName}...`);
  
  // 1. Get news score (50% weight)
  const newsData = await calculateNewsScore(tdName);
  console.log(`   News: ${newsData.score}/100 (${newsData.articleCount} articles)`);
  
  // 2. Get parliamentary score (30% weight)
  const parlData = calculateParliamentaryScore(tdName);
  console.log(`   Parliamentary: ${parlData.score}/100 (${parlData.questionsAsked} questions)`);
  
  // 3. Get constituency score (15% weight)
  const constData = await calculateConstituencyScore(tdName);
  console.log(`   Constituency: ${constData.score}/100`);
  
  // 4. Get public trust score (5% weight)
  const trustData = await calculatePublicTrustScore(tdName);
  console.log(`   Public Trust: ${trustData.score}/100 (${trustData.ratingCount} ratings)`);
  
  // ============================================
  // WEIGHTED OVERALL SCORE
  // ============================================
  const overallScore = (
    newsData.score * COMPONENT_WEIGHTS.news +
    parlData.score * COMPONENT_WEIGHTS.parliamentary +
    constData.score * COMPONENT_WEIGHTS.constituency +
    trustData.score * COMPONENT_WEIGHTS.publicTrust
  );
  
  console.log(`   ⭐ OVERALL: ${Math.round(overallScore)}/100`);
  
  // ============================================
  // DIMENSIONAL SCORES (from news + parliamentary)
  // ============================================
  const dimensionalScores = {
    transparency: newsData.transparency,
    effectiveness: Math.round((newsData.effectiveness * 0.6) + (parlData.score * 0.4)), // Combine news + parl
    integrity: newsData.integrity,
    consistency: newsData.consistency,
    constituencyService: Math.round((newsData.constituencyService * 0.5) + (constData.score * 0.5))
  };
  
  // ============================================
  // CONFIDENCE SCORE (0-1)
  // ============================================
  let dataSourcesCount = 0;
  if (newsData.articleCount > 0) dataSourcesCount++;
  if (parlData.questionsAsked > 0) dataSourcesCount++;
  if (constData.clinicsHeld > 0) dataSourcesCount++;
  if (trustData.ratingCount > 0) dataSourcesCount++;
  
  // Confidence: 0.2 per data source (max 5 sources = 1.0)
  const confidence = Math.min(1.0, dataSourcesCount * 0.25);
  
  return {
    overall_score: Math.round(overallScore),
    component_scores: {
      news: Math.round(newsData.score),
      parliamentary: parlData.score,
      constituency: constData.score,
      publicTrust: trustData.score
    },
    dimensional_scores: dimensionalScores,
    statistics: {
      total_stories: newsData.articleCount,
      positive_stories: 0, // TODO: Calculate from articles
      negative_stories: 0,
      questions_asked: parlData.questionsAsked,
      attendance_percentage: parlData.attendancePercentage,
      clinics_held: constData.clinicsHeld,
      cases_resolved: constData.casesResolved,
      user_ratings_count: trustData.ratingCount,
      average_user_rating: trustData.averageRating
    },
    confidence: confidence
  };
}

/**
 * Save unified score to database
 */
export async function saveUnifiedScore(
  tdName: string,
  constituency: string,
  party: string | null,
  scoreData: Awaited<ReturnType<typeof calculateComprehensiveScore>>
): Promise<void> {
  const nowIso = new Date().toISOString();
  const componentCount = Object.values(scoreData.component_scores).filter(s => s > 0).length;
  
  if (db) {
    try {
      const existing = await db
        .select()
        .from(unifiedTDScores)
        .where(eq(unifiedTDScores.politicianName, tdName))
        .limit(1);
      
      const scoreRecord = {
        politicianName: tdName,
        constituency,
        party,
        overallScore: scoreData.overall_score.toString(),
        newsScore: scoreData.component_scores.news.toString(),
        parliamentaryScore: scoreData.component_scores.parliamentary.toString(),
        constituencyScore: scoreData.component_scores.constituency.toString(),
        publicTrustScore: scoreData.component_scores.publicTrust.toString(),
        transparencyScore: scoreData.dimensional_scores.transparency.toString(),
        effectivenessScore: scoreData.dimensional_scores.effectiveness.toString(),
        integrityScore: scoreData.dimensional_scores.integrity.toString(),
        consistencyScore: scoreData.dimensional_scores.consistency.toString(),
        constituencyServiceScore: scoreData.dimensional_scores.constituencyService.toString(),
        totalStories: scoreData.statistics.total_stories,
        questionsAsked: scoreData.statistics.questions_asked,
        attendancePercentage: scoreData.statistics.attendance_percentage?.toString() || null,
        clinicsHeld: scoreData.statistics.clinics_held,
        casesResolved: scoreData.statistics.cases_resolved,
        confidenceScore: scoreData.confidence.toString(),
        dataSourcesCount: componentCount,
        lastCalculated: new Date(nowIso),
        updatedAt: new Date(nowIso)
      };
      
      if (existing.length > 0) {
        const oldScore = parseFloat(existing[0].overallScore);
        const newScore = scoreData.overall_score;
        const change = newScore - oldScore;
        
        await db
          .update(unifiedTDScores)
          .set(scoreRecord)
          .where(eq(unifiedTDScores.politicianName, tdName));
        
        if (Math.abs(change) >= 0.5) {
          await db.insert(unifiedScoreHistory).values({
            politicianName: tdName,
            oldOverallScore: oldScore.toString(),
            newOverallScore: newScore.toString(),
            scoreChange: change.toString(),
            triggerType: 'recalculation',
            newsScore: scoreData.component_scores.news.toString(),
            parliamentaryScore: scoreData.component_scores.parliamentary.toString(),
            constituencyScore: scoreData.component_scores.constituency.toString(),
            publicTrustScore: scoreData.component_scores.publicTrust.toString()
          });
        }
        
        console.log(`✅ Updated ${tdName}: ${oldScore} → ${newScore} (${change >= 0 ? '+' : ''}${change.toFixed(1)})`);
      } else {
        await db.insert(unifiedTDScores).values(scoreRecord);
        console.log(`✅ Created score for ${tdName}: ${scoreData.overall_score}/100`);
      }
      
    } catch (error: any) {
      if (error?.code === '42501') {
        logUnifiedScorePermissionWarning();
        return;
      }
      console.error(`Error saving unified score for ${tdName}:`, error);
      throw error;
    }
    return;
  }
  
  if (!supabaseDb) {
    console.warn('Database not connected - cannot save score');
    return;
  }
  
  try {
    const fetchResult = await supabaseDb
      .from('unified_td_scores')
      .select('id, overall_score')
      .eq('politician_name', tdName)
      .maybeSingle();
    
    if (fetchResult.error) {
      throw fetchResult.error;
    }
    
    const payload = {
      _politician_name: tdName,
      _constituency: constituency,
      _party: party,
      _overall_score: scoreData.overall_score,
      _news_score: scoreData.component_scores.news,
      _parliamentary_score: scoreData.component_scores.parliamentary,
      _constituency_score: scoreData.component_scores.constituency,
      _public_trust_score: scoreData.component_scores.publicTrust,
      _transparency_score: scoreData.dimensional_scores.transparency,
      _effectiveness_score: scoreData.dimensional_scores.effectiveness,
      _integrity_score: scoreData.dimensional_scores.integrity,
      _consistency_score: scoreData.dimensional_scores.consistency,
      _constituency_service_score: scoreData.dimensional_scores.constituencyService,
      _confidence_level: scoreData.confidence,
      _data_sources_count: componentCount,
      _last_calculated: nowIso
    };
    
    const { error: upsertError } = await supabaseDb.rpc('upsert_unified_td_score', payload);
    if (upsertError) {
      throw upsertError;
    }
    
    if (fetchResult.data) {
      const oldScore = Number(fetchResult.data.overall_score) || 0;
      const newScore = scoreData.overall_score;
      const change = newScore - oldScore;
      if (Math.abs(change) >= 0.5) {
        const { error: historyError } = await supabaseDb
          .from('unified_score_history')
          .insert({
            politician_name: tdName,
            old_overall_score: oldScore,
            new_overall_score: newScore,
            score_change: change,
            trigger_type: 'recalculation',
            news_score: scoreData.component_scores.news,
            parliamentary_score: scoreData.component_scores.parliamentary,
            constituency_score: scoreData.component_scores.constituency,
            public_trust_score: scoreData.component_scores.publicTrust
          });
        
        if (historyError) {
          console.warn(`⚠️ Failed to record score history for ${tdName}: ${historyError.message}`);
        }
      }
      
      console.log(`✅ Updated ${tdName}: ${oldScore} → ${scoreData.overall_score} (${change >= 0 ? '+' : ''}${change.toFixed(1)})`);
    } else {
      console.log(`✅ Created score for ${tdName}: ${scoreData.overall_score}/100`);
    }
    
  } catch (error: any) {
    if (error?.code === '42501') {
      logUnifiedScorePermissionWarning(error);
      return;
    }
    console.error(`Error saving unified score for ${tdName}:`, error);
    throw error;
  }
}

let unifiedScorePermissionWarningLogged = false;

function logUnifiedScorePermissionWarning(error?: any) {
  if (unifiedScorePermissionWarningLogged) return;
  unifiedScorePermissionWarningLogged = true;
  const detail = error?.message || error?.hint || JSON.stringify(error);
  console.warn('⚠️ Supabase service role lacks permission to update unified_td_scores. Skipping unified score persistence.', detail ? `Details: ${detail}` : '');
}

/**
 * Recalculate score for a single TD
 */
export async function recalculateTDScore(
  tdName: string,
  constituency: string,
  party: string | null
): Promise<any> {
  const scoreData = await calculateComprehensiveScore(tdName, constituency, party);
  await saveUnifiedScore(tdName, constituency, party, scoreData);
  return scoreData;
}

/**
 * Recalculate scores for all TDs
 */
export async function recalculateAllScores(): Promise<{
  processed: number;
  errors: number;
  duration: number;
}> {
  const startTime = Date.now();
  let processed = 0;
  let errors = 0;
  
  console.log('🔄 Starting comprehensive score recalculation for all TDs...');
  
  try {
    // Get list of all TDs (from parliamentary data)
    const allTDs = Object.entries(parliamentaryData).map(([key, data]: [string, any]) => ({
      name: data.fullName || key,
      constituency: data.constituency || 'Unknown',
      party: data.party || null
    }));
    
    console.log(`📋 Found ${allTDs.length} TDs to process`);
    
    for (const td of allTDs) {
      try {
        await recalculateTDScore(td.name, td.constituency, td.party);
        processed++;
        
        // Rate limiting to avoid overwhelming services
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Error processing ${td.name}:`, error);
        errors++;
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Recalculation complete: ${processed} TDs processed, ${errors} errors, ${(duration/1000).toFixed(1)}s`);
    
    return { processed, errors, duration };
    
  } catch (error) {
    console.error('❌ Recalculation failed:', error);
    throw error;
  }
}

