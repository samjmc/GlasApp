/**
 * Test Unified TD Scoring
 * Calculate scores for TDs mentioned in news articles
 */

import dotenv from 'dotenv';

// Load environment FIRST before any imports
dotenv.config();

// Set env vars that the service needs
process.env.SUPABASE_URL = process.env.SUPABASE_URL || '';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

import { UnifiedTDScoringService } from '../server/services/unifiedTDScoringService.ts';

async function testScoring() {
  console.log('\n🧪 Testing Unified TD Scoring System...\n');
  
  try {
    // Recalculate all TD scores
    const results = await UnifiedTDScoringService.recalculateAllTDScores();
    
    console.log(`\n✅ Scoring complete!`);
    console.log(`   Processed: ${results.processed} TDs`);
    console.log(`   Errors: ${results.errors}\n`);
    
    // Get top 10 TDs
    console.log('🏆 Top 10 TDs by Overall ELO:\n');
    const topTDs = await UnifiedTDScoringService.getTopTDs(10);
    
    topTDs.forEach((td, i) => {
      console.log(`${i + 1}. ${td.politician_name}`);
      console.log(`   Overall ELO: ${td.overall_elo}`);
      console.log(`   News: ${td.news_elo} | Parliamentary: ${td.parliamentary_elo}`);
      console.log(`   Articles: ${td.total_stories} | Questions: ${td.questions_asked}`);
      console.log(`   Confidence: ${Math.round(td.confidence_score * 100)}%\n`);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testScoring();

