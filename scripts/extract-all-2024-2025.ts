/**
 * Extract ALL Data for 2024-2025
 * Questions, Votes, Debates, and Legislation
 */

import 'dotenv/config';
import { execSync } from 'child_process';

async function extractAll() {
  console.log('🚀 EXTRACTING ALL 2024-2025 PARLIAMENTARY DATA');
  console.log('═'.repeat(70));
  console.log('This will extract:');
  console.log('1. Questions (already done - 11,308 ✅)');
  console.log('2. Votes (all Dáil divisions)');
  console.log('3. Debates (all debate participations)');
  console.log('4. Legislation (all bills sponsored)');
  console.log('');
  console.log('⏱️  Estimated time: 20-30 minutes for remaining 3');
  console.log('═'.repeat(70));
  console.log('');

  const startTime = Date.now();

  try {
    // Step 1: Questions (already done, skip)
    console.log('✅ STEP 1: Questions extraction already complete (11,308 questions)\n');

    // Step 2: Votes
    console.log('🗳️  STEP 2: Extracting Votes...');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/extract-votes-2024-2025.ts', { stdio: 'inherit' });
    console.log('✅ Votes extraction complete\n');

    // Step 3: Debates
    console.log('💭 STEP 3: Extracting Debates...');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/extract-debates-2024-2025.ts', { stdio: 'inherit' });
    console.log('✅ Debates extraction complete\n');

    // Step 4: Legislation
    console.log('📜 STEP 4: Extracting Legislation...');
    console.log('─'.repeat(70));
    execSync('npx tsx scripts/extract-legislation-2024-2025.ts', { stdio: 'inherit' });
    console.log('✅ Legislation extraction complete\n');

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000 / 60);

    console.log('\n' + '═'.repeat(70));
    console.log('🎉 ALL EXTRACTIONS COMPLETE!');
    console.log('═'.repeat(70));
    console.log(`Total time: ${duration} minutes`);
    console.log('');
    console.log('✅ Questions extracted (2024-2025)');
    console.log('✅ Votes extracted (2024-2025)');
    console.log('✅ Debates extracted (2024-2025)');
    console.log('✅ Legislation extracted (2020-2025)');
    console.log('═'.repeat(70));
    console.log('');
    console.log('🌐 Refresh your browser to see the data on TD profiles!');
    console.log('');

  } catch (error: unknown) {
    console.error('\n❌ EXTRACTION FAILED:', error.message);
    console.error('Check the logs above to see which step failed');
    process.exit(1);
  }
}

extractAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

