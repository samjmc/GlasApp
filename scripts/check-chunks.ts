import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkChunks() {
  // Check total chunks
  const { count: total, error: e0 } = await supabase
    .from('debate_chunks')
    .select('*', { count: 'exact', head: true });
  console.log('Total debate chunks:', total);
  if (e0) console.error('Error:', e0.message);
  
  // Check chunks with immigration keyword
  const { data: immigrationChunks, error: e1 } = await supabase
    .from('debate_chunks')
    .select('id, politician_name, chunk_content, date')
    .ilike('chunk_content', '%immigration%')
    .limit(5);
  console.log('\nChunks mentioning immigration:', immigrationChunks?.length || 0);
  if (immigrationChunks && immigrationChunks.length > 0) {
    immigrationChunks.forEach(c => 
      console.log(`- ${c.politician_name}: ${c.chunk_content?.substring(0, 80)}...`)
    );
  }
  if (e1) console.error('Immigration search error:', e1.message);
  
  // Check Simon Harris chunks
  const { data: harrisChunks, error: e2 } = await supabase
    .from('debate_chunks')
    .select('id, politician_name, chunk_content, date')
    .ilike('politician_name', '%Harris%')
    .limit(5);
  console.log('\nSimon Harris chunks:', harrisChunks?.length || 0);
  if (harrisChunks && harrisChunks.length > 0) {
    harrisChunks.forEach(c => 
      console.log(`- ${c.date}: ${c.chunk_content?.substring(0, 80)}...`)
    );
  }
  if (e2) console.error('Harris search error:', e2.message);
  
  // Check distinct politicians with counts
  const { data: allChunks, error: e3 } = await supabase
    .from('debate_chunks')
    .select('politician_name');
  
  if (allChunks) {
    const counts: Record<string, number> = {};
    allChunks.forEach(c => {
      counts[c.politician_name] = (counts[c.politician_name] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log('\nTop 10 politicians by chunk count:');
    sorted.slice(0, 10).forEach(([name, count]) => console.log(`- ${name}: ${count} chunks`));
  }
  if (e3) console.error('Counts error:', e3.message);
}

checkChunks().catch(console.error);

