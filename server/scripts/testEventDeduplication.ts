/**
 * Test script for Event Deduplication Service
 * 
 * Tests that articles about the same event are properly clustered
 * and the best article is selected.
 */

import 'dotenv/config';
import { EventDeduplicationService } from '../services/eventDeduplicationService.js';

async function testEventDeduplication() {
  console.log('\n' + '═'.repeat(70));
  console.log('🧪 Testing Event Deduplication Service');
  console.log('═'.repeat(70));
  
  // Simulate multiple articles about the same event
  const testArticles = [
    {
      id: 1,
      title: "Herzog Park protest: Minister faces calls to resign over immigration centre",
      content: "A large protest took place in Herzog Park today as residents demanded the resignation of Minister James Browne over the proposed direct provision centre. Hundreds gathered at the site where tensions have been rising for weeks...",
      source: "Irish Times",
      published_date: "2024-12-03",
      importance_score: 85
    },
    {
      id: 2,
      title: "Hundreds protest at Herzog Park against asylum centre plans",
      content: "Around 400 people gathered at Herzog Park in Dublin this afternoon to protest against government plans to house asylum seekers. The protest comes amid ongoing controversy...",
      source: "The Journal",
      published_date: "2024-12-03",
      importance_score: 78
    },
    {
      id: 3,
      title: "Herzog Park demo: Protesters clash with supporters",
      content: "Brief scuffles broke out at Herzog Park today during a protest against the proposed IPAS centre. Gardaí were called to separate groups...",
      source: "Irish Mirror",
      published_date: "2024-12-03",
      importance_score: 72
    },
    {
      id: 4,
      title: "Simon Harris announces new housing investment of €2bn",
      content: "Taoiseach Simon Harris today announced a major new housing investment package worth €2 billion. The initiative aims to deliver 10,000 new homes...",
      source: "RTE News",
      published_date: "2024-12-03",
      importance_score: 90
    },
    {
      id: 5,
      title: "Government housing plan: Harris pledges billions for new homes",
      content: "The government has unveiled a €2 billion housing plan with Taoiseach Simon Harris promising the largest investment in social housing in a decade...",
      source: "Irish Examiner",
      published_date: "2024-12-03",
      importance_score: 88
    },
    {
      id: 6,
      title: "Mary Lou McDonald visits Cork to launch Sinn Féin election campaign",
      content: "Sinn Féin leader Mary Lou McDonald was in Cork today to officially launch the party's general election campaign. Speaking to supporters...",
      source: "Irish Times",
      published_date: "2024-12-03",
      importance_score: 82
    }
  ];
  
  console.log(`\n📥 Input: ${testArticles.length} articles`);
  console.log('   Expected clusters:');
  console.log('   1. Herzog Park protest (3 articles) → Select Irish Times');
  console.log('   2. Housing investment (2 articles) → Select RTE News');
  console.log('   3. Mary Lou McDonald Cork visit (1 article) → Single article');
  
  console.log('\n' + '─'.repeat(70));
  
  const result = await EventDeduplicationService.clusterAndDeduplicate(testArticles);
  
  console.log('\n' + '─'.repeat(70));
  console.log('📊 Results:');
  console.log(`   Input: ${result.stats.inputCount} articles`);
  console.log(`   Output: ${result.stats.outputCount} unique events`);
  console.log(`   Clusters: ${result.stats.clustersFound}`);
  console.log(`   Duplicates removed: ${result.stats.duplicatesRemoved}`);
  
  console.log('\n📰 Selected Articles:');
  result.selectedArticles.forEach((article, i) => {
    console.log(`   ${i + 1}. [${article.source}] ${article.title.substring(0, 60)}...`);
  });
  
  console.log('\n🔗 Cluster Details:');
  result.clusters.forEach((cluster, i) => {
    console.log(`\n   Cluster ${i + 1}: ${cluster.eventName}`);
    console.log(`   Articles: ${cluster.articles.length}`);
    console.log(`   Selected ID: ${cluster.selectedArticleId}`);
    console.log(`   Reason: ${cluster.selectionReason}`);
  });
  
  // Verify results
  console.log('\n' + '─'.repeat(70));
  console.log('✅ Test Complete');
  
  const expectedOutput = 3;  // Herzog Park, Housing, MLM
  if (result.stats.outputCount === expectedOutput) {
    console.log(`   ✓ Correct number of unique events: ${expectedOutput}`);
  } else {
    console.log(`   ⚠️ Expected ${expectedOutput} events, got ${result.stats.outputCount}`);
  }
  
  console.log('═'.repeat(70) + '\n');
}

testEventDeduplication().catch(console.error);

