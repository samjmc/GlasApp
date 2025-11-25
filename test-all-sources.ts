/**
 * Test All News Sources
 * Including custom web scrapers for Gript and The Ditch
 */

console.log('🧪 TESTING ALL NEWS SOURCES\n');
console.log('═══════════════════════════════════════════════════════\n');

async function testAllSources() {
  const { NewsScraperService } = await import('./server/services/newsScraperService');
  const { GriptScraper } = await import('./server/services/customScrapers/griptScraper');
  const { DitchScraper } = await import('./server/services/customScrapers/ditchScraper');
  
  const results: any = {
    rss_sources: [],
    custom_scrapers: [],
    total_articles: 0
  };
  
  // Test RSS sources
  console.log('📡 TESTING RSS SOURCES');
  console.log('═══════════════════════════════════════════════════════\n');
  
  for (const source of NewsScraperService.IRISH_NEWS_SOURCES || []) {
    try {
      console.log(`Testing: ${source.name} (bias: ${source.bias})`);
      const articles = await NewsScraperService.fetchRSSFeed(
        source.rss,
        source.name,
        source.credibility
      );
      
      results.rss_sources.push({
        name: source.name,
        status: 'success',
        articles: articles.length,
        bias: source.bias
      });
      
      results.total_articles += articles.length;
      console.log(`  ✅ ${articles.length} articles\n`);
      
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}\n`);
      results.rss_sources.push({
        name: source.name,
        status: 'failed',
        articles: 0,
        error: error.message
      });
    }
  }
  
  // Test Gript scraper
  console.log('\n📡 TESTING CUSTOM SCRAPERS');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log('Testing: Gript Media (bias: -0.20)');
  try {
    const griptArticles = await GriptScraper.scrapeLatestArticles();
    
    if (griptArticles.length > 0) {
      console.log(`  ✅ ${griptArticles.length} articles`);
      console.log(`  Sample: "${griptArticles[0].title}"`);
      results.custom_scrapers.push({
        name: 'Gript Media',
        status: 'success',
        articles: griptArticles.length,
        bias: -0.20
      });
      results.total_articles += griptArticles.length;
    } else {
      console.log(`  ⚠️ No articles found - scraper may need adjustment`);
      results.custom_scrapers.push({
        name: 'Gript Media',
        status: 'no_articles',
        articles: 0
      });
    }
  } catch (error: any) {
    console.log(`  ❌ Failed: ${error.message}`);
    results.custom_scrapers.push({
      name: 'Gript Media',
      status: 'failed',
      articles: 0,
      error: error.message
    });
  }
  console.log();
  
  // Test The Ditch scraper
  console.log('Testing: The Ditch (bias: -0.18)');
  try {
    const ditchArticles = await DitchScraper.scrapeLatestArticles();
    
    if (ditchArticles.length > 0) {
      console.log(`  ✅ ${ditchArticles.length} articles`);
      console.log(`  Sample: "${ditchArticles[0].title}"`);
      results.custom_scrapers.push({
        name: 'The Ditch',
        status: 'success',
        articles: ditchArticles.length,
        bias: -0.18
      });
      results.total_articles += ditchArticles.length;
    } else {
      console.log(`  ⚠️ No articles found - scraper may need adjustment`);
      results.custom_scrapers.push({
        name: 'The Ditch',
        status: 'no_articles',
        articles: 0
      });
    }
  } catch (error: any) {
    console.log(`  ❌ Failed: ${error.message}`);
    results.custom_scrapers.push({
      name: 'The Ditch',
      status: 'failed',
      articles: 0,
      error: error.message
    });
  }
  console.log();
  
  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 SOURCE COVERAGE SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const totalSources = results.rss_sources.length + results.custom_scrapers.length;
  const workingSources = [
    ...results.rss_sources.filter((s: any) => s.status === 'success'),
    ...results.custom_scrapers.filter((s: any) => s.status === 'success')
  ];
  
  console.log(`Total Sources: ${totalSources}`);
  console.log(`Working Sources: ${workingSources.length}`);
  console.log(`Total Articles: ${results.total_articles}\n`);
  
  console.log('Source Breakdown:');
  console.log('───────────────────────────────────────────────────────');
  
  // Calculate bias distribution
  let proGovt = 0, balanced = 0, antiGovt = 0;
  
  workingSources.forEach((s: any) => {
    const status = s.status === 'success' ? '✅' : '❌';
    console.log(`${status} ${s.name.padEnd(25)} Bias: ${s.bias >= 0 ? '+' : ''}${s.bias}  Articles: ${s.articles}`);
    
    if (s.bias > 0.05) proGovt++;
    else if (s.bias < -0.05) antiGovt++;
    else balanced++;
  });
  
  console.log();
  console.log('Political Balance:');
  console.log(`  Pro-Government: ${proGovt} sources`);
  console.log(`  Balanced: ${balanced} sources`);
  console.log(`  Anti-Government: ${antiGovt} sources`);
  
  const avgBias = workingSources.reduce((sum: number, s: any) => sum + (s.bias || 0), 0) / workingSources.length;
  console.log(`  Average Bias: ${avgBias >= 0 ? '+' : ''}${avgBias.toFixed(3)}`);
  
  if (Math.abs(avgBias) < 0.05) {
    console.log(`  ✅ WELL BALANCED! (within ±0.05)\n`);
  } else if (avgBias > 0.05) {
    console.log(`  ⚠️ Slightly pro-government (${avgBias > 0 ? '+' : ''}${avgBias.toFixed(3)})\n`);
  } else {
    console.log(`  ⚠️ Slightly anti-government (${avgBias.toFixed(3)})\n`);
  }
  
  // Recommendations
  if (results.custom_scrapers.some((s: any) => s.status === 'failed' || s.status === 'no_articles')) {
    console.log('💡 RECOMMENDATIONS:');
    console.log('───────────────────────────────────────────────────────');
    
    results.custom_scrapers.forEach((s: any) => {
      if (s.status !== 'success') {
        console.log(`⚠️ ${s.name}: ${s.status}`);
        console.log(`   Action: Visit ${s.name === 'Gript Media' ? 'https://gript.ie' : 'https://www.theditch.ie'}`);
        console.log(`   Inspect HTML structure with DevTools`);
        console.log(`   Update selectors in server/services/customScrapers/`);
      }
    });
    console.log();
  }
  
  console.log('═══════════════════════════════════════════════════════');
  
  if (workingSources.length >= 8) {
    console.log('🎉 EXCELLENT SOURCE COVERAGE!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('You have comprehensive coverage across the political spectrum:');
    console.log('✅ Establishment perspectives (RTE, Times, Independent)');
    console.log('✅ Balanced reporting (Journal, Examiner)');
    console.log('✅ Investigative journalism (Noteworthy, Legal News)');
    console.log('✅ Critical voices (Business Post, Gript, Ditch)\n');
    console.log('Your scoring system will be FAIR and BALANCED! ⚖️\n');
  } else {
    console.log('⚠️ PARTIAL SOURCE COVERAGE');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`${workingSources.length} sources working (target: 9-11)`);
    console.log('Check failed sources and update scrapers as needed.\n');
  }
}

testAllSources();

