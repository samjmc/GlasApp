/**
 * Test Historical Baseline Research
 * Example: Michael Lowry (known corruption scandal)
 */

const BASE_URL = 'http://localhost:5000';

async function testMichaelLowryBaseline() {
  console.log('🔍 TESTING AI BASELINE RESEARCH');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Example: Michael Lowry (Moriarty Tribunal)\n');
  
  console.log('This will:');
  console.log('1. Use AI to research Michael Lowry\'s history');
  console.log('2. Find tribunal findings, scandals, achievements');
  console.log('3. Assign a fair baseline modifier (0.50-1.30)');
  console.log('4. Document all reasoning and sources');
  console.log('5. Save to database\n');
  
  console.log('⏳ Starting research (may take 10-15 seconds)...\n');
  
  try {
    const response = await fetch(`${BASE_URL}/api/admin/baselines/research/Michael Lowry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        crossCheck: false  // Set to true to verify with both Claude and GPT-4
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.baseline) {
      const b = data.baseline;
      const i = data.interpretation;
      
      console.log('✅ RESEARCH COMPLETE\n');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 BASELINE ASSESSMENT');
      console.log('═══════════════════════════════════════════════════════\n');
      
      console.log(`TD: ${b.politician_name}`);
      console.log(`Category: ${i.category.toUpperCase()}`);
      console.log(`Baseline Modifier: ${b.baseline_modifier}x`);
      console.log(`Starting ELO: ${i.starting_elo} (vs standard 1500)`);
      console.log(`Starting 0-100: ${i.starting_percentage}% (vs standard 50%)`);
      console.log(`AI Confidence: ${Math.round(b.confidence * 100)}%\n`);
      
      console.log('───────────────────────────────────────────────────────');
      console.log('📋 HISTORICAL SUMMARY');
      console.log('───────────────────────────────────────────────────────');
      console.log(b.historical_summary);
      console.log();
      
      if (b.key_findings && b.key_findings.length > 0) {
        console.log('───────────────────────────────────────────────────────');
        console.log('🔍 KEY FINDINGS');
        console.log('───────────────────────────────────────────────────────');
        b.key_findings.forEach((finding: any, idx: number) => {
          console.log(`\n${idx + 1}. ${finding.title} (${finding.year})`);
          console.log(`   Type: ${finding.type}`);
          console.log(`   Description: ${finding.description}`);
          console.log(`   Impact: ${finding.impact}`);
          console.log(`   Source: ${finding.source}`);
        });
        console.log();
      }
      
      console.log('───────────────────────────────────────────────────────');
      console.log('💡 AI REASONING');
      console.log('───────────────────────────────────────────────────────');
      console.log(b.reasoning);
      console.log();
      
      if (b.controversies_noted && b.controversies_noted.length > 0) {
        console.log('───────────────────────────────────────────────────────');
        console.log('⚠️ CONTROVERSIES NOT INCLUDED IN BASELINE');
        console.log('───────────────────────────────────────────────────────');
        b.controversies_noted.forEach((c: string) => console.log(`  • ${c}`));
        console.log();
      }
      
      console.log('───────────────────────────────────────────────────────');
      console.log('📊 DATA QUALITY');
      console.log('───────────────────────────────────────────────────────');
      console.log(`Sources Found: ${b.data_quality.sources_found}`);
      console.log(`Primary Sources: ${b.data_quality.primary_sources}`);
      console.log(`Research Date: ${b.data_quality.research_date}`);
      console.log(`Confidence Factors: ${b.data_quality.confidence_factors}`);
      console.log();
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('✅ BASELINE SAVED TO DATABASE');
      console.log('═══════════════════════════════════════════════════════\n');
      
      console.log('This TD will now start with:');
      console.log(`  ELO: ${i.starting_elo} instead of 1500`);
      console.log(`  0-100: ${i.starting_percentage}% instead of 50%\n`);
      
      console.log('They can improve through good work:');
      console.log(`  • Each positive article: +10-80 ELO`);
      console.log(`  • To reach neutral (1500): need ${Math.round((1500 - i.starting_elo) / 20)} net positive articles`);
      console.log(`  • To reach very good (1700): need ${Math.round((1700 - i.starting_elo) / 20)} net positive articles\n`);
      
      console.log('Redemption is possible, but earned through sustained performance! ⚖️\n');
      
    } else {
      console.log('❌ Research failed');
      console.log(JSON.stringify(data, null, 2));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Run test
testMichaelLowryBaseline();

