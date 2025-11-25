/**
 * Monitor Extraction Progress
 * Checks database every 30 seconds
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function monitorProgress() {
  console.log('📊 MONITORING EXTRACTION PROGRESS');
  console.log('═'.repeat(70));
  console.log('Checking database every 30 seconds...\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  let previousCounts = { questions: 0, votes: 0, debates: 0, legislation: 0 };

  for (let i = 0; i < 120; i++) { // Monitor for 1 hour
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          (SELECT COUNT(*) FROM td_questions) as questions,
          (SELECT COUNT(*) FROM td_votes) as votes,
          (SELECT COUNT(*) FROM td_debates) as debates,
          (SELECT COUNT(*) FROM td_legislation) as legislation
      `
    });

    if (!error && data && data[0]) {
      const counts = data[0];
      const time = new Date().toLocaleTimeString();
      
      console.log(`[${time}] Questions: ${counts.questions.toLocaleString().padStart(6)} | Votes: ${counts.votes.toLocaleString().padStart(7)} | Debates: ${counts.debates.toLocaleString().padStart(5)} | Legislation: ${counts.legislation.toLocaleString().padStart(4)}`);
      
      // Check if all are complete (no change in 2 checks and substantial data)
      if (counts.questions === previousCounts.questions &&
          counts.votes === previousCounts.votes &&
          counts.debates === previousCounts.debates &&
          counts.legislation === previousCounts.legislation &&
          counts.questions > 1000) {
        console.log('\n✅ Extraction appears complete!');
        break;
      }
      
      previousCounts = counts;
    }

    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
  }

  console.log('\n═'.repeat(70));
  console.log('Monitoring complete');
}

monitorProgress().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

