
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Hardcoded for repair session
const SUPABASE_URL = 'https://ospxqnxlotakujloltqy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zcHhxbnhsb3Rha3VqbG9sdHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNjk1ODAsImV4cCI6MjA2NzY0NTU4MH0.-Udyszn2tSHbJW57R9OHdAtwmgULGP--9QQLWtOFetA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function repairVoteSubjects() {
  console.log('🚑 REPAIRING CORRUPTED VOTE SUBJECTS');
  console.log('═'.repeat(50));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  let totalFixed = 0;
  
  while (true) {
    console.log('📊 Fetching next batch of corrupted divisions...');
    const { data: votes, error } = await supabase
        .from('td_votes')
        .select('vote_uri')
        .eq('vote_subject', '[object Object]')
        .limit(1000);

    if (error || !votes || votes.length === 0) {
        console.log('✅ No more corrupted votes found.');
        break;
    }

    const uniqueUris = [...new Set(votes.map(v => v.vote_uri))].filter(Boolean);
    console.log(`   Found ${uniqueUris.length} unique divisions in this batch.`);
    
    if (uniqueUris.length === 0) break;

    let batchFixed = 0;
    let batchErrors = 0;

    for (let i = 0; i < uniqueUris.length; i++) {
        const uri = uniqueUris[i];
        // ... existing processing logic ...
        try {
            const response = await apiClient.get('/divisions', {
                params: { division_id: uri, limit: 1 }
            });
            const result = response.data.results?.[0]?.division;
            if (!result) {
                console.log(`   ⚠️ No API result for ${uri}`);
                batchErrors++;
                continue;
            }
            const correctSubject = result.subject?.showAs || result.showAs;
            if (!correctSubject) {
                console.log(`   ⚠️ No subject found`);
                continue;
            }
            
            const { error: updateError } = await supabase
                .from('td_votes')
                .update({ vote_subject: correctSubject })
                .eq('vote_uri', uri);
                
            if (updateError) {
                console.error(`   ❌ Update failed: ${updateError.message}`);
                batchErrors++;
            } else {
                console.log(`   ✅ Fixed: "${correctSubject.substring(0, 40)}..."`);
                batchFixed++;
            }
            await new Promise(r => setTimeout(r, 50)); // Faster rate limit
        } catch (err: any) {
             console.error(`   ❌ Error: ${err.message}`);
             batchErrors++;
        }
    }
    
    totalFixed += batchFixed;
    if (batchFixed === 0 && batchErrors > 0) {
        console.log('⚠️ Aborting loop due to lack of progress.');
        break;
    }
  }

  console.log('═'.repeat(50));
  console.log(`🏁 REPAIR COMPLETE`);
  console.log(`✅ Divisions Fixed: ${fixedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

repairVoteSubjects().catch(err => console.error(err));

