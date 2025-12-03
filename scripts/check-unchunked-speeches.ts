import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkUnchunkedSpeeches() {
  console.log('Checking unchunked speeches...\n');
  
  // Get unchunked speeches
  const { data, error } = await supabase.rpc('get_unchunked_speeches', { limit_count: 10 });
  
  console.log('Error:', error?.message || 'none');
  console.log('Returned:', data?.length || 0, 'speeches\n');
  
  if (data) {
    for (const s of data) {
      const paras = s.paragraphs;
      let paraCount = 'N/A';
      let totalChars = 0;
      
      if (Array.isArray(paras)) {
        paraCount = String(paras.length);
        totalChars = paras.join(' ').length;
      } else if (typeof paras === 'string') {
        try {
          const parsed = JSON.parse(paras);
          paraCount = String(parsed.length);
          totalChars = parsed.join(' ').length;
        } catch {
          paraCount = '1 (string)';
          totalChars = paras.length;
        }
      }
      
      console.log(`- ${s.speaker_name}: ${paraCount} paras, ${totalChars} chars`);
    }
  }
  
  // Also check why some speeches might be skipped
  console.log('\n\nChecking speech content patterns...');
  const { data: shortSpeeches } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, paragraphs')
    .limit(20);
  
  let shortCount = 0;
  let emptyCount = 0;
  let normalCount = 0;
  
  if (shortSpeeches) {
    for (const s of shortSpeeches) {
      let paras: string[] = [];
      if (Array.isArray(s.paragraphs)) {
        paras = s.paragraphs;
      } else if (typeof s.paragraphs === 'string') {
        try { paras = JSON.parse(s.paragraphs); } catch { paras = [s.paragraphs]; }
      }
      
      const totalLength = paras.join(' ').length;
      if (paras.length === 0) emptyCount++;
      else if (totalLength < 20) shortCount++;
      else normalCount++;
    }
  }
  
  console.log(`Empty: ${emptyCount}, Short (<20 chars): ${shortCount}, Normal: ${normalCount}`);
}

checkUnchunkedSpeeches().catch(console.error);




