import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkEmbeddings() {
  console.log('Checking embeddings in debate_chunks...\n');
  
  // Check if embeddings exist
  const { data: chunks, error } = await supabase
    .from('debate_chunks')
    .select('id, politician_name, embedding, chunk_content')
    .ilike('politician_name', '%Harris%')
    .limit(3);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  console.log('Harris chunks:');
  if (chunks) {
    chunks.forEach(c => {
      const embed = c.embedding;
      let embedInfo = 'none';
      if (embed) {
        if (Array.isArray(embed)) {
          embedInfo = `array[${embed.length}]`;
        } else if (typeof embed === 'string') {
          embedInfo = `string[${embed.length} chars]`;
        } else {
          embedInfo = typeof embed;
        }
      }
      console.log(`- ${c.id.substring(0, 8)}: embedding=${embedInfo}`);
      console.log(`  Content: ${c.chunk_content?.substring(0, 60)}...`);
    });
  }
  
  // Count chunks with embeddings
  const { data: allChunks } = await supabase
    .from('debate_chunks')
    .select('id, embedding')
    .limit(1000);
  
  let withEmbedding = 0;
  let withoutEmbedding = 0;
  
  if (allChunks) {
    allChunks.forEach(c => {
      if (c.embedding && (Array.isArray(c.embedding) ? c.embedding.length > 0 : c.embedding)) {
        withEmbedding++;
      } else {
        withoutEmbedding++;
      }
    });
  }
  
  console.log(`\nChunks with embeddings: ${withEmbedding}`);
  console.log(`Chunks without embeddings: ${withoutEmbedding}`);
}

checkEmbeddings().catch(console.error);




