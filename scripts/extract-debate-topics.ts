/**
 * Extract Debate Topics (System-Wide)
 * Tracks what's being debated in the Dáil without individual attribution
 * Useful for showing current political focus and legislative activity
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

interface DebateTopic {
  date: string;
  chamber: string;
  debate_type: string;
  topic: string;
  contributor_count: number;
  bill_title?: string;
  created_at: string;
}

async function extractDebateTopics() {
  console.log('💭 EXTRACTING DEBATE TOPICS (SYSTEM-WIDE)');
  console.log('═'.repeat(70));
  console.log('This tracks what\'s being debated without individual TD attribution\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  const topics: DebateTopic[] = [];
  const dateStart = '2024-01-01';
  let skip = 0;
  const limit = 100;

  console.log('📥 Fetching debates from API...');
  console.log('─'.repeat(70));

  // Fetch debates in batches
  while (true) {
    const url = `https://api.oireachtas.ie/v1/debates?date_start=${dateStart}&chamber=dail&limit=${limit}&skip=${skip}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) break;
      
      console.log(`   Fetched ${data.results.length} debates (skip=${skip})`);
      
      // Process each debate
      for (const result of data.results) {
        const debate = result.debateRecord;
        
        // Process each section
        for (const sectionWrapper of (debate.debateSections || [])) {
          const section = sectionWrapper.debateSection;
          
          // Only track sections with actual debate activity
          if (!section.containsDebate || section.counts.speakerCount === 0) {
            continue;
          }
          
          topics.push({
            date: debate.date,
            chamber: debate.house?.showAs || 'Dáil Éireann',
            debate_type: debate.debateType || 'debate',
            topic: section.showAs || 'Unknown Topic',
            contributor_count: section.counts.speakerCount || 0,
            bill_title: section.bill?.showAs || undefined,
            created_at: new Date().toISOString()
          });
        }
      }
      
      skip += limit;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`❌ Error fetching batch: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Extracted ${topics.length} debate topics\n`);

  // Show top topics
  console.log('📊 Sample topics:');
  const sampleTopics = topics
    .filter(t => t.contributor_count > 5)
    .slice(0, 10);
  
  for (const topic of sampleTopics) {
    console.log(`   ${topic.date} - ${topic.topic.substring(0, 60)}`);
    console.log(`      Chamber: ${topic.chamber}, Contributors: ${topic.contributor_count}`);
  }

  // Create table if it doesn't exist
  console.log('\n📦 Creating debate_topics table...');
  
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS debate_topics (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        chamber VARCHAR(255),
        debate_type VARCHAR(100),
        topic TEXT NOT NULL,
        contributor_count INTEGER DEFAULT 0,
        bill_title TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_debate_topics_date ON debate_topics(date DESC);
      CREATE INDEX IF NOT EXISTS idx_debate_topics_chamber ON debate_topics(chamber);
    `
  });

  if (createError) {
    console.log('⚠️  Table might already exist or RPC not available');
  }

  // Clear existing data
  console.log('\n🗑️  Clearing existing topics...');
  await supabase.from('debate_topics').delete().gte('id', 0);

  // Insert new topics in batches
  console.log('\n💾 Inserting topics...');
  console.log('─'.repeat(70));

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < topics.length; i += batchSize) {
    const batch = topics.slice(i, i + batchSize);
    
    const { error: insertError } = await supabase
      .from('debate_topics')
      .insert(batch);

    if (insertError) {
      console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, insertError.message);
    } else {
      inserted += batch.length;
      console.log(`   ✅ Inserted ${inserted}/${topics.length}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Topics extracted: ${topics.length}`);
  console.log(`Topics inserted: ${inserted}`);
  console.log('═'.repeat(70));
  
  // Show summary stats
  const chambers = new Set(topics.map(t => t.chamber));
  const billTopics = topics.filter(t => t.bill_title);
  
  console.log('\n📈 SUMMARY:');
  console.log(`   Chambers: ${Array.from(chambers).join(', ')}`);
  console.log(`   Bill discussions: ${billTopics.length}`);
  console.log(`   Average contributors: ${Math.round(topics.reduce((sum, t) => sum + t.contributor_count, 0) / topics.length)}`);
}

extractDebateTopics().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




