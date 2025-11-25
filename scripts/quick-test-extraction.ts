/**
 * Quick Test Extraction
 * Tests the extraction with a small batch to verify it works
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import { classifyQuestionTopic, analyzeAnswerSentiment } from '../server/services/oireachtasAPIService.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

async function quickTestExtraction() {
  console.log('🧪 QUICK TEST EXTRACTION');
  console.log('═'.repeat(70));
  console.log('Testing with 100 questions to verify matching works\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get TDs
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} TDs`);

  // Create lookup with all URI variations
  const tdLookup = new Map<string, any>();
  tds.forEach(td => {
    if (td.member_uri) tdLookup.set(td.member_uri, td);
    if (td.member_code) {
      tdLookup.set(`/ie/oireachtas/member/${td.member_code}`, td);
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/${td.member_code}`, td);
    }
  });

  console.log(`✅ Created lookup with ${tdLookup.size} entries\n`);

  // Fetch just 100 questions
  console.log('📥 Fetching 100 recent questions...');
  const response = await apiClient.get('/questions', {
    params: {
      date_start: '2024-11-01',
      limit: 100
    }
  });

  const questions = response.data.results || [];
  console.log(`✅ Fetched ${questions.length} questions\n`);

  // Process and match
  console.log('🔗 Matching questions to TDs...');
  let matched = 0;
  let unmatched = 0;
  const questionsToInsert: any[] = [];

  for (const result of questions) {
    const q = result.question;
    const memberUri = q.by?.uri;

    if (!memberUri) {
      unmatched++;
      continue;
    }

    const td = tdLookup.get(memberUri);

    if (!td) {
      unmatched++;
      console.log(`   ⏭️  No match: ${q.by?.showAs} (${memberUri})`);
      continue;
    }

    matched++;

    const topic = await classifyQuestionTopic(
      q.showAs || q.subject || '',
      q.questionText || q.text || ''
    );
    const sentiment = analyzeAnswerSentiment(
      q.answer?.answerText || q.answer?.text || null
    );

    questionsToInsert.push({
      td_id: td.id,
      question_id: `q-${q.questionNumber}-${q.date}`,
      question_uri: q.uri || '',
      question_number: `${q.questionNumber}`,
      question_type: q.questionType === 'oral' ? 'oral' : 'written',
      date_asked: q.date || '',
      date_answered: q.answer?.date || null,
      subject: (q.showAs || q.subject || '').substring(0, 500),
      question_text: (q.questionText || q.text || '').substring(0, 5000),
      answer_text: (q.answer?.answerText || q.answer?.text || '').substring(0, 10000),
      minister_name: q.to?.showAs || null,
      minister_uri: q.to?.uri || null,
      department: q.department || null,
      ai_topic: topic,
      ai_sentiment: sentiment,
      ai_extracted_at: new Date().toISOString(),
      debate_uri: q.debate?.uri || q.debateSection?.uri || null,
      debate_section: q.debateSection?.showAs || null
    });

    if (matched <= 10) {
      console.log(`   ✅ ${td.politician_name.padEnd(30)} → ${topic}`);
    }
  }

  console.log(`\n📊 Matched: ${matched}, Unmatched: ${unmatched}`);

  // Batch insert
  if (questionsToInsert.length > 0) {
    console.log(`\n💾 Inserting ${questionsToInsert.length} questions...`);
    
    const { error: insertError } = await supabase
      .from('td_questions')
      .upsert(questionsToInsert, {
        onConflict: 'question_id',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
    } else {
      console.log(`✅ Successfully inserted ${questionsToInsert.length} questions!`);
    }
  }

  console.log('\n═'.repeat(70));
  console.log('✅ TEST COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`If matched > 0, the fix worked! 🎉`);
  console.log(`You can now run the full extraction scripts.`);
}

quickTestExtraction().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

