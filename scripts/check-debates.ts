import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkDebates() {
  // Check debates table
  const { data: debates, count } = await supabase
    .from('debates')
    .select('id, title, date, chamber', { count: 'exact' })
    .order('date', { ascending: false })
    .limit(20);
  console.log('Total debates:', count);
  console.log('\nRecent debates:');
  if (debates) {
    debates.forEach(d => console.log(`- ${d.date} [${d.chamber}]: ${d.title?.substring(0, 60)}`));
  }
  
  // Check for immigration-related debates
  const { data: immigrationDebates } = await supabase
    .from('debates')
    .select('id, title, date')
    .or('title.ilike.%immigration%,title.ilike.%asylum%,title.ilike.%refugee%,title.ilike.%migrant%');
  console.log('\nImmigration-related debates:', immigrationDebates?.length || 0);
  if (immigrationDebates) {
    immigrationDebates.forEach(d => console.log(`- ${d.date}: ${d.title}`));
  }
  
  // Check speeches with immigration content in paragraphs
  const { data: speeches } = await supabase
    .from('debate_speeches')
    .select('id, speaker_name, paragraphs, recorded_time')
    .limit(1000);
    
  let immigrationCount = 0;
  const immigrationSpeakers: Record<string, number> = {};
  
  if (speeches) {
    for (const s of speeches) {
      let text = '';
      if (Array.isArray(s.paragraphs)) {
        text = s.paragraphs.join(' ').toLowerCase();
      } else if (typeof s.paragraphs === 'string') {
        text = s.paragraphs.toLowerCase();
      }
      
      if (text.includes('immigration') || text.includes('migrant') || text.includes('asylum') || text.includes('refugee')) {
        immigrationCount++;
        immigrationSpeakers[s.speaker_name] = (immigrationSpeakers[s.speaker_name] || 0) + 1;
        if (immigrationCount <= 5) {
          console.log(`\n[${s.recorded_time}] ${s.speaker_name}:`);
          console.log(text.substring(0, 300) + '...');
        }
      }
    }
  }
  
  console.log('\n\nSpeeches with immigration keywords in first 1000:', immigrationCount);
  console.log('Speakers:', immigrationSpeakers);
}

checkDebates().catch(console.error);

