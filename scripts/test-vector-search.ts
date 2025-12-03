import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testVectorSearch() {
  console.log('Testing vector search function...\n');
  
  // Test the vector search function with a dummy embedding
  const testEmbedding = new Array(1536).fill(0.01);
  const embeddingString = '[' + testEmbedding.join(',') + ']';
  
  const { data, error } = await supabase.rpc('match_debate_chunks_text', {
    query_embedding_text: embeddingString,
    match_politician: 'Harris',
    match_threshold: 0.1,
    match_count: 5
  });
  
  console.log('Vector search test result:');
  console.log('Error:', error?.message || 'none');
  console.log('Results:', data?.length || 0);
  if (data) {
    data.forEach((d: any) => {
      console.log(`- ${d.politician_name} (sim: ${d.similarity?.toFixed(3)}): ${d.chunk_content?.substring(0, 60)}...`);
    });
  }
  
  // Check if the function exists
  const { data: funcs, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname')
    .ilike('proname', '%match_debate%');
  
  console.log('\nFunctions matching "match_debate":', funcs?.length || 0);
  if (funcError) console.log('Function lookup error:', funcError.message);
}

testVectorSearch().catch(console.error);




