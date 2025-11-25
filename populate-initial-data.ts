/**
 * POPULATE INITIAL DATA
 * Fetches parliamentary data and calculates initial scores
 * Run with: npx tsx populate-initial-data.ts
 */

console.log('🚀 POPULATING INITIAL DATA');
console.log('═══════════════════════════════════════════════════════\n');

const BASE_URL = 'http://localhost:5000';

async function populateData() {
  console.log('This script will:');
  console.log('1. Fetch parliamentary data from Oireachtas API (15-20 min)');
  console.log('2. Calculate initial unified scores (2-3 min)');
  console.log('3. Verify data is ready for users\n');
  
  // Step 1: Fetch parliamentary data
  console.log('📊 STEP 1: Fetching Parliamentary Data');
  console.log('───────────────────────────────────────────────────────');
  console.log('⏳ This will take 15-20 minutes...');
  console.log('   Fetching data for all 200 TDs from Oireachtas API\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/parliamentary/update`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Parliamentary data update started in background\n');
      console.log('💡 You can check progress by watching server logs');
      console.log('   Look for messages like: "✅ [1/200] Micheál Martin"\n');
      
      // Wait a bit then check if it's making progress
      console.log('⏳ Waiting 60 seconds to check initial progress...\n');
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      // Check if we have any data yet
      const checkResponse = await fetch(`${BASE_URL}/api/admin/parliamentary/members`);
      const checkData = await checkResponse.json();
      
      if (checkData.success && checkData.total > 0) {
        console.log(`✅ Progress check: ${checkData.total} TDs discovered\n`);
      }
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('⏳ PARLIAMENTARY DATA COLLECTION IN PROGRESS');
      console.log('═══════════════════════════════════════════════════════\n');
      console.log('The system is now collecting data in the background.');
      console.log('\nTo continue:');
      console.log('1. Wait ~15 minutes for data collection to complete');
      console.log('2. Run: npx tsx test-end-user-flow.ts');
      console.log('3. Or manually trigger score calculation:\n');
      console.log('   curl -X POST http://localhost:5000/api/parliamentary/scores/recalculate\n');
      
      return true;
    } else {
      console.log('❌ Failed to start parliamentary update');
      console.log(`   Error: ${JSON.stringify(data)}\n`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;
  }
}

// Quick mode: Just trigger and return
async function quickMode() {
  console.log('🚀 QUICK MODE: Triggering Data Collection');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Trigger parliamentary update
    console.log('📊 Triggering parliamentary data fetch...');
    const parlResponse = await fetch(`${BASE_URL}/api/admin/parliamentary/update`, {
      method: 'POST'
    });
    const parlData = await parlResponse.json();
    
    if (parlData.success) {
      console.log('✅ Parliamentary update started (background)');
      console.log(`   Estimated time: ${parlData.estimated_duration}\n`);
    } else {
      console.log('❌ Failed to start parliamentary update\n');
    }
    
    // Trigger score calculation (will calculate for existing data)
    console.log('📈 Triggering score calculation...');
    const scoreResponse = await fetch(`${BASE_URL}/api/parliamentary/scores/recalculate`, {
      method: 'POST'
    });
    const scoreData = await scoreResponse.json();
    
    if (scoreData.success) {
      console.log('✅ Score calculation started (background)');
      console.log(`   Estimated time: ${scoreData.estimated_duration || '2-5 minutes'}\n`);
    } else {
      console.log('❌ Failed to start score calculation\n');
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ DATA COLLECTION JOBS STARTED');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Background jobs are running. Check server logs for progress.\n');
    console.log('To test immediately with sample data:');
    console.log('  npx tsx test-end-user-flow.ts\n');
    console.log('Or wait 15-20 minutes for full data, then test again.\n');
    
    return true;
  } catch (error: any) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;
  }
}

// Check server
(async () => {
  try {
    const response = await fetch(`${BASE_URL}/api/cache/stats`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.log('❌ Server not running\n');
      console.log('Please start the server:');
      console.log('  npm run dev\n');
      process.exit(1);
    }
    
    // Check if we should run quick mode or full mode
    const args = process.argv.slice(2);
    
    if (args.includes('--wait')) {
      await populateData();
    } else {
      await quickMode();
    }
    
    process.exit(0);
    
  } catch (error: any) {
    console.log('❌ Cannot connect to server\n');
    console.log('Please start the server:');
    console.log('  npm run dev\n');
    process.exit(1);
  }
})();

