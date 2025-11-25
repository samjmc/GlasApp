/**
 * Simple Progress Monitor
 * Shows database counts every 10 seconds
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function monitor() {
  console.log('📊 EXTRACTION PROGRESS MONITOR');
  console.log('═'.repeat(70));
  console.log('Checking database every 10 seconds... (Ctrl+C to stop)\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  let iteration = 0;
  let lastCounts = { questions: 0, votes: 0, debates: 0, legislation: 0 };

  while (true) {
    iteration++;
    const time = new Date().toLocaleTimeString();

    try {
      const { data: questions } = await supabase.from('td_questions').select('id', { count: 'exact', head: true });
      const { data: votes } = await supabase.from('td_votes').select('id', { count: 'exact', head: true });
      const { data: debates } = await supabase.from('td_debates').select('id', { count: 'exact', head: true });
      const { data: legislation } = await supabase.from('td_legislation').select('id', { count: 'exact', head: true });

      const counts = {
        questions: questions?.length || 0,
        votes: votes?.length || 0,
        debates: debates?.length || 0,
        legislation: legislation?.length || 0
      };

      // Calculate changes
      const qDelta = counts.questions - lastCounts.questions;
      const vDelta = counts.votes - lastCounts.votes;
      const dDelta = counts.debates - lastCounts.debates;
      const lDelta = counts.legislation - lastCounts.legislation;

      const qStr = counts.questions.toString().padStart(6);
      const vStr = counts.votes.toString().padStart(7);
      const dStr = counts.debates.toString().padStart(5);
      const lStr = counts.legislation.toString().padStart(4);

      const qDeltaStr = qDelta > 0 ? ` (+${qDelta})` : '';
      const vDeltaStr = vDelta > 0 ? ` (+${vDelta})` : '';
      const dDeltaStr = dDelta > 0 ? ` (+${dDelta})` : '';
      const lDeltaStr = lDelta > 0 ? ` (+${lDelta})` : '';

      console.log(`[${time}] Q: ${qStr}${qDeltaStr.padEnd(10)} | V: ${vStr}${vDeltaStr.padEnd(10)} | D: ${dStr}${dDeltaStr.padEnd(8)} | L: ${lStr}${lDeltaStr.padEnd(8)}`);

      // Check if complete
      if (qDelta === 0 && vDelta === 0 && dDelta === 0 && lDelta === 0 && 
          counts.questions > 1000 && iteration > 3) {
        console.log('\n✅ No changes detected - extraction likely complete!');
        break;
      }

      lastCounts = counts;

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }

    // Wait 10 seconds
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log('\n═'.repeat(70));
  console.log('Monitor stopped');
}

monitor().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

