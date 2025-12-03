import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkUnchunked() {
  // Check the function definition
  const { data, error } = await supabase.rpc('get_unchunked_speeches', { limit_count: 5 });
  console.log('Unchunked speeches returned:', data?.length || 0);
  if (data) {
    data.forEach((s: any) => {
      const paras = s.paragraphs;
      const paraCount = Array.isArray(paras) ? paras.length : 'N/A';
      console.log(`- ${s.speaker_name}: ${paraCount} paragraphs`);
    });
  }
  if (error) console.error('Error:', error);
  
  // Check total speeches vs chunked
  const { count: totalSpeeches } = await supabase
    .from('debate_speeches')
    .select('*', { count: 'exact', head: true });
  
  // Count distinct speech_ids in chunks
  const { data: chunkSpeechIds } = await supabase
    .from('debate_chunks')
    .select('speech_id');
  const uniqueChunkedSpeechIds = new Set(chunkSpeechIds?.map(c => c.speech_id));
  
  console.log('\nTotal speeches:', totalSpeeches);
  console.log('Speeches with chunks:', uniqueChunkedSpeechIds.size);
  console.log('Speeches without chunks:', (totalSpeeches || 0) - uniqueChunkedSpeechIds.size);
  
  // Check if speeches are being skipped due to short content
  const { data: shortSpeeches } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, paragraphs')
    .limit(100);
  
  let shortCount = 0;
  let emptyCount = 0;
  if (shortSpeeches) {
    for (const s of shortSpeeches) {
      const paras = Array.isArray(s.paragraphs) ? s.paragraphs : [];
      const totalLength = paras.join(' ').length;
      if (totalLength < 20) shortCount++;
      if (paras.length === 0) emptyCount++;
    }
  }
  console.log('\nIn sample of 100 speeches:');
  console.log('- Empty paragraphs:', emptyCount);
  console.log('- Very short (<20 chars):', shortCount);
}

checkUnchunked().catch(console.error);




