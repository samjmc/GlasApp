/**
 * Test script for the full deduplication pipeline
 * 
 * Tests:
 * 1. Title similarity deduplication (Layer 1)
 * 2. Article triage job (Layer 2)
 * 3. Event clustering (Layer 3) 
 * 4. Multi-agent scoring (Layer 4)
 */

import 'dotenv/config';
import { TitleDeduplicationService } from '../services/titleDeduplicationService.js';
import { EventDeduplicationService } from '../services/eventDeduplicationService.js';
import { ArticleTriageJob } from '../jobs/articleTriageJob.js';

async function testPipeline() {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 TESTING DEDUPLICATION PIPELINE');
  console.log('═'.repeat(70));
  
  // Test 1: Title Similarity (Layer 1)
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 1: Title Similarity Deduplication');
  console.log('─'.repeat(70));
  
  const testTitles = [
    { title: "Herzog Park protest: Minister faces calls to resign", source: "Irish Times" },
    { title: "Hundreds protest at Herzog Park against asylum centre", source: "The Journal" },
    { title: "Herzog Park demo: Protesters clash with supporters", source: "Irish Mirror" },
    { title: "Simon Harris announces €2bn housing investment", source: "RTE News" },
    { title: "Government housing plan: Harris pledges billions", source: "Irish Examiner" },
    { title: "Mary Lou McDonald visits Cork for campaign launch", source: "Irish Times" },
  ];
  
  console.log('\nCalculating title similarities...\n');
  
  for (let i = 0; i < testTitles.length; i++) {
    for (let j = i + 1; j < testTitles.length; j++) {
      const similarity = TitleDeduplicationService.calculateSimilarity(
        testTitles[i].title,
        testTitles[j].title
      );
      
      if (similarity > 0.3) {
        const isDupe = similarity >= 0.6;
        console.log(`${isDupe ? '🔗 DUPLICATE' : '⚠️  Similar'}: ${Math.round(similarity * 100)}%`);
        console.log(`   "${testTitles[i].title.substring(0, 40)}..." (${testTitles[i].source})`);
        console.log(`   "${testTitles[j].title.substring(0, 40)}..." (${testTitles[j].source})\n`);
      }
    }
  }
  
  // Test 2: Significant word extraction
  console.log('─'.repeat(70));
  console.log('TEST 2: Significant Word Extraction');
  console.log('─'.repeat(70));
  
  for (const { title, source } of testTitles.slice(0, 3)) {
    const words = TitleDeduplicationService.extractSignificantWords(title);
    console.log(`\n${source}: "${title}"`);
    console.log(`   Keywords: ${[...words].join(', ')}`);
  }
  
  // Test 3: Event Clustering (Layer 3)
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 3: LLM Event Clustering');
  console.log('─'.repeat(70));
  
  const testArticles = [
    {
      id: 1,
      title: "Herzog Park protest: Minister faces calls to resign over immigration centre",
      content: "A large protest took place in Herzog Park today as residents demanded the resignation of Minister James Browne...",
      source: "Irish Times",
      published_date: "2024-12-03",
      importance_score: 85
    },
    {
      id: 2,
      title: "Hundreds protest at Herzog Park against asylum centre plans",
      content: "Around 400 people gathered at Herzog Park in Dublin this afternoon to protest against government plans...",
      source: "The Journal",
      published_date: "2024-12-03",
      importance_score: 78
    },
    {
      id: 3,
      title: "Simon Harris announces new housing investment of €2bn",
      content: "Taoiseach Simon Harris today announced a major new housing investment package...",
      source: "RTE News",
      published_date: "2024-12-03",
      importance_score: 90
    }
  ];
  
  const clusterResult = await EventDeduplicationService.clusterAndDeduplicate(testArticles);
  
  console.log(`\nInput: ${clusterResult.stats.inputCount} articles`);
  console.log(`Output: ${clusterResult.stats.outputCount} unique events`);
  console.log(`Duplicates removed: ${clusterResult.stats.duplicatesRemoved}`);
  
  console.log('\nSelected articles:');
  clusterResult.selectedArticles.forEach((a, i) => {
    console.log(`   ${i + 1}. [${a.source}] ${a.title.substring(0, 50)}...`);
  });
  
  // Test 4: Check triage status
  console.log('\n' + '─'.repeat(70));
  console.log('TEST 4: Article Triage Status');
  console.log('─'.repeat(70));
  
  try {
    const status = await ArticleTriageJob.getStatus();
    console.log(`\n📊 Current Queue Status:`);
    console.log(`   Pending triage (visible=false): ${status.pendingTriage}`);
    console.log(`   Pending scoring (processed=false): ${status.pendingScoring}`);
  } catch (error) {
    console.log('   ⚠️ Could not fetch status (database may not be connected)');
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('✅ PIPELINE TEST COMPLETE');
  console.log('═'.repeat(70));
  
  console.log(`
📋 CRONJOB.ORG ENDPOINTS:

1. Article Triage (every 15 mins):
   POST https://your-railway-url.railway.app/api/admin/td-scoring/triage

2. TD Scoring (hourly):
   POST https://your-railway-url.railway.app/api/admin/td-scoring/run

3. Full Pipeline (manual/testing):
   POST https://your-railway-url.railway.app/api/admin/td-scoring/full-pipeline

4. Status Check:
   GET https://your-railway-url.railway.app/api/admin/td-scoring/status
`);
  
  console.log('═'.repeat(70) + '\n');
}

testPipeline().catch(console.error);

