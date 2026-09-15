/**
 * Test Debate Processing
 * Test processing a single speech to verify the system works
 */

import 'dotenv/config';
import { analyzeDebateSpeech, analyzeVoteRecord } from '../services/debateIdeologyAnalysisService.js';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function testProcessing() {
  console.log('🧪 Testing Debate Ideology Processing\n');
  
  // Test with a single speech
  const { supabaseDb } = await import('../db.js');
  
  if (!supabaseDb) {
    console.error('❌ Database not initialized');
    return;
  }
  
  // Get one unprocessed speech
  const { data: speech } = await supabaseDb
    .from('debate_speeches')
    .select('id, speaker_name, speaker_party, word_count')
    .limit(1)
    .maybeSingle();
  
  if (!speech) {
    console.log('❌ No speeches found');
    return;
  }
  
  console.log(`📝 Testing with speech by ${speech.speaker_name} (${speech.speaker_party || 'Independent'})`);
  console.log(`   Speech ID: ${speech.id}`);
  console.log(`   Word count: ${speech.word_count}\n`);
  
  try {
    await analyzeDebateSpeech(speech.id);
    console.log('\n✅ Speech analysis complete!');
  } catch (error: unknown) {
    console.error('\n❌ Error:', errorMessage(error));
    console.error(error instanceof Error ? error.stack : undefined);
  }
  
  // Test with a single vote
  const { data: vote } = await supabaseDb
    .from('td_votes')
    .select('id, td_scores:td_id(politician_name, party)')
    .limit(1)
    .maybeSingle();
  
  if (vote) {
    const tdMeta = vote.td_scores as { politician_name?: string; party?: string } | null;
    console.log(`\n🗳️  Testing with vote by ${tdMeta?.politician_name || 'Unknown'}`);
    console.log(`   Vote ID: ${vote.id}\n`);
    
    try {
      await analyzeVoteRecord(vote.id);
      console.log('\n✅ Vote analysis complete!');
    } catch (error: unknown) {
      console.error('\n❌ Error:', errorMessage(error));
      console.error(error instanceof Error ? error.stack : undefined);
    }
  }
  
  console.log('\n✅ Test complete!');
}

testProcessing()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

