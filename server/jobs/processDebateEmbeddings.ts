
import 'dotenv/config';
import { supabaseDb } from '../db';
import { generateEmbedding } from '../services/openaiService';

const CHUNK_SIZE_TOKENS = 500; // Approx tokens per chunk
const CHARS_PER_TOKEN = 4; // Rough estimate
const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
const BATCH_SIZE = 20; // Speeches per batch

async function processDebateEmbeddings() {
  if (!supabaseDb) {
    console.error('❌ Supabase client not available');
    process.exit(1);
  }

  console.log('🧠 Starting Debate Embedding Processor...');

  while (true) {
    // 1. Fetch unchunked speeches
    const { data: speeches, error } = await supabaseDb.rpc('get_unchunked_speeches', {
      limit_count: BATCH_SIZE
    });

    if (error) {
      console.error('❌ Error fetching unchunked speeches:', error);
      break;
    }

    if (!speeches || speeches.length === 0) {
      console.log('✅ No more unchunked speeches found. Done!');
      break;
    }

    console.log(`📦 Processing batch of ${speeches.length} speeches...`);

    for (const speech of speeches) {
      try {
        await processSpeech(speech);
      } catch (err) {
        console.error(`❌ Failed to process speech ${speech.id}:`, err);
        // Continue to next speech
      }
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function processSpeech(speech: any) {
  // Handle JSONB paragraphs - might be string or array
  let paragraphs: string[];
  if (typeof speech.paragraphs === 'string') {
    try {
      paragraphs = JSON.parse(speech.paragraphs);
    } catch {
      console.error(`Failed to parse paragraphs for speech ${speech.id}`);
      return;
    }
  } else if (Array.isArray(speech.paragraphs)) {
    paragraphs = speech.paragraphs;
  } else {
    console.error(`Invalid paragraphs type for speech ${speech.id}: ${typeof speech.paragraphs}`);
    return;
  }

  if (!paragraphs || paragraphs.length === 0) return;

  // 1. Chunking Strategy
  // Simple grouping of paragraphs
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (typeof para !== 'string') continue;
    if ((currentChunk.length + para.length) > CHUNK_SIZE_CHARS && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += (currentChunk ? '\n\n' : '') + para;
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // 2. Embed & Save
  let chunksCreated = 0;
  for (const chunkContent of chunks) {
    // Skip extremely short chunks (e.g. "Agreed.")
    if (chunkContent.length < 20) continue;

    try {
      const embedding = await generateEmbedding(chunkContent);

      const { error } = await supabaseDb!.from('debate_chunks').insert({
        speech_id: speech.id,
        chunk_content: chunkContent,
        embedding,
        politician_name: speech.speaker_name,
        party: speech.speaker_party,
        date: speech.recorded_time,
        topic: speech.metadata?.topic || null
      });

      if (error) {
        console.error(`Insert error for speech ${speech.id}: ${error.message}`);
        continue;
      }
      chunksCreated++;
    } catch (err) {
      console.error(`Embedding/insert error: ${err}`);
      continue;
    }
  }
  
  if (chunksCreated > 0) {
    process.stdout.write(`+${chunksCreated}`);
  } else {
    process.stdout.write('.');
  }
}

processDebateEmbeddings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

