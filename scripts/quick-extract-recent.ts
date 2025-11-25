/**
 * Quick Extract Recent Data
 * Extracts just the last 2 weeks to verify everything works
 * This should complete in 2-3 minutes
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

async function quickExtractRecent() {
  console.log('🚀 QUICK RECENT DATA EXTRACTION');
  console.log('═'.repeat(70));
  console.log('Extracting last 2 weeks of questions (should be ~500-1000)');
  console.log('This will complete in 2-3 minutes!\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get TDs
  console.log('📊 Step 1: Loading TDs...');
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

  // Calculate date range (last 2 weeks)
  const today = new Date();
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(today.getDate() - 14);
  
  const dateFrom = twoWeeksAgo.toISOString().split('T')[0];
  const dateTo = today.toISOString().split('T')[0];

  console.log(`📅 Date range: ${dateFrom} to ${dateTo}\n`);

  // Fetch questions
  console.log('📥 Step 2: Fetching recent questions from API...');
  const allQuestions: any[] = [];
  let skip = 0;
  const limit = 500;

  while (true) {
    console.log(`   Fetching batch (skip: ${skip})...`);
    
    try {
      const response = await apiClient.get('/questions', {
        params: {
          date_start: dateFrom,
          date_end: dateTo,
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        console.log('   ✅ No more questions\n');
        break;
      }

      allQuestions.push(...results);
      console.log(`   ✅ Fetched ${results.length} (Total: ${allQuestions.length})`);

      if (results.length < limit) break;

      skip += limit;

      if (skip > 2000) {
        console.log('   ⚠️  Safety limit reached\n');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Total questions fetched: ${allQuestions.length}\n`);

  // Match and prepare
  console.log('🔗 Step 3: Matching to TDs and classifying...');
  let matched = 0;
  let unmatched = 0;
  const questionsToInsert: any[] = [];

  for (const result of allQuestions) {
    const q = result.question;
    const memberUri = q.by?.uri;

    if (!memberUri) {
      unmatched++;
      continue;
    }

    const td = tdLookup.get(memberUri);

    if (!td) {
      unmatched++;
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

    if (matched % 50 === 0) {
      console.log(`   Progress: ${matched} matched, ${unmatched} unmatched`);
    }
  }

  console.log(`\n✅ Matched: ${matched}, Unmatched: ${unmatched}\n`);

  // Batch insert
  if (questionsToInsert.length > 0) {
    console.log(`💾 Step 4: Inserting ${questionsToInsert.length} questions...`);
    
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

  // Show results
  const { data: stats } = await supabase.from('td_questions').select('*');
  
  console.log('\n' + '═'.repeat(70));
  console.log('✅ EXTRACTION COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`Total questions in database: ${stats?.length || 0}`);
  console.log('');
  console.log('🎉 The extraction is working!');
  console.log('   Now you can run the full extraction or continue with recent data.');
  console.log('═'.repeat(70));
}

quickExtractRecent().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

