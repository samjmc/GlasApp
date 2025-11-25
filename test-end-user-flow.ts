/**
 * END-USER FLOW TEST
 * Tests the complete user experience
 * Run with: npx tsx test-end-user-flow.ts
 */

const BASE_URL = 'http://localhost:5000';

console.log('👤 TESTING END-USER EXPERIENCE');
console.log('═══════════════════════════════════════════════════════\n');

async function testUserFlow() {
  const results: any = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Test 1: User visits homepage - check if TDs are listed
  console.log('📋 TEST 1: View TD Leaderboard');
  console.log('───────────────────────────────────────────────────────');
  try {
    const response = await fetch(`${BASE_URL}/api/parliamentary/scores/widget`);
    const data = await response.json();
    
    const tds = data.top_performers || data.top_tds || [];
    
    if (data.success && tds.length > 0) {
      console.log(`✅ PASS: ${tds.length} TDs available`);
      console.log(`   Top TD: ${tds[0].name || tds[0].politician_name} (Rank: ${tds[0].rank})`);
      results.passed++;
      results.tests.push({ name: 'View Leaderboard', status: 'pass' });
    } else {
      console.log('❌ FAIL: No TDs found');
      console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
      results.failed++;
      results.tests.push({ name: 'View Leaderboard', status: 'fail' });
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'View Leaderboard', status: 'fail' });
  }
  console.log();
  
  // Test 2: User clicks on a TD - view profile
  console.log('👤 TEST 2: View TD Profile');
  console.log('───────────────────────────────────────────────────────');
  try {
    const testTD = 'Mary Lou McDonald'; // Use a TD that actually exists in our data
    const response = await fetch(`${BASE_URL}/api/parliamentary/scores/td/${encodeURIComponent(testTD)}`);
    const data = await response.json();
    
    const tdData = data.score || data.td;
    
    if (data.success && tdData) {
      console.log(`✅ PASS: Profile loaded for ${testTD}`);
      console.log(`   Name: ${tdData.name || tdData.politician_name}`);
      console.log(`   Overall Score: ${tdData.overall_score || tdData.legacy_elo?.overall || 'N/A'}`);
      console.log(`   Rank: ${tdData.national_rank || tdData.ranks?.national || 'N/A'}`);
      results.passed++;
      results.tests.push({ name: 'View TD Profile', status: 'pass' });
    } else {
      console.log(`❌ FAIL: Could not load profile`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
      results.failed++;
      results.tests.push({ name: 'View TD Profile', status: 'fail' });
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'View TD Profile', status: 'fail' });
  }
  console.log();
  
  // Test 3: User submits a rating
  console.log('⭐ TEST 3: Submit TD Rating');
  console.log('───────────────────────────────────────────────────────');
  try {
    const ratingData = {
      tdName: 'Test TD for Automated Test',
      transparency: 75,
      effectiveness: 80,
      integrity: 85,
      consistency: 70,
      constituencyService: 65,
      comment: 'This is an automated test rating'
    };
    
    const response = await fetch(`${BASE_URL}/api/ratings/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ratingData)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      console.log('✅ PASS: Rating submitted successfully');
      console.log(`   Rating ID: ${data.rating_id}`);
      results.passed++;
      results.tests.push({ name: 'Submit Rating', status: 'pass' });
      
      // Test 3b: Retrieve the rating
      console.log('\n📊 TEST 3b: Retrieve Submitted Rating');
      console.log('───────────────────────────────────────────────────────');
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for DB
      
      const getResponse = await fetch(`${BASE_URL}/api/ratings/td/${encodeURIComponent(ratingData.tdName)}`);
      const getRatingData = await getResponse.json();
      
      if (getRatingData.success && getRatingData.total_ratings > 0) {
        console.log('✅ PASS: Rating retrieved successfully');
        console.log(`   Total Ratings: ${getRatingData.total_ratings}`);
        console.log(`   Average Transparency: ${getRatingData.averages.transparency}`);
        console.log(`   Average Effectiveness: ${getRatingData.averages.effectiveness}`);
        results.passed++;
        results.tests.push({ name: 'Retrieve Rating', status: 'pass' });
      } else {
        console.log('❌ FAIL: Could not retrieve rating');
        results.failed++;
        results.tests.push({ name: 'Retrieve Rating', status: 'fail' });
      }
    } else {
      console.log(`❌ FAIL: ${data.message || 'Unknown error'}`);
      console.log(`   Response: ${JSON.stringify(data)}`);
      results.failed++;
      results.tests.push({ name: 'Submit Rating', status: 'fail' });
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Submit Rating', status: 'fail' });
  }
  console.log();
  
  // Test 4: User browses news about a TD
  console.log('📰 TEST 4: View News About TDs');
  console.log('───────────────────────────────────────────────────────');
  try {
    const response = await fetch(`${BASE_URL}/api/admin/news-scraper/stats`);
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ PASS: News stats available');
      console.log(`   Total Articles: ${data.stats?.total_articles || 0}`);
      console.log(`   TDs with Scores: ${data.stats?.tds_with_scores || 0}`);
      results.passed++;
      results.tests.push({ name: 'View News', status: 'pass' });
    } else {
      console.log('❌ FAIL: Could not get news stats');
      results.failed++;
      results.tests.push({ name: 'View News', status: 'fail' });
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'View News', status: 'fail' });
  }
  console.log();
  
  // Test 5: User compares TDs
  console.log('🔍 TEST 5: Compare Multiple TDs');
  console.log('───────────────────────────────────────────────────────');
  try {
    const response = await fetch(`${BASE_URL}/api/parliamentary/scores/all`);
    const data = await response.json();
    
    if (data.success && data.scores && data.scores.length > 1) {
      console.log(`✅ PASS: Can compare ${data.scores.length} TDs`);
      console.log('   Sample comparison:');
      data.scores.slice(0, 3).forEach((td: any) => {
        console.log(`   - ${td.politician_name}: ${td.overall_score || td.overall_elo || 'N/A'}`);
      });
      results.passed++;
      results.tests.push({ name: 'Compare TDs', status: 'pass' });
    } else {
      console.log('❌ FAIL: Not enough TDs to compare');
      results.failed++;
      results.tests.push({ name: 'Compare TDs', status: 'fail' });
    }
  } catch (error: any) {
    console.log(`❌ FAIL: ${error.message}`);
    results.failed++;
    results.tests.push({ name: 'Compare TDs', status: 'fail' });
  }
  console.log();
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 END-USER FLOW TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const total = results.passed + results.failed;
  const percentage = Math.round((results.passed / total) * 100);
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${percentage}%\n`);
  
  console.log('Test Details:');
  console.log('───────────────────────────────────────────────────────');
  results.tests.forEach((test: any) => {
    console.log(`${test.status === 'pass' ? '✅' : '❌'} ${test.name}`);
  });
  console.log();
  
  if (results.failed === 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 ALL END-USER FLOWS WORKING!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Users can:');
    console.log('✅ View TD leaderboards');
    console.log('✅ View individual TD profiles');
    console.log('✅ Submit ratings');
    console.log('✅ See their ratings reflected');
    console.log('✅ Browse news about TDs');
    console.log('✅ Compare multiple TDs');
    console.log('\n🚀 System is FULLY OPERATIONAL for end users!\n');
    return true;
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️ SOME USER FLOWS NOT WORKING');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Please check the failed tests above.\n');
    return false;
  }
}

// Run test
(async () => {
  console.log('🔍 Checking if server is running...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/cache/stats`, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.log('❌ Server is not responding\n');
      console.log('Please start the server:');
      console.log('  npm run dev\n');
      process.exit(1);
    }
    
    console.log('✅ Server is running!\n');
    
    const success = await testUserFlow();
    process.exit(success ? 0 : 1);
    
  } catch (error: any) {
    console.log('❌ Cannot connect to server\n');
    console.log('Please start the server:');
    console.log('  npm run dev\n');
    process.exit(1);
  }
})();

