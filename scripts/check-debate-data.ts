import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDebateData() {
  console.log('=== DEBATE DATA ANALYSIS ===\n');
  
  // 1. Check debate_speeches for Simon Harris
  const { count: harrisCount } = await supabase
    .from('debate_speeches')
    .select('*', { count: 'exact', head: true })
    .ilike('speaker_name', '%Harris%');
  console.log('Simon Harris speeches in debate_speeches:', harrisCount);
  
  // 2. Check debate_chunks for Simon Harris
  const { count: harrisChunkCount } = await supabase
    .from('debate_chunks')
    .select('*', { count: 'exact', head: true })
    .ilike('politician_name', '%Harris%');
  console.log('Simon Harris chunks in debate_chunks:', harrisChunkCount);
  
  // 3. Check date range of debate_speeches
  const { data: minDate } = await supabase
    .from('debate_speeches')
    .select('recorded_time')
    .order('recorded_time', { ascending: true })
    .limit(1);
  const { data: maxDate } = await supabase
    .from('debate_speeches')
    .select('recorded_time')
    .order('recorded_time', { ascending: false })
    .limit(1);
  console.log('\nDate range of debate_speeches:');
  console.log('Earliest:', minDate?.[0]?.recorded_time);
  console.log('Latest:', maxDate?.[0]?.recorded_time);
  
  // 4. Check how many speeches have been processed into chunks
  const { count: totalSpeeches } = await supabase
    .from('debate_speeches')
    .select('*', { count: 'exact', head: true });
  const { count: totalChunks } = await supabase
    .from('debate_chunks')
    .select('*', { count: 'exact', head: true });
  console.log('\nTotal speeches:', totalSpeeches);
  console.log('Total chunks:', totalChunks);
  
  // 5. Check for speeches with immigration content
  const { data: allSpeeches } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, paragraphs, recorded_time')
    .limit(5000);
  
  let immigrationSpeeches: any[] = [];
  if (allSpeeches) {
    for (const s of allSpeeches) {
      const text = JSON.stringify(s.paragraphs || []).toLowerCase();
      if (text.includes('immigration') || text.includes('migrant') || text.includes('asylum') || text.includes('refugee')) {
        immigrationSpeeches.push(s);
      }
    }
  }
  console.log('\nSpeeches mentioning immigration/asylum/migrants/refugee:', immigrationSpeeches.length);
  
  // Group by speaker
  const bySpeaker: Record<string, number> = {};
  immigrationSpeeches.forEach(s => {
    bySpeaker[s.speaker_name] = (bySpeaker[s.speaker_name] || 0) + 1;
  });
  console.log('\nBy speaker:');
  Object.entries(bySpeaker)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => console.log(`  ${name}: ${count}`));
  
  // 6. Check if Harris speeches exist but weren't chunked
  const { data: harrisSpeeches } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, recorded_time, paragraphs')
    .ilike('speaker_name', '%Harris%')
    .order('recorded_time', { ascending: false })
    .limit(20);
  
  if (harrisSpeeches && harrisSpeeches.length > 0) {
    console.log('\n=== SAMPLE HARRIS SPEECHES ===');
    for (const s of harrisSpeeches.slice(0, 5)) {
      const paras = s.paragraphs || [];
      const text = Array.isArray(paras) ? paras.join(' ') : String(paras);
      console.log(`\n[${s.recorded_time}] ${s.speaker_name}`);
      console.log(`Content preview: ${text.substring(0, 200)}...`);
      console.log(`Paragraphs count: ${Array.isArray(paras) ? paras.length : 'N/A'}`);
    }
  }
  
  // 7. Check unique politicians in debate_speeches vs debate_chunks
  const { data: speechPoliticians } = await supabase
    .from('debate_speeches')
    .select('speaker_name')
    .limit(10000);
  const { data: chunkPoliticians } = await supabase
    .from('debate_chunks')
    .select('politician_name')
    .limit(50000);
  
  const speechNames = new Set(speechPoliticians?.map(p => p.speaker_name));
  const chunkNames = new Set(chunkPoliticians?.map(p => p.politician_name));
  
  console.log('\n=== COVERAGE ===');
  console.log('Unique speakers in speeches:', speechNames.size);
  console.log('Unique politicians in chunks:', chunkNames.size);
  
  // Find who is in speeches but not in chunks
  const missingFromChunks = [...speechNames].filter(name => !chunkNames.has(name));
  console.log('\nSpeakers NOT in chunks (first 20):');
  missingFromChunks.slice(0, 20).forEach(name => console.log(`  - ${name}`));
}

checkDebateData().catch(console.error);

