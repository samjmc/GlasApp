/**
 * Debate Ideology Processor Job
 * 
 * Processes unprocessed debate speeches and votes to extract TD ideological positions
 * Runs incrementally as new debates become available
 */

import 'dotenv/config';
import { processUnprocessedDebates } from '../services/debateIdeologyAnalysisService.js';
import { supabaseDb as supabase } from '../db.js';
import { fetchDebatesForDateRange } from '../../scripts/fetch-oireachtas-debate-week.js';

/**
 * Check if we need to fetch new debates first
 */
async function checkIfDebatesNeedFetching(lookbackDays: number = 14): Promise<boolean> {
  if (!supabase) return false;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Check if we have debates from the last few days
  const { data: recentDebates } = await supabase
    .from('debate_days')
    .select('date')
    .gte('date', cutoffDateStr)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // If no recent debates, we need to fetch
  if (!recentDebates?.date) return true;

  const daysSinceLastDebate = Math.floor(
    (new Date().getTime() - new Date(recentDebates.date).getTime()) / (1000 * 60 * 60 * 24)
  );

  // If last debate is more than 3 days old, fetch new ones
  return daysSinceLastDebate > 3;
}

/**
 * Fetch new debates from Oireachtas API
 */
async function fetchNewDebates(lookbackDays: number = 14): Promise<{
  debatesProcessed: number;
  sectionsSaved: number;
  speechesSaved: number;
}> {
  console.log('\n📥 Step 1: Fetching new debates from Oireachtas API...\n');

  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  const startDate = cutoffDate.toISOString().split('T')[0];
  const endDate = today.toISOString().split('T')[0];

  console.log(`   Date range: ${startDate} to ${endDate}`);
  console.log(`   This will fetch debates and save to debate_days, debate_sections, debate_speeches tables\n`);

  try {
    const result = await fetchDebatesForDateRange({
      startDate,
      endDate,
      chamber: 'dail',
      persistToSupabase: true,
    });

    console.log(`\n✅ Debate fetching complete:`);
    console.log(`   Debates processed: ${result.debatesProcessed}`);
    console.log(`   Sections saved: ${result.sectionsSaved}`);
    console.log(`   Speeches saved: ${result.speechesSaved}`);

    return result;
  } catch (error: any) {
    console.error(`\n❌ Error fetching debates: ${error.message}`);
    throw error;
  }
}

async function runDebateIdeologyProcessor() {
  console.log('🎯 Starting Unified Debate Update & Ideology Processor\n');
  console.log('═'.repeat(70));
  console.log('This unified process will:');
  console.log('  1. Fetch new debates from Oireachtas API (updates debates page)');
  console.log('  2. Analyze speeches/votes for TD ideology (updates TD profiles)');
  console.log('📅 Processing last 2 weeks of data\n');
  console.log('═'.repeat(70));
  console.log();

  const batchSize = 50; // Process 50 at a time
  const lookbackDays = 14; // Last 2 weeks only

  // Step 1: Check if debates need fetching and fetch if needed
  const needsFetching = await checkIfDebatesNeedFetching(lookbackDays);
  let fetchStats = { debatesProcessed: 0, sectionsSaved: 0, speechesSaved: 0 };

  if (needsFetching) {
    console.log('📥 Step 1: Fetching new debates...\n');
    try {
      fetchStats = await fetchNewDebates(lookbackDays);
    } catch (error: any) {
      console.error(`\n⚠️  Warning: Failed to fetch debates: ${error.message}`);
      console.log('   Continuing with existing debates in database...\n');
    }
  } else {
    console.log('✅ Step 1: Recent debates already in database, skipping fetch\n');
  }

  // Step 2: Analyze for ideology
  console.log('📊 Step 2: Analyzing debates for ideology scoring...\n');
  let totalProcessed = { speechesProcessed: 0, votesProcessed: 0, errors: 0 };

  try {
    let batch = 1;
    while (true) {
      console.log(`\n📦 Processing batch ${batch}...`);
      
      const stats = await processUnprocessedDebates(batchSize, lookbackDays);
      
      totalProcessed.speechesProcessed += stats.speechesProcessed;
      totalProcessed.votesProcessed += stats.votesProcessed;
      totalProcessed.errors += stats.errors;

      console.log(`   ✅ Speeches processed: ${stats.speechesProcessed}`);
      console.log(`   ✅ Votes processed: ${stats.votesProcessed}`);
      if (stats.errors > 0) {
        console.log(`   ⚠️  Errors: ${stats.errors}`);
      }

      // If we processed fewer than batchSize, we're done
      if (stats.speechesProcessed + stats.votesProcessed < batchSize) {
        break;
      }

      batch++;
      
      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('✅ Unified Debate Update & Ideology Processing Complete!');
    console.log('═'.repeat(70));
    console.log('\n📊 Final Statistics:\n');
    
    if (needsFetching) {
      console.log('📥 Debate Fetching:');
      console.log(`   Debates processed: ${fetchStats.debatesProcessed}`);
      console.log(`   Sections saved: ${fetchStats.sectionsSaved}`);
      console.log(`   Speeches saved: ${fetchStats.speechesSaved}`);
      console.log();
    }
    
    console.log('📊 Ideology Analysis:');
    console.log(`   Speeches analyzed: ${totalProcessed.speechesProcessed}`);
    console.log(`   Votes analyzed: ${totalProcessed.votesProcessed}`);
    console.log(`   Total ideology updates: ${totalProcessed.speechesProcessed + totalProcessed.votesProcessed}`);
    if (totalProcessed.errors > 0) {
      console.log(`   ⚠️  Errors: ${totalProcessed.errors}`);
    }
    console.log('\n' + '═'.repeat(70));

  } catch (error: any) {
    console.error('❌ Error in debate ideology processor:', error.message);
    throw error;
  }
}

// Always run when executed directly
runDebateIdeologyProcessor()
  .then(() => {
    console.log('\n✅ Processor complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Processor failed:', error);
    process.exit(1);
  });

export { runDebateIdeologyProcessor };

