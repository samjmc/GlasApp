/**
 * INTEGRATION TEST - Data Collection System
 * Tests all endpoints with real server
 * Run with: npx tsx integration-test.ts
 */

console.log('🧪 INTEGRATION TEST - DATA COLLECTION SYSTEM\n');
console.log('Testing all endpoints with live server on http://localhost:5000\n');

const BASE_URL = 'http://localhost:5000';

async function testEndpoint(method: string, path: string, description: string, body?: any): Promise<boolean> {
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();
    
    if (response.ok && data.success !== false) {
      console.log(`✅ ${description}`);
      return true;
    } else {
      console.log(`❌ ${description} - Status: ${response.status}`);
      console.log(`   Response: ${JSON.stringify(data).substring(0, 100)}`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ ${description} - Error: ${error.message}`);
    return false;
  }
}

async function runIntegrationTests() {
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📡 TESTING API ENDPOINTS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const results: Record<string, boolean> = {};
  
  // Test 1: News Scraper Endpoints
  console.log('📰 NEWS SCRAPER ENDPOINTS:');
  console.log('───────────────────────────────────────────────────────');
  results['news_test'] = await testEndpoint(
    'POST',
    '/api/admin/news-scraper/test',
    'Test news scraper (single source)'
  );
  
  results['news_stats'] = await testEndpoint(
    'GET',
    '/api/admin/news-scraper/stats',
    'Get news scraper statistics'
  );
  console.log();
  
  // Test 2: Parliamentary Endpoints
  console.log('🏛️ PARLIAMENTARY ENDPOINTS:');
  console.log('───────────────────────────────────────────────────────');
  results['parl_members'] = await testEndpoint(
    'GET',
    '/api/admin/parliamentary/members',
    'Get all current TDs from Oireachtas API'
  );
  
  results['parl_test'] = await testEndpoint(
    'GET',
    '/api/admin/parliamentary/test-member/Martin',
    'Test member data fetch (Martin)'
  );
  console.log();
  
  // Test 3: TD Scores Endpoints
  console.log('📊 TD SCORES ENDPOINTS:');
  console.log('───────────────────────────────────────────────────────');
  results['scores_widget'] = await testEndpoint(
    'GET',
    '/api/parliamentary/scores/widget',
    'Get top TDs widget data'
  );
  
  results['scores_all'] = await testEndpoint(
    'GET',
    '/api/parliamentary/scores/all',
    'Get all TD scores'
  );
  console.log();
  
  // Test 4: Ratings Endpoints
  console.log('⭐ USER RATINGS ENDPOINTS:');
  console.log('───────────────────────────────────────────────────────');
  results['ratings_stats'] = await testEndpoint(
    'GET',
    '/api/ratings/stats',
    'Get overall rating statistics'
  );
  
  results['ratings_td'] = await testEndpoint(
    'GET',
    '/api/ratings/td/Micheál Martin',
    'Get ratings for specific TD'
  );
  console.log();
  
  // Test 5: Cache Endpoints
  console.log('💾 CACHE ENDPOINTS:');
  console.log('───────────────────────────────────────────────────────');
  results['cache_stats'] = await testEndpoint(
    'GET',
    '/api/cache/stats',
    'Get cache statistics'
  );
  console.log();
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%\n`);
  
  // Detailed results
  console.log('Detailed Results:');
  console.log('───────────────────────────────────────────────────────');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}`);
  });
  console.log();
  
  // Final verdict
  if (passedTests === totalTests) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 ALL INTEGRATION TESTS PASSED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\nYour data collection system is fully operational!');
    console.log('\nNext steps:');
    console.log('1. Create database tables (run migrations SQL)');
    console.log('2. Run full news scrape: POST /api/admin/news-scraper/run');
    console.log('3. Run parliamentary update: POST /api/admin/parliamentary/update');
    console.log('4. Calculate unified scores: POST /api/parliamentary/scores/recalculate');
    console.log('5. Set up automated cron jobs for daily updates');
    return true;
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️ SOME TESTS FAILED');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\nPlease review the failed tests above.');
    console.log('Most failures are likely due to:');
    console.log('- Database tables not created yet');
    console.log('- Missing environment variables');
    console.log('- API rate limits');
    return false;
  }
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/cache/stats`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server is not running on http://localhost:5000');
    console.log('\nPlease start the server first:');
    console.log('  npm run dev\n');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  
  const success = await runIntegrationTests();
  process.exit(success ? 0 : 1);
})();

