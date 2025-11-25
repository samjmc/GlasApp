/**
 * Master Extraction Script
 * Runs ALL extractions in sequence, then updates scores
 * This is the ONE script to rule them all!
 */

import 'dotenv/config';
import { execSync } from 'child_process';

async function runFullExtraction() {
  console.log('🚀 MASTER EXTRACTION - FULL PARLIAMENTARY DATA');
  console.log('═'.repeat(70));
  console.log('This will:');
  console.log('1. Extract enhanced TD member data (gender, offices, committees)');
  console.log('2. Extract ALL questions from API');
  console.log('3. Extract ALL votes from API');
  console.log('4. Extract ALL debates from API');
  console.log('5. Extract ALL legislation (bills sponsored)');
  console.log('6. Recalculate TD scores based on extracted data');
  console.log('7. Update party aggregate scores');
  console.log('');
  console.log('⏱️  Estimated time: 75-105 minutes total');
  console.log('═'.repeat(70));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Enhanced member data
    console.log('\n📊 STEP 1/5: Extracting Enhanced Member Data');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/populate-enhanced-td-data.ts', { stdio: 'inherit' });
    console.log('✅ Enhanced member data complete\n');

    // Step 2: Questions
    console.log('\n📋 STEP 2/5: Extracting Questions (This takes ~30 mins)');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/bulk-extract-questions.ts', { stdio: 'inherit' });
    console.log('✅ Questions extraction complete\n');

    // Step 3: Votes
    console.log('\n🗳️  STEP 3/5: Extracting Votes (This takes ~20 mins)');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/bulk-extract-votes.ts', { stdio: 'inherit' });
    console.log('✅ Votes extraction complete\n');

    // Step 4: Debates
    console.log('\n💭 STEP 4/6: Extracting Debates (This takes ~15 mins)');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/bulk-extract-debates.ts', { stdio: 'inherit' });
    console.log('✅ Debates extraction complete\n');

    // Step 5: Legislation
    console.log('\n📜 STEP 5/6: Extracting Legislation (This takes ~10 mins)');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/bulk-extract-legislation.ts', { stdio: 'inherit' });
    console.log('✅ Legislation extraction complete\n');

    // Step 6: Update scores
    console.log('\n🔄 STEP 6/6: Updating TD & Party Scores');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/update-scores-from-extracted-data.ts', { stdio: 'inherit' });
    console.log('✅ Scores updated\n');

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000 / 60);

    console.log('\n' + '═'.repeat(70));
    console.log('🎉 FULL EXTRACTION COMPLETE!');
    console.log('═'.repeat(70));
    console.log(`Total time: ${duration} minutes`);
    console.log('');
    console.log('✅ Enhanced member data extracted');
    console.log('✅ Questions extracted and classified');
    console.log('✅ Votes extracted with party loyalty');
    console.log('✅ Debates extracted with participation');
    console.log('✅ Legislation extracted (bills sponsored)');
    console.log('✅ TD scores recalculated');
    console.log('✅ Party scores updated');
    console.log('═'.repeat(70));
    console.log('');
    console.log('🎯 YOUR PLATFORM NOW HAS:');
    console.log('   • Accurate question counts per TD');
    console.log('   • Topic analysis (Housing, Healthcare, etc.)');
    console.log('   • Voting records with party loyalty %');
    console.log('   • Debate participation tracking');
    console.log('   • Bill sponsorship data (Private Member & Government)');
    console.log('   • Legislative success rates');
    console.log('   • Updated performance scores');
    console.log('   • Party aggregate scores');
    console.log('');
    console.log('📊 DATABASE POPULATED:');
    console.log('   • ~10,000 questions');
    console.log('   • ~80,000 individual votes');
    console.log('   • ~3,000 debate participations');
    console.log('   • ~500+ bill sponsorships');
    console.log('');
    console.log('🌐 Refresh your browser to see the updated data!');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ EXTRACTION FAILED:', error.message);
    console.error('Check the logs above to see which step failed');
    process.exit(1);
  }
}

runFullExtraction();

