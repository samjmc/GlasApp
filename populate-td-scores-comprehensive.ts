/**
 * Comprehensive TD Score Population
 * 
 * This script does the RIGHT way:
 * 1. AI research of each TD's historical record (tribunals, scandals, achievements)
 * 2. Combines with parliamentary activity data
 * 3. Calculates fair, weighted initial scores
 * 4. Full transparency and audit trail
 * 
 * Expected time: 20-25 minutes for 200 TDs
 * Expected cost: $5-10 in AI API usage
 */

import 'dotenv/config';
import { supabaseDb } from './server/db';
import { HistoricalBaselineService } from './server/services/historicalBaselineService';
import fs from 'fs';
import path from 'path';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Set to true to research ALL TDs (costs $6-10)
  // Set to false to test with limited TDs first
  FULL_RUN: true,
  TEST_LIMIT: 20,  // Test with 20 TDs first (~$1 cost)
  
  // Use both Claude and GPT-4 for cross-checking (costs 2x but higher confidence)
  CROSS_CHECK: false,
  
  // Safety features
  SKIP_EXISTING: true,  // Skip TDs that already have baselines (allows resuming)
  MAX_COST_USD: 15,     // Stop if estimated cost exceeds this (safety limit)
  COST_PER_TD: 0.05,    // Estimated cost per TD ($0.05)
  
  // Component weights for initial score calculation
  WEIGHTS: {
    historical_baseline: 0.50,  // AI research of past record (most important initially)
    parliamentary: 0.30,        // Questions, attendance, etc.
    constituency: 0.10,         // Start with some baseline credit
    public_trust: 0.10          // Start neutral
  }
};

// ============================================
// TYPES
// ============================================

interface TDData {
  fullName: string;
  constituency: string;
  party: string;
  questionsAsked: number;
  oralQuestions: number;
  writtenQuestions: number;
  debates: number;
  votes: number;
  estimatedAttendance: number;
}

interface InitialScore {
  politician_name: string;
  constituency: string;
  party: string;
  
  // Starting ELO scores
  overall_elo: number;
  transparency_elo: number;
  effectiveness_elo: number;
  integrity_elo: number;
  consistency_elo: number;
  constituency_service_elo: number;
  
  // Component breakdowns
  historical_baseline_elo: number;
  parliamentary_elo: number;
  
  // Metadata
  baseline_modifier: number;
  baseline_category: string;
  historical_summary: string;
  confidence: number;
  
  // Stats
  questions_asked: number;
  attendance_percentage: number;
}

// ============================================
// MAIN FUNCTION
// ============================================

async function populateComprehensiveTDScores() {
  console.log('🚀 COMPREHENSIVE TD SCORE POPULATION');
  console.log('=====================================\n');
  
  if (!supabaseDb) {
    console.error('❌ Supabase not connected');
    console.error('   Make sure DATABASE_URL is set in .env');
    process.exit(1);
  }
  
  // Load parliamentary data
  console.log('📊 Loading parliamentary data...');
  const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
  const parliamentaryData: Record<string, TDData> = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  
  const allTDs = Object.values(parliamentaryData);
  let tdsToProcess = CONFIG.FULL_RUN 
    ? allTDs 
    : allTDs.slice(0, CONFIG.TEST_LIMIT);
  
  console.log(`✅ Loaded ${allTDs.length} TDs from parliamentary data`);
  
  // Check for existing baselines (allow resuming if interrupted)
  if (CONFIG.SKIP_EXISTING && CONFIG.FULL_RUN) {
    console.log(`\n🔍 Checking for existing baselines...`);
    const { data: existing } = await supabaseDb
      .from('td_historical_baselines')
      .select('politician_name');
    
    if (existing && existing.length > 0) {
      const existingNames = new Set(existing.map(e => e.politician_name));
      const originalCount = tdsToProcess.length;
      tdsToProcess = tdsToProcess.filter(td => !existingNames.has(td.fullName));
      console.log(`   Found ${existing.length} existing baselines`);
      console.log(`   Will skip ${originalCount - tdsToProcess.length} TDs, process ${tdsToProcess.length} new ones\n`);
    }
  }
  
  console.log(`📋 Processing ${tdsToProcess.length} TDs ${CONFIG.FULL_RUN ? '(FULL RUN)' : '(TEST RUN)'}\n`);
  
  // Cost safety check
  const estimatedCost = tdsToProcess.length * CONFIG.COST_PER_TD;
  console.log(`💰 Estimated API cost: $${estimatedCost.toFixed(2)}`);
  if (estimatedCost > CONFIG.MAX_COST_USD) {
    console.error(`\n⚠️  ERROR: Estimated cost ($${estimatedCost.toFixed(2)}) exceeds safety limit ($${CONFIG.MAX_COST_USD})`);
    console.error(`   Increase CONFIG.MAX_COST_USD if you want to proceed\n`);
    process.exit(1);
  }
  console.log(`   Safety limit: $${CONFIG.MAX_COST_USD.toFixed(2)} ✅\n`);
  
  if (!CONFIG.FULL_RUN) {
    console.log('⚠️  TEST MODE: Only processing first 5 TDs');
    console.log('   Set CONFIG.FULL_RUN = true to process all TDs\n');
  }
  
  // Confirm before starting (full run only)
  if (CONFIG.FULL_RUN) {
    console.log('⚠️  FULL RUN WILL:');
    console.log(`   - Research ${tdsToProcess.length} TDs using AI`);
    console.log(`   - Take approximately 20-25 minutes`);
    console.log(`   - Cost approximately $${CONFIG.CROSS_CHECK ? '10-20' : '5-10'} in AI API usage`);
    console.log('\n   Press Ctrl+C to cancel, or wait 10 seconds to proceed...\n');
    await sleep(10000);
  }
  
  console.log('🔬 Starting TD research and scoring...\n');
  console.log('═'.repeat(80));
  
  const results: InitialScore[] = [];
  const errors: Array<{td: string, error: string}> = [];
  let created = 0;
  let skipped = 0;
  
  for (let i = 0; i < tdsToProcess.length; i++) {
    const td = tdsToProcess[i];
    const tdName = td.fullName;
    
    console.log(`\n[${ i + 1}/${tdsToProcess.length}] ${tdName}`);
    console.log('─'.repeat(80));
    
    try {
      // STEP 1: Research historical baseline using AI
      console.log('🔍 Step 1: Researching historical record...');
      const baseline = await HistoricalBaselineService.researchTDBaseline(
        tdName,
        td.constituency || 'Unknown',
        td.party || 'Unknown',
        { crossCheck: CONFIG.CROSS_CHECK }
      );
      
      console.log(`   ✅ Baseline: ${baseline.baseline_modifier}x (${baseline.category})`);
      console.log(`   📝 ${baseline.historical_summary.substring(0, 120)}...`);
      
      // STEP 2: Calculate parliamentary component
      console.log('\n📊 Step 2: Calculating parliamentary performance...');
      const parliamentaryScore = calculateParliamentaryScore(td);
      console.log(`   ✅ Parliamentary ELO: ${parliamentaryScore.elo}`);
      console.log(`   📈 Questions: ${td.questionsAsked}, Attendance: ${td.estimatedAttendance}%`);
      
      // STEP 3: Combine into weighted initial score
      console.log('\n🎯 Step 3: Calculating weighted initial scores...');
      const initialScore = calculateInitialScore(td, baseline, parliamentaryScore);
      console.log(`   ✅ Overall ELO: ${initialScore.overall_elo}`);
      console.log(`   📊 Breakdown:`);
      console.log(`      - Historical baseline: ${initialScore.historical_baseline_elo} (${(CONFIG.WEIGHTS.historical_baseline * 100).toFixed(0)}%)`);
      console.log(`      - Parliamentary: ${initialScore.parliamentary_elo} (${(CONFIG.WEIGHTS.parliamentary * 100).toFixed(0)}%)`);
      console.log(`      - Transparency: ${initialScore.transparency_elo}`);
      console.log(`      - Effectiveness: ${initialScore.effectiveness_elo}`);
      console.log(`      - Integrity: ${initialScore.integrity_elo}`);
      console.log(`      - Consistency: ${initialScore.consistency_elo}`);
      console.log(`      - Constituency Service: ${initialScore.constituency_service_elo}`);
      
      // STEP 4: Save to database
      console.log('\n💾 Step 4: Saving to database...');
      
      // Save to td_scores table
      const { error: scoreError } = await supabaseDb
        .from('td_scores')
        .upsert({
          politician_name: tdName,
          constituency: td.constituency || 'Unknown',
          party: td.party || 'Unknown',
          
          // ELO scores
          overall_elo: initialScore.overall_elo,
          transparency_elo: initialScore.transparency_elo,
          effectiveness_elo: initialScore.effectiveness_elo,
          integrity_elo: initialScore.integrity_elo,
          consistency_elo: initialScore.consistency_elo,
          constituency_service_elo: initialScore.constituency_service_elo,
          
          // Stats
          total_stories: 0,
          positive_stories: 0,
          negative_stories: 0,
          neutral_stories: 0,
          questions_asked: td.questionsAsked || 0,
          attendance_percentage: td.estimatedAttendance || 0,
          
          // Metadata
          baseline_modifier: baseline.baseline_modifier,
          historical_summary: baseline.historical_summary,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'politician_name'
        });
      
      if (scoreError) {
        throw new Error(`Database error: ${scoreError.message}`);
      }
      
      console.log('   ✅ Saved to td_scores table');
      
      results.push(initialScore);
      created++;
      
      // Progress summary every 10 TDs
      if ((i + 1) % 10 === 0 || i === tdsToProcess.length - 1) {
        console.log('\n' + '═'.repeat(80));
        console.log(`📊 PROGRESS: ${i + 1}/${tdsToProcess.length} TDs processed`);
        console.log(`   ✅ Created: ${created}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   ❌ Errors: ${errors.length}`);
        if (results.length > 0) {
          const avgElo = results.reduce((sum, r) => sum + r.overall_elo, 0) / results.length;
          console.log(`   📈 Average ELO: ${avgElo.toFixed(0)}`);
        }
        console.log('═'.repeat(80));
      }
      
      // Rate limiting - be kind to AI APIs
      if (i < tdsToProcess.length - 1) {
        console.log('\n⏳ Waiting 3 seconds before next TD...');
        await sleep(3000);
      }
      
    } catch (error: any) {
      console.error(`\n❌ ERROR processing ${tdName}:`);
      console.error(`   ${error.message}`);
      errors.push({ td: tdName, error: error.message });
      
      // Check for API limit errors
      if (error.message.includes('429') || 
          error.message.includes('quota') || 
          error.message.includes('rate limit') ||
          error.message.includes('insufficient_quota')) {
        console.error(`\n🛑 API LIMIT HIT! Stopping gracefully...`);
        console.error(`   Progress saved: ${created} TDs completed`);
        console.error(`   You can resume by running this script again`);
        console.error(`   (It will skip TDs that already have baselines)\n`);
        break; // Exit the loop gracefully
      }
      
      // On error, create neutral baseline
      try {
        const { error: fallbackError } = await supabaseDb
          .from('td_scores')
          .upsert({
            politician_name: tdName,
            constituency: td.constituency || 'Unknown',
            party: td.party || 'Unknown',
            overall_elo: 1500,
            transparency_elo: 1500,
            effectiveness_elo: 1500,
            integrity_elo: 1500,
            consistency_elo: 1500,
            constituency_service_elo: 1500,
            total_stories: 0,
            positive_stories: 0,
            negative_stories: 0,
            neutral_stories: 0,
            baseline_modifier: 1.00,
            historical_summary: 'Error during research - neutral baseline assigned',
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'politician_name'
          });
        
        if (!fallbackError) {
          console.log('   ⚠️  Assigned neutral baseline (1500 ELO) as fallback');
          skipped++;
        }
      } catch (fallbackError) {
        console.error('   ❌ Failed to save fallback score');
      }
    }
  }
  
  // ============================================
  // FINAL SUMMARY
  // ============================================
  
  console.log('\n\n');
  console.log('🎉 COMPREHENSIVE TD SCORE POPULATION COMPLETE!');
  console.log('═'.repeat(80));
  console.log(`\n📊 FINAL STATISTICS:\n`);
  console.log(`   Total TDs processed:     ${tdsToProcess.length}`);
  console.log(`   ✅ Successfully created:  ${created}`);
  console.log(`   ⏭️  Skipped (errors):      ${skipped}`);
  console.log(`   ❌ Total errors:          ${errors.length}`);
  
  if (results.length > 0) {
    console.log(`\n📈 SCORE STATISTICS:\n`);
    
    const elos = results.map(r => r.overall_elo);
    const avgElo = elos.reduce((sum, elo) => sum + elo, 0) / elos.length;
    const minElo = Math.min(...elos);
    const maxElo = Math.max(...elos);
    
    console.log(`   Average Overall ELO:     ${avgElo.toFixed(0)}`);
    console.log(`   Range:                   ${minElo} - ${maxElo}`);
    console.log(`   Standard Deviation:      ${calculateStdDev(elos).toFixed(0)}`);
    
    // Show distribution
    const excellent = results.filter(r => r.overall_elo >= 1700).length;
    const good = results.filter(r => r.overall_elo >= 1550 && r.overall_elo < 1700).length;
    const average = results.filter(r => r.overall_elo >= 1400 && r.overall_elo < 1550).length;
    const belowAvg = results.filter(r => r.overall_elo >= 1250 && r.overall_elo < 1400).length;
    const poor = results.filter(r => r.overall_elo < 1250).length;
    
    console.log(`\n📊 SCORE DISTRIBUTION:\n`);
    console.log(`   Excellent (1700+):       ${excellent} TDs`);
    console.log(`   Good (1550-1699):        ${good} TDs`);
    console.log(`   Average (1400-1549):     ${average} TDs`);
    console.log(`   Below Average (1250-1399): ${belowAvg} TDs`);
    console.log(`   Poor (<1250):            ${poor} TDs`);
    
    // Show top 5 and bottom 5
    const sorted = [...results].sort((a, b) => b.overall_elo - a.overall_elo);
    
    console.log(`\n🏆 TOP 5 HIGHEST SCORES:\n`);
    sorted.slice(0, 5).forEach((td, i) => {
      console.log(`   ${i + 1}. ${td.politician_name} - ${td.overall_elo} ELO`);
      console.log(`      ${td.baseline_category} | ${td.party}`);
    });
    
    console.log(`\n📉 BOTTOM 5 SCORES:\n`);
    sorted.slice(-5).reverse().forEach((td, i) => {
      console.log(`   ${i + 1}. ${td.politician_name} - ${td.overall_elo} ELO`);
      console.log(`      ${td.baseline_category} | ${td.party}`);
    });
  }
  
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS ENCOUNTERED:\n`);
    errors.forEach(({ td, error }) => {
      console.log(`   - ${td}: ${error}`);
    });
  }
  
  console.log(`\n✨ NEXT STEPS:\n`);
  console.log(`   1. Review the scores above - do they seem fair?`);
  console.log(`   2. Check a few specific TDs in the database`);
  console.log(`   3. Look at the historical baselines in td_historical_baselines table`);
  console.log(`   4. Start your server and view TD profiles!`);
  console.log(`   5. News scraper will update scores automatically going forward\n`);
  
  if (!CONFIG.FULL_RUN) {
    console.log(`⚠️  REMEMBER: This was a TEST RUN (only ${CONFIG.TEST_LIMIT} TDs)`);
    console.log(`   Set CONFIG.FULL_RUN = true to process all ${allTDs.length} TDs\n`);
  }
  
  console.log('═'.repeat(80));
  console.log('✅ DONE!\n');
}

// ============================================
// SCORING FUNCTIONS
// ============================================

function calculateParliamentaryScore(td: TDData): { elo: number, score: number } {
  // Component 1: Questions asked (primary metric of engagement)
  // Top quartile: 200+ questions = 100
  // Average: 80 questions = 50
  // Bottom: <20 questions = 10
  const questionsScore = Math.min(100, Math.max(0, (td.questionsAsked / 200) * 100));
  
  // Component 2: Attendance
  const attendanceScore = td.estimatedAttendance || 0;
  
  // Weighted combination: Questions 60%, Attendance 40%
  const combinedScore = (questionsScore * 0.6) + (attendanceScore * 0.4);
  
  // Convert to ELO scale (1300-1700 range)
  // 0 score = 1300, 50 score = 1500, 100 score = 1700
  const elo = Math.round(1300 + (combinedScore / 100) * 400);
  
  return { elo, score: combinedScore };
}

function calculateInitialScore(
  td: TDData,
  baseline: any,
  parliamentary: { elo: number, score: number }
): InitialScore {
  
  // Base ELO from historical baseline
  // Baseline modifier ranges from 0.5 to 1.3
  // 0.5 = 750 ELO (severe issues)
  // 1.0 = 1500 ELO (neutral)
  // 1.3 = 1950 ELO (exceptional), capped at 1800
  const historicalBaselineElo = Math.min(1800, Math.round(1500 * baseline.baseline_modifier));
  
  // Parliamentary ELO
  const parliamentaryElo = parliamentary.elo;
  
  // Constituency service - start at neutral with slight bonus for established TDs
  const constituencyElo = 1500;
  
  // Public trust - start at neutral
  const publicTrustElo = 1500;
  
  // Weighted overall ELO
  const overallElo = Math.round(
    historicalBaselineElo * CONFIG.WEIGHTS.historical_baseline +
    parliamentaryElo * CONFIG.WEIGHTS.parliamentary +
    constituencyElo * CONFIG.WEIGHTS.constituency +
    publicTrustElo * CONFIG.WEIGHTS.public_trust
  );
  
  // Dimensional scores - influenced by both baseline and parliamentary
  // Integrity is heavily influenced by historical baseline
  const integrityElo = Math.round(
    historicalBaselineElo * 0.8 + parliamentaryElo * 0.2
  );
  
  // Effectiveness is heavily influenced by parliamentary work
  const effectivenessElo = Math.round(
    parliamentaryElo * 0.7 + historicalBaselineElo * 0.3
  );
  
  // Transparency - combination of both
  const transparencyElo = Math.round(
    historicalBaselineElo * 0.5 + parliamentaryElo * 0.5
  );
  
  // Consistency - start near overall
  const consistencyElo = Math.round(overallElo * 0.95);
  
  // Constituency service - use constituency ELO
  const constituencyServiceElo = constituencyElo;
  
  return {
    politician_name: td.fullName,
    constituency: td.constituency || 'Unknown',
    party: td.party || 'Unknown',
    
    overall_elo: overallElo,
    transparency_elo: transparencyElo,
    effectiveness_elo: effectivenessElo,
    integrity_elo: integrityElo,
    consistency_elo: consistencyElo,
    constituency_service_elo: constituencyServiceElo,
    
    historical_baseline_elo: historicalBaselineElo,
    parliamentary_elo: parliamentaryElo,
    
    baseline_modifier: baseline.baseline_modifier,
    baseline_category: baseline.category,
    historical_summary: baseline.historical_summary,
    confidence: baseline.confidence,
    
    questions_asked: td.questionsAsked || 0,
    attendance_percentage: td.estimatedAttendance || 0
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateStdDev(values: number[]): number {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(val => Math.pow(val - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

// ============================================
// RUN IT
// ============================================

populateComprehensiveTDScores()
  .then(() => {
    console.log('✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

