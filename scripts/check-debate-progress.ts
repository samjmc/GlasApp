import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function checkProgress() {
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  const { data, error } = await supabase
    .from('td_debates')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  const count = data?.length || 0;
  
  console.log(`\n📊 Current debate participations in database: ${count.toLocaleString()}`);
  
  // Get some stats
  const { data: stats } = await supabase.rpc('get_debate_stats');
  
  if (stats) {
    console.log('\n📈 Breakdown:');
    console.log(stats);
  }
}

checkProgress().catch(console.error);



