/**
 * Extract All 2024-2025 Questions
 * Complete extraction for current Dáil term
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

async function extract20242025() {
  console.log('🚀 EXTRACTING ALL 2024-2025 QUESTIONS');
  console.log('═'.repeat(70));
  console.log('This will fetch all questions from Jan 1, 2024 to present');
  console.log('Expected: ~10,000-15,000 questions');
  console.log('Estimated time: 10-15 minutes\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  const startTime = Date.now();

  // Step 1: Load TDs
  console.log('📊 Step 1: Loading TDs from database...');
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

  // Step 2: Fetch ALL questions from 2024-2025
  console.log('📥 Step 2: Fetching ALL 2024-2025 questions from API...');
  console.log('This will take 5-10 minutes...\n');
  
  const allQuestions: any[] = [];
  const dateFrom = '2024-01-01';
  const dateTo = new Date().toISOString().split('T')[0];
  let skip = 0;
  const limit = 500;
  let batchNum = 0;

  console.log(`Date range: ${dateFrom} to ${dateTo}\n`);

  while (true) {
    batchNum++;
    const batchStart = Date.now();
    
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
        console.log('   ✅ Reached end of results\n');
        break;
      }

      allQuestions.push(...results);
      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
      console.log(`   Batch ${batchNum.toString().padStart(3)}: ${results.length} questions (Total: ${allQuestions.length.toLocaleString()}) - ${batchTime}s`);

      if (results.length < limit) {
        console.log('   ✅ Fetched all available questions\n');
        break;
      }

      skip += limit;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error: any) {
      console.error(`   ❌ Error on batch ${batchNum}: ${error.message}`);
      break;
    }
  }

  const fetchTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`✅ Total questions fetched: ${allQuestions.length.toLocaleString()}`);
  console.log(`   Time: ${fetchTime} minutes\n`);

  // Step 3: Match and classify
  console.log('🔗 Step 3: Matching to TDs and classifying...');
  console.log('This will take 3-5 minutes...\n');

  let matched = 0;
  let unmatched = 0;
  const questionsToInsert: any[] = [];
  const classifyStart = Date.now();

  for (let i = 0; i < allQuestions.length; i++) {
    const result = allQuestions[i];
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

    if (matched % 500 === 0) {
      const progress = ((i / allQuestions.length) * 100).toFixed(1);
      const elapsed = ((Date.now() - classifyStart) / 1000 / 60).toFixed(1);
      console.log(`   Progress: ${progress}% - ${matched.toLocaleString()} matched, ${unmatched.toLocaleString()} unmatched (${elapsed} min)`);
    }
  }

  const classifyTime = ((Date.now() - classifyStart) / 1000 / 60).toFixed(1);
  console.log(`\n✅ Matched: ${matched.toLocaleString()}, Unmatched: ${unmatched.toLocaleString()}`);
  console.log(`   Classification time: ${classifyTime} minutes\n`);

  // Step 4: Batch insert
  console.log(`💾 Step 4: Inserting ${questionsToInsert.length.toLocaleString()} questions...`);
  
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000;
  const insertStart = Date.now();

  for (let i = 0; i < questionsToInsert.length; i += batchSize) {
    const batch = questionsToInsert.slice(i, i + batchSize);
    
    try {
      const { error: insertError } = await supabase
        .from('td_questions')
        .upsert(batch, {
          onConflict: 'question_id',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${insertError.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
        const progress = ((inserted / questionsToInsert.length) * 100).toFixed(0);
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(questionsToInsert.length / batchSize)}: ${inserted.toLocaleString()}/${questionsToInsert.length.toLocaleString()} (${progress}%)`);
      }
    } catch (error: any) {
      console.error(`   ❌ Batch error: ${error.message}`);
      errors += batch.length;
    }
  }

  const insertTime = ((Date.now() - insertStart) / 1000).toFixed(1);
  console.log(`\n✅ Inserted ${inserted.toLocaleString()} questions in ${insertTime}s`);

  // Final stats
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  const { data: stats } = await supabase.from('td_questions').select('ai_topic, question_type');

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 EXTRACTION COMPLETE!');
  console.log('═'.repeat(70));
  console.log(`Total time:                  ${totalTime} minutes`);
  console.log(`Questions fetched from API:  ${allQuestions.length.toLocaleString()}`);
  console.log(`Questions matched to TDs:    ${matched.toLocaleString()}`);
  console.log(`Questions inserted:          ${inserted.toLocaleString()}`);
  console.log(`Total in database:           ${stats?.length.toLocaleString() || 0}`);
  console.log('═'.repeat(70));

  if (stats) {
    const oralCount = stats.filter(s => s.question_type === 'oral').length;
    const writtenCount = stats.filter(s => s.question_type === 'written').length;
    
    console.log('\n📊 DATABASE STATISTICS:');
    console.log(`   Oral questions:     ${oralCount.toLocaleString()}`);
    console.log(`   Written questions:  ${writtenCount.toLocaleString()}`);

    // Top topics
    const topicCounts: Record<string, number> = {};
    stats.forEach(s => {
      topicCounts[s.ai_topic || 'Unknown'] = (topicCounts[s.ai_topic || 'Unknown'] || 0) + 1;
    });

    console.log('\n🏷️  TOP 10 TOPICS:');
    Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([topic, count]) => {
        console.log(`   ${topic.padEnd(35)} ${count.toLocaleString().padStart(6)}`);
      });
  }

  console.log('\n✅ All 2024-2025 questions extracted successfully!\n');
}

extract20242025().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

