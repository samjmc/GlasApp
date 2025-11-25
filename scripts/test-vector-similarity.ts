import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../server/services/openaiService';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function testVectorSimilarity() {
  console.log('Testing vector similarity search...\n');
  
  // 1. Generate a real embedding for "immigration"
  console.log('Generating embedding for "immigration policy views"...');
  const embedding = await generateEmbedding('What are your views on immigration?');
  console.log(`Generated embedding with ${embedding.length} dimensions`);
  
  // 2. Convert to string format for pgvector
  const embeddingString = `[${embedding.join(',')}]`;
  
  // 3. Test the RPC function
  console.log('\nTesting match_debate_chunks_text RPC...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('match_debate_chunks_text', {
    query_embedding_text: embeddingString,
    match_politician: 'Harris',
    match_threshold: 0.2,
    match_count: 10
  });
  
  console.log('RPC Error:', rpcError?.message || 'none');
  console.log('RPC Results:', rpcData?.length || 0);
  if (rpcData && rpcData.length > 0) {
    rpcData.forEach((d: any) => {
      console.log(`- ${d.politician_name} (sim: ${d.similarity?.toFixed(3)}): ${d.chunk_content?.substring(0, 60)}...`);
    });
  }
  
  // 4. If RPC fails, test a simple similarity query directly
  if (!rpcData || rpcData.length === 0) {
    console.log('\nRPC returned no results. Testing direct query approach...');
    
    // Get a chunk and compare directly
    const { data: testChunk } = await supabase
      .from('debate_chunks')
      .select('id, chunk_content, embedding')
      .ilike('politician_name', '%Harris%')
      .limit(1);
    
    if (testChunk && testChunk.length > 0) {
      console.log('\nFound test chunk:', testChunk[0].chunk_content?.substring(0, 60));
      console.log('Embedding type:', typeof testChunk[0].embedding);
      console.log('Embedding preview:', String(testChunk[0].embedding).substring(0, 100));
    }
  }
  
  // 5. Also test with Alan Dillon who has many chunks
  console.log('\n\nTesting with Alan Dillon (most chunks)...');
  const { data: dillonData, error: dillonError } = await supabase.rpc('match_debate_chunks_text', {
    query_embedding_text: embeddingString,
    match_politician: 'Dillon',
    match_threshold: 0.2,
    match_count: 5
  });
  
  console.log('Dillon RPC Error:', dillonError?.message || 'none');
  console.log('Dillon Results:', dillonData?.length || 0);
  if (dillonData && dillonData.length > 0) {
    dillonData.forEach((d: any) => {
      console.log(`- ${d.politician_name} (sim: ${d.similarity?.toFixed(3)}): ${d.chunk_content?.substring(0, 60)}...`);
    });
  }
}

testVectorSimilarity().catch(console.error);

