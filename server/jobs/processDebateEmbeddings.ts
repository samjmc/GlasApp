
import 'dotenv/config';
import { supabaseDb } from '../db';
import { generateEmbedding } from '../services/openaiService';

const CHUNK_SIZE_TOKENS = 500; // Approx tokens per chunk
const CHARS_PER_TOKEN = 4; // Rough estimate
const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;

// BALANCED SPEED: Optimized but stable
const SCAN_BATCH_SIZE = 200; // Balanced batch size
const PARALLEL_SPEECHES = 5; // Process 5 speeches concurrently

// Stats tracking
let totalProcessed = 0;
let totalChunksCreated = 0;
const startTime = Date.now();

function logStats() {
  const elapsed = (Date.now() - startTime) / 1000 / 60; // minutes
  const rate = totalProcessed / elapsed;
  console.log(`\n📊 STATS: ${totalProcessed} speeches, ${totalChunksCreated} chunks | ${rate.toFixed(1)} speeches/min | ${elapsed.toFixed(1)} min elapsed`);
}

// Log stats every 2 minutes
setInterval(logStats, 120000);

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n\n🛑 SIGINT received - Graceful shutdown');
  logStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 SIGTERM received - Graceful shutdown');
  logStats();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('\n\n💥 UNCAUGHT EXCEPTION:', err);
  logStats();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n\n💥 UNHANDLED REJECTION:', reason);
  logStats();
});

async function processDebateEmbeddings() {
  if (!supabaseDb) {
    console.error('❌ Supabase client not available');
    process.exit(1);
  }

  console.log('🧠 Starting Debate Embedding Processor (SPEED MODE)...');
  console.log(`📅 Scanning ALL speeches (newest first) - Batch size: ${SCAN_BATCH_SIZE}`);
  console.log('⏱️  Stats logged every 2 minutes. Press Ctrl+C to stop gracefully.\n');

  let offset = 0;
  let consecutiveErrors = 0;

  while (true) {
    try {
      // 1. Fetch a batch of speeches - scan ALL, newest first
      const { data: candidates, error } = await supabaseDb
        .from('debate_speeches')
        .select('id, paragraphs, speaker_name, speaker_party, recorded_time, metadata')
        .order('recorded_time', { ascending: false })
        .range(offset, offset + SCAN_BATCH_SIZE - 1);

      if (error) {
        console.error(`\n❌ Error scanning speeches (Offset ${offset}):`, error.message);
        consecutiveErrors++;
        if (consecutiveErrors > 10) {
            console.error('💥 Too many consecutive errors. Aborting.');
            logStats();
            break;
        }
        await new Promise(r => setTimeout(r, 1000)); // Faster retry
        continue;
      }

      if (!candidates || candidates.length === 0) {
        console.log('\n✅ No more speeches found in scan range. BACKFILL COMPLETE!');
        logStats();
        break;
      }
      
      consecutiveErrors = 0;

      // 2. Check which ones are already processed
      const candidateIds = candidates.map(s => s.id);
      
      const { data: existingChunks, error: checkError } = await supabaseDb
        .from('debate_chunks')
        .select('speech_id')
        .in('speech_id', candidateIds);

      if (checkError) {
          console.error('\n❌ Error checking existing chunks:', checkError.message);
          offset += candidates.length;
          continue;
      }

      const processedIds = new Set(existingChunks?.map((c: any) => c.speech_id) || []);
      const speechesToProcess = candidates.filter(s => !processedIds.has(s.id));

      if (speechesToProcess.length > 0) {
          console.log(`\n📦 [Offset ${offset}] Processing ${speechesToProcess.length}/${candidates.length} speeches (parallel: ${PARALLEL_SPEECHES})`);
          
          // Process speeches in parallel batches
          for (let i = 0; i < speechesToProcess.length; i += PARALLEL_SPEECHES) {
            const batch = speechesToProcess.slice(i, i + PARALLEL_SPEECHES);
            
            // Process batch in parallel
            const results = await Promise.allSettled(
              batch.map(speech => processSpeech(speech))
            );
            
            // Count successes
            results.forEach((result, idx) => {
              if (result.status === 'fulfilled') {
                totalProcessed++;
                totalChunksCreated += result.value;
              } else {
                console.error(`\n❌ Failed speech ${batch[idx].id}: ${result.reason?.message || result.reason}`);
              }
            });
          }
      } else {
          // Log progress every 2000 skipped
          if (offset % 2000 === 0) {
              console.log(`⏩ [Offset ${offset}] Skipping processed batch...`);
          }
      }

      // 3. Advance Offset
      offset += candidates.length;

      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 10));

    } catch (err: any) {
        console.error('\n❌ Unexpected loop error:', err.message || err);
        await new Promise(r => setTimeout(r, 3000));
    }
  }
}

async function processSpeech(speech: any): Promise<number> {
  // Handle JSONB paragraphs - might be string or array
  let paragraphs: string[];
  if (typeof speech.paragraphs === 'string') {
    try {
      paragraphs = JSON.parse(speech.paragraphs);
    } catch {
      console.error(`Failed to parse paragraphs for speech ${speech.id}`);
      return 0;
    }
  } else if (Array.isArray(speech.paragraphs)) {
    paragraphs = speech.paragraphs;
  } else {
    console.error(`Invalid paragraphs type for speech ${speech.id}: ${typeof speech.paragraphs}`);
    return 0;
  }

  if (!paragraphs || paragraphs.length === 0) return 0;

  // 1. Chunking Strategy
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

  // 2. Embed & Save - Bulk Insert Strategy
  const chunksToInsert: any[] = [];
  
  for (const chunkContent of chunks) {
    if (chunkContent.length < 20) continue;

    try {
      const embedding = await generateEmbedding(chunkContent);
      
      chunksToInsert.push({
        speech_id: speech.id,
        chunk_content: chunkContent,
        embedding,
        politician_name: speech.speaker_name,
        party: speech.speaker_party,
        date: speech.recorded_time,
        topic: speech.metadata?.topic || null
      });

      // ZERO delay - maximum speed (OpenAI handles rate limiting)
      // await new Promise(resolve => setTimeout(resolve, 0));

    } catch (err: any) {
      // Log specific OpenAI errors
      if (err.message?.includes('rate')) {
        console.error(`\n⚠️ Rate limit hit - waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000)); // Faster recovery
      } else {
        console.error(`\nEmbedding error: ${err.message || err}`);
      }
      continue;
    }
  }

  if (chunksToInsert.length > 0) {
    try {
      const { error } = await supabaseDb!.from('debate_chunks').insert(chunksToInsert);
      
      if (error) {
        console.error(`\nBulk insert error for speech ${speech.id}: ${error.message}`);
        return 0;
      } else {
        process.stdout.write(`+${chunksToInsert.length} `);
        return chunksToInsert.length;
      }
    } catch (err: any) {
      console.error(`\nBulk insert exception: ${err.message || err}`);
      return 0;
    }
  } else {
    process.stdout.write('.');
    return 0;
  }
}

processDebateEmbeddings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
