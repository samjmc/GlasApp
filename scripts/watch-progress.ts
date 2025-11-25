/**
 * Watch Extraction Progress
 * Shows real-time updates every 15 seconds
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function watchProgress() {
  console.log('📊 MONITORING 2024-2025 EXTRACTION');
  console.log('═'.repeat(70));
  console.log('Checking database every 15 seconds...\n');
  console.log('Press Ctrl+C to stop monitoring\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  let lastCount = 0;
  let noChangeCount = 0;

  for (let i = 0; i < 100; i++) {
    const time = new Date().toLocaleTimeString();

    try {
      const { data, error } = await supabase
        .from('td_questions')
        .select('id', { count: 'exact', head: true });

      if (!error && data !== null) {
        const count = data.length || 0;
        const delta = count - lastCount;
        const deltaStr = delta > 0 ? ` (+${delta.toLocaleString()})` : '';
        
        console.log(`[${time}] Questions: ${count.toLocaleString().padStart(6)}${deltaStr}`);

        if (delta === 0 && count > 1000) {
          noChangeCount++;
          if (noChangeCount >= 3) {
            console.log('\n✅ No changes for 45 seconds - extraction likely complete!');
            break;
          }
        } else {
          noChangeCount = 0;
        }

        lastCount = count;
      }

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15 seconds
  }

  // Show final stats
  const { data: stats } = await supabase.from('td_questions').select('*');
  
  if (stats) {
    console.log('\n' + '═'.repeat(70));
    console.log('📊 FINAL STATS:');
    console.log('═'.repeat(70));
    console.log(`Total questions:  ${stats.length.toLocaleString()}`);
    console.log(`Unique TDs:       ${new Set(stats.map(s => s.td_id)).size}`);
    console.log('═'.repeat(70));
  }
}

watchProgress().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

