/**
 * TEST TD WIDGET DATA
 * Verifies that the TD scores widget API endpoint returns proper data
 * Run with: npx tsx test-td-widget.ts
 */

const BASE_URL = 'http://localhost:5000';

async function testTDWidget() {
  console.log('🧪 Testing TD Scores Widget API');
  console.log('═══════════════════════════════════════════\n');
  
  try {
    console.log('📡 Fetching from: /api/parliamentary/scores/widget\n');
    
    const response = await fetch(`${BASE_URL}/api/parliamentary/scores/widget`);
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} ${response.statusText}\n`);
      console.log('⚠️  Is your server running?');
      console.log('   Run: npm run dev');
      console.log('   Or double-click: START_SERVER_AND_SHOW_OUTPUT.bat\n');
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ API Response Successful!\n');
      
      // Check Top Performers
      console.log('👑 TOP PERFORMERS:');
      console.log('─────────────────────────────────────────');
      if (data.top_performers && data.top_performers.length > 0) {
        data.top_performers.forEach((td: any, idx: number) => {
          console.log(`${idx + 1}. ${td.name}`);
          console.log(`   Party: ${td.party || 'Unknown'}`);
          console.log(`   Constituency: ${td.constituency || 'Unknown'}`);
          console.log(`   ELO Score: ${td.overall_elo}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No top performers found\n');
      }
      
      // Check Bottom Performers
      console.log('⚠️  NEEDS IMPROVEMENT:');
      console.log('─────────────────────────────────────────');
      if (data.bottom_performers && data.bottom_performers.length > 0) {
        data.bottom_performers.forEach((td: any, idx: number) => {
          console.log(`${data.stats.total_tds - idx}. ${td.name}`);
          console.log(`   Party: ${td.party || 'Unknown'}`);
          console.log(`   Constituency: ${td.constituency || 'Unknown'}`);
          console.log(`   ELO Score: ${td.overall_elo}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No bottom performers found\n');
      }
      
      // Check Stats
      console.log('📊 STATISTICS:');
      console.log('─────────────────────────────────────────');
      console.log(`Total TDs: ${data.stats.total_tds}`);
      console.log(`Articles Analyzed: ${data.stats.articles_analyzed}`);
      console.log(`Last Update: ${new Date(data.stats.last_update).toLocaleString()}`);
      console.log(`Active Sources: ${data.stats.sources_active}`);
      console.log('');
      
      // Check for "Unknown" values
      const unknownParties = [
        ...data.top_performers.filter((td: any) => !td.party || td.party === 'Unknown'),
        ...data.bottom_performers.filter((td: any) => !td.party || td.party === 'Unknown')
      ];
      
      if (unknownParties.length > 0) {
        console.log('⚠️  WARNING: Some TDs still have "Unknown" party:');
        console.log('─────────────────────────────────────────');
        unknownParties.forEach((td: any) => {
          console.log(`   - ${td.name}`);
        });
        console.log('\n💡 Run: npx tsx update-td-party-constituency.ts');
        console.log('   to add more TD data\n');
      } else {
        console.log('✅ All displayed TDs have proper party and constituency data!\n');
      }
      
      console.log('═══════════════════════════════════════════');
      console.log('✅ TEST PASSED!');
      console.log('═══════════════════════════════════════════\n');
      console.log('🌐 Open your browser to see the widget:');
      console.log('   http://localhost:5000\n');
      
    } else {
      console.log('❌ API returned error:', data);
    }
    
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Could not connect to server\n');
      console.log('⚠️  Your server is not running!\n');
      console.log('To start the server:');
      console.log('1. Double-click: START_SERVER_AND_SHOW_OUTPUT.bat');
      console.log('   OR');
      console.log('2. Run: npm run dev\n');
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
}

// Run the test
testTDWidget();

