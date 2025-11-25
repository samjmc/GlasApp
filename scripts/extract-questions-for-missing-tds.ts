/**
 * Extract Questions for Missing TDs
 * Only extracts for TDs who currently have 0 questions
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function extractQuestionsForMissingTDs() {
  console.log('📝 EXTRACTING QUESTIONS FOR MISSING TDs');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get TDs with 0 questions
  const { data: tdsNeedingQuestions } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code')
    .eq('is_active', true)
    .or('question_count_oral.is.null,question_count_oral.eq.0');

  console.log(`Found ${tdsNeedingQuestions?.length} TDs with 0 questions\n`);

  if (!tdsNeedingQuestions || tdsNeedingQuestions.length === 0) {
    console.log('✅ All TDs have questions!');
    return;
  }

  // Create member code lookup
  const memberCodeMap = new Map<string, any>();
  const nameMap = new Map<string, any>();
  
  for (const td of tdsNeedingQuestions) {
    if (td.member_code) {
      memberCodeMap.set(td.member_code.toLowerCase(), td);
    }
    nameMap.set(td.politician_name.toLowerCase(), td);
  }

  console.log('📥 Fetching questions from API...');
  console.log('─'.repeat(70));

  const allQuestions: any[] = [];
  const dateStart = '2024-01-01';
  const limit = 500;
  let skip = 0;

  // Fetch all questions
  while (true) {
    const url = `https://api.oireachtas.ie/v1/questions?date_start=${dateStart}&limit=${limit}&skip=${skip}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) break;
      
      allQuestions.push(...data.results);
      skip += limit;
      
      if (skip % 1000 === 0) {
        console.log(`   Fetched ${allQuestions.length} questions...`);
      }
      
      if (skip >= 10000) break;
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
    } catch (error: any) {
      console.error(`❌ Error: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Fetched ${allQuestions.length} total questions\n`);

  // Match to our missing TDs only
  console.log('🔗 Matching questions to TDs needing extraction...');
  const questionsToInsert: any[] = [];
  const tdQuestionCounts = new Map<number, number>();

  for (const result of allQuestions) {
    const question = result.question;
    if (!question || !question.by) continue;

    // Try to match by member code first
    let td = null;
    
    if (question.by.memberCode) {
      td = memberCodeMap.get(question.by.memberCode.toLowerCase());
    }
    
    // Fallback to name matching
    if (!td && question.by.showAs) {
      const name = question.by.showAs.toLowerCase()
        .replace('deputy ', '')
        .replace('senator ', '')
        .trim();
      td = nameMap.get(name);
    }

    if (!td) continue; // Not one of our missing TDs

    // Count for this TD
    const count = tdQuestionCounts.get(td.id) || 0;
    tdQuestionCounts.set(td.id, count + 1);

    // Determine type
    let questionType = 'written';
    if (question.showAs) {
      const showAsLower = question.showAs.toLowerCase();
      if (showAsLower.includes('oral') || showAsLower.includes('priority')) {
        questionType = 'oral';
      }
    }

    questionsToInsert.push({
      td_id: td.id,
      question_id: question.questionNumber || null,
      question_uri: question.uri || null,
      question_number: question.questionNumber || null,
      question_type: questionType,
      date_asked: question.date || null,
      subject: question.showAs?.substring(0, 500) || null,
      question_text: question.questionText?.substring(0, 5000) || null,
      answer_text: question.answerText?.substring(0, 10000) || null,
      minister_name: question.to?.showAs || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  console.log(`✅ Matched ${questionsToInsert.length} questions\n`);

  // Show which TDs we found questions for
  console.log('📊 Questions found for:');
  const sorted = Array.from(tdQuestionCounts.entries())
    .sort((a, b) => b[1] - a[1]);
  
  for (const [tdId, count] of sorted) {
    const td = tdsNeedingQuestions.find(t => t.id === tdId);
    console.log(`   ${td?.politician_name.padEnd(35)} ${count} questions`);
  }

  // Insert questions
  if (questionsToInsert.length > 0) {
    console.log('\n💾 Inserting questions...');
    
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('td_questions')
        .insert(batch);

      if (error) {
        console.error(`❌ Batch failed: ${error.message}`);
      } else {
        inserted += batch.length;
        console.log(`   ✅ Inserted ${inserted}/${questionsToInsert.length}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`TDs checked: ${tdsNeedingQuestions.length}`);
  console.log(`Questions matched: ${questionsToInsert.length}`);
  console.log(`TDs with questions found: ${tdQuestionCounts.size}`);
  console.log('═'.repeat(70));
}

extractQuestionsForMissingTDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




