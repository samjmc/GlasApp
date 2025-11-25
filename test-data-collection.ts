/**
 * Standalone Test Script for Data Collection System
 * Run with: npx tsx test-data-collection.ts
 */

console.log('🧪 TESTING DATA COLLECTION SYSTEM\n');

// Test 1: News Scraper Service
async function testNewsScraper() {
  console.log('📰 Test 1: News Scraper Service');
  console.log('================================');
  
  try {
    const { NewsScraperService } = await import('./server/services/newsScraperService');
    
    console.log('✅ Import successful');
    console.log('📡 Fetching from The Journal...\n');
    
    const articles = await NewsScraperService.fetchRSSFeed(
      'https://www.thejournal.ie/feed/',
      'The Journal',
      0.90
    );
    
    console.log(`✅ Found ${articles.length} articles`);
    
    if (articles.length > 0) {
      console.log(`   Sample: "${articles[0].title.substring(0, 60)}..."`);
      console.log(`   Published: ${articles[0].published_date}`);
    }
    
    // Test filtering
    const politicalArticles = NewsScraperService.filterPoliticalArticles(articles);
    console.log(`✅ ${politicalArticles.length} articles contain political content\n`);
    
    return { success: true, articlesFound: articles.length, politicalArticles: politicalArticles.length };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 2: TD Extraction Service
async function testTDExtraction() {
  console.log('👤 Test 2: TD Extraction Service');
  console.log('=================================');
  
  try {
    const { TDExtractionService } = await import('./server/services/tdExtractionService');
    
    console.log('✅ Import successful');
    
    const testText = "Micheál Martin, the Taoiseach and leader of Fianna Fáil, spoke in Dáil Éireann today about housing policy. Leo Varadkar from Fine Gael responded, while Mary Lou McDonald raised concerns about health funding.";
    
    console.log('🔍 Testing TD extraction from sample text...\n');
    
    const mentions = TDExtractionService.extractTDMentions(testText);
    
    console.log(`✅ Found ${mentions.length} TD mentions:`);
    mentions.forEach(m => {
      console.log(`   - ${m.name} (${m.party}) - Confidence: ${Math.round(m.confidence * 100)}%`);
    });
    console.log();
    
    return { success: true, mentionsFound: mentions.length };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 3: Oireachtas API Service
async function testOireachtasAPI() {
  console.log('🏛️ Test 3: Oireachtas API Service');
  console.log('==================================');
  
  try {
    const { OireachtasAPIService } = await import('./server/services/oireachtasAPIService');
    
    console.log('✅ Import successful');
    console.log('📡 Fetching current Dáil members...\n');
    
    const members = await OireachtasAPIService.getCurrentDailMembers();
    
    console.log(`✅ Found ${members.length} current TDs`);
    
    if (members.length > 0) {
      console.log('\nSample TDs:');
      members.slice(0, 5).forEach(m => {
        console.log(`   - ${m.fullName} (${m.party || 'Independent'}) - ${m.constituency || 'N/A'}`);
      });
    }
    console.log();
    
    // Test fetching one TD's activity
    const testTD = members.find(m => m.fullName.toLowerCase().includes('martin'));
    if (testTD) {
      console.log(`📊 Fetching activity for ${testTD.fullName}...\n`);
      const activity = await OireachtasAPIService.getCompleteMemberActivity(testTD);
      
      console.log('✅ Activity retrieved:');
      console.log(`   Questions Asked: ${activity.questionsAsked}`);
      console.log(`   Debates: ${activity.debates}`);
      console.log(`   Votes: ${activity.votes}`);
      console.log(`   Estimated Attendance: ${activity.estimatedAttendance}%`);
    }
    console.log();
    
    return { success: true, tdsFound: members.length };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 4: Score Converter Utilities
async function testScoreConverter() {
  console.log('🔢 Test 4: Score Converter Utilities');
  console.log('====================================');
  
  try {
    const { convertELOToPercentage, calculateUnifiedScore } = await import('./server/utils/scoreConverter');
    
    console.log('✅ Import successful');
    console.log('🧮 Testing ELO to percentage conversion...\n');
    
    const testScores = [1000, 1200, 1500, 1800, 2000];
    
    testScores.forEach(elo => {
      const percentage = convertELOToPercentage(elo);
      console.log(`   ELO ${elo} → ${percentage}%`);
    });
    
    console.log('\n🧮 Testing unified score calculation...\n');
    
    const testData = {
      overall_elo: 1600,
      questionsAsked: 45,
      attendancePercentage: 85,
      constituency_service_score: 65,
      public_trust_score: 72
    };
    
    const unifiedScores = calculateUnifiedScore(testData);
    
    console.log('✅ Unified scores calculated:');
    console.log(`   Overall Score: ${unifiedScores.overall_score}/100`);
    console.log(`   Parliamentary Score: ${unifiedScores.parliamentary_score}/100`);
    console.log(`   Public Trust Score: ${unifiedScores.public_trust_score}/100`);
    console.log();
    
    return { success: true };
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Data Collection System Tests');
  console.log('==========================================\n');
  
  const results = {
    newsScraper: await testNewsScraper(),
    tdExtraction: await testTDExtraction(),
    oireachtasAPI: await testOireachtasAPI(),
    scoreConverter: await testScoreConverter()
  };
  
  console.log('==========================================');
  console.log('📊 TEST SUMMARY');
  console.log('==========================================\n');
  
  const allPassed = Object.values(results).every(r => r.success);
  
  console.log(`News Scraper: ${results.newsScraper.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.newsScraper.success) {
    console.log(`  - Articles found: ${results.newsScraper.articlesFound}`);
    console.log(`  - Political articles: ${results.newsScraper.politicalArticles}`);
  }
  
  console.log(`\nTD Extraction: ${results.tdExtraction.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.tdExtraction.success) {
    console.log(`  - TD mentions found: ${results.tdExtraction.mentionsFound}`);
  }
  
  console.log(`\nOireachtas API: ${results.oireachtasAPI.success ? '✅ PASS' : '❌ FAIL'}`);
  if (results.oireachtasAPI.success) {
    console.log(`  - TDs found: ${results.oireachtasAPI.tdsFound}`);
  }
  
  console.log(`\nScore Converter: ${results.scoreConverter.success ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log('\n==========================================');
  
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('==========================================\n');
    console.log('Your data collection system is working correctly!');
    console.log('\nNext steps:');
    console.log('1. Create database tables (use MCP or Supabase dashboard)');
    console.log('2. Start the server: npm run dev');
    console.log('3. Test endpoints via browser or curl');
    console.log('4. Run full data collection');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('==========================================\n');
    console.log('Check the errors above for details.');
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});

