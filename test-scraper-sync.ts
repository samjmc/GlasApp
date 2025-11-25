/**
 * Test News Scraper Synchronously
 * Runs the full scraper pipeline and shows what happens
 */

import 'dotenv/config';
import { runDailyNewsScraper } from './server/jobs/dailyNewsScraper';

console.log('\n🚀 RUNNING NEWS SCRAPER SYNCHRONOUSLY...\n');
console.log('This will show all output in real-time.\n');
console.log('═══════════════════════════════════════════════════════\n');

runDailyNewsScraper()
  .then(stats => {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ SCRAPER COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('📊 Final Statistics:');
    console.log(JSON.stringify(stats, null, 2));
    console.log('\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n═══════════════════════════════════════════════════════');
    console.error('❌ SCRAPER FAILED!');
    console.error('═══════════════════════════════════════════════════════\n');
    console.error('Error:', error);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n');
    process.exit(1);
  });






















