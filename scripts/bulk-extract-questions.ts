/**
 * Bulk Questions Extraction
 * WORKAROUND for broken member_id filtering
 * Fetches ALL questions, then matches to TDs client-side
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

async function bulkExtractQuestions() {
  console.log('🚀 BULK QUESTIONS EXTRACTION');
  console.log('═'.repeat(70));
  console.log('WORKAROUND: Fetching ALL questions, filtering client-side');
  console.log('This bypasses the broken member_id API filter!\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Step 1: Get all TDs from database
  console.log('📊 Step 1: Loading TDs from database...');
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} TDs\n`);

  // Create lookup map: member URI → TD
  // Handle multiple URI formats from API
  const tdLookup = new Map<string, any>();
  tds.forEach(td => {
    if (td.member_uri) {
      tdLookup.set(td.member_uri, td);
    }
    if (td.member_code) {
      // Store multiple variations to handle API inconsistencies
      tdLookup.set(`/ie/oireachtas/member/${td.member_code}`, td);
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td); // API format
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td); // Full URL
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/${td.member_code}`, td); // Alt format
    }
  });

  console.log(`✅ Created lookup map with ${tdLookup.size} entries\n`);

  // Step 2: Fetch ALL questions from API
  console.log('📋 Step 2: Fetching ALL questions from Oireachtas API...');
  console.log('This may take several minutes...\n');

  const allQuestions: any[] = [];
  const dateFrom = '2024-01-01';
  const dateTo = new Date().toISOString().split('T')[0];
  let skip = 0;
  const limit = 500;
  let totalFetched = 0;

  while (true) {
    console.log(`   Fetching batch ${Math.floor(skip / limit) + 1} (skip: ${skip})...`);

    try {
      const response = await apiClient.get('/questions', {
        params: {
          date_start: dateFrom,
          date_end: dateTo,
          show_answers: true,
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        console.log('   ✅ No more questions to fetch\n');
        break;
      }

      allQuestions.push(...results);
      totalFetched += results.length;
      console.log(`   ✅ Fetched ${results.length} questions (Total: ${totalFetched})`);

      // Check if we've reached the end
      if (results.length < limit) break;

      skip += limit;

      // Safety limit
      if (skip > 20000) {
        console.log('   ⚠️  Reached safety limit of 20,000 questions');
        break;
      }

      // Rate limiting - pause between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.error(`   ❌ Error fetching batch: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Total questions fetched: ${allQuestions.length}`);

  // Step 3: Match questions to TDs and insert
  console.log('\n📥 Step 3: Matching questions to TDs and inserting...');
  console.log('─'.repeat(70));

  let matched = 0;
  let unmatched = 0;
  const questionsToInsert: any[] = [];

  for (const result of allQuestions) {
    const question = result.question;
    
    // Extract member info
    const memberBy = question.by; // Who asked the question
    const memberUri = memberBy?.uri || memberBy?.member?.uri;

    if (!memberUri) {
      unmatched++;
      continue;
    }

    // Find TD in our database
    const td = tdLookup.get(memberUri);
    
    if (!td) {
      unmatched++;
      continue;
    }

    matched++;

    // Classify topic and sentiment
    const topic = await classifyQuestionTopic(
      question.showAs || question.subject || '',
      question.questionText || question.text || ''
    );
    const sentiment = analyzeAnswerSentiment(
      question.answer?.answerText || question.answer?.text || null
    );

    // Prepare insert data
    const questionData = {
      td_id: td.id,
      question_id: question.questionNo || question.uri?.split('/').pop() || `q-${Date.now()}-${Math.random()}`,
      question_uri: question.uri || '',
      question_number: question.questionNo || '',
      question_type: question.questionType === 'oral' ? 'oral' : 'written',
      date_asked: question.date || '',
      date_answered: question.answer?.date || null,
      subject: (question.showAs || question.subject || '').substring(0, 500),
      question_text: (question.questionText || question.text || '').substring(0, 5000),
      answer_text: (question.answer?.answerText || question.answer?.text || '').substring(0, 10000),
      minister_name: question.to?.showAs || question.to?.memberName || null,
      minister_uri: question.to?.uri || null,
      department: question.department || null,
      ai_topic: topic,
      ai_sentiment: sentiment,
      ai_extracted_at: new Date().toISOString(),
      debate_uri: question.debate?.uri || question.debateSection?.uri || null,
      debate_section: question.debateSection?.showAs || null
    };

    questionsToInsert.push(questionData);

    // Progress update every 100 questions
    if (matched % 100 === 0) {
      console.log(`   Progress: ${matched} matched, ${unmatched} unmatched`);
    }
  }

  // Batch insert all questions
  console.log(`\n💾 Step 4: Inserting ${questionsToInsert.length} questions in batches...`);
  let inserted = 0;
  let errors = 0;
  const batchSize = 1000;

  for (let i = 0; i < questionsToInsert.length; i += batchSize) {
    const batch = questionsToInsert.slice(i, i + batchSize);
    
    try {
      const { error: insertError } = await supabase
        .from('td_questions')
        .upsert(batch, {
          onConflict: 'question_uri',
          ignoreDuplicates: false
        });

      if (insertError) {
        console.error(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${insertError.message}`);
        errors += batch.length;
      } else {
        inserted += batch.length;
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: Inserted ${batch.length} questions (Total: ${inserted})`);
      }
    } catch (error: any) {
      console.error(`   ❌ Batch error: ${error.message}`);
      errors += batch.length;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Total questions fetched:  ${allQuestions.length.toLocaleString()}`);
  console.log(`Matched to TDs:           ${matched.toLocaleString()}`);
  console.log(`Unmatched:                ${unmatched.toLocaleString()}`);
  console.log(`Successfully inserted:    ${inserted.toLocaleString()}`);
  console.log(`Errors:                   ${errors.toLocaleString()}`);
  console.log('═'.repeat(70));

  // Statistics
  const { data: stats } = await supabase
    .from('td_questions')
    .select('question_type, ai_topic');

  if (stats) {
    const oralCount = stats.filter(s => s.question_type === 'oral').length;
    const writtenCount = stats.filter(s => s.question_type === 'written').length;
    
    console.log('\n📈 DATABASE STATISTICS:');
    console.log(`   Total questions in DB:  ${stats.length.toLocaleString()}`);
    console.log(`   Oral questions:         ${oralCount.toLocaleString()}`);
    console.log(`   Written questions:      ${writtenCount.toLocaleString()}`);

    // Top topics
    const topicCounts: Record<string, number> = {};
    stats.forEach(s => {
      topicCounts[s.ai_topic] = (topicCounts[s.ai_topic] || 0) + 1;
    });

    console.log('\n🏷️  TOP TOPICS:');
    Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([topic, count]) => {
        console.log(`   ${topic.padEnd(35)} ${count.toString().padStart(6)}`);
      });
  }

  console.log('\n✅ Bulk questions extraction complete!\n');
}

bulkExtractQuestions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

