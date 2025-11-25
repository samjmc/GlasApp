/**
 * Fixed Question Extraction Script
 * Works around the broken member_id API filtering by fetching all questions
 * and filtering client-side
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function extractQuestions() {
  console.log('📝 EXTRACTING QUESTIONS (2024-2025)');
  console.log('═'.repeat(70));
  console.log('Working around broken API member_id filtering...\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all TDs from database
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code')
    .eq('is_active', true);

  if (tdError || !tds) {
    console.error('❌ Failed to fetch TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} active TDs\n`);

  // Create member code lookup
  const memberCodeMap = new Map<string, any>();
  const nameMap = new Map<string, any>();
  
  for (const td of tds) {
    if (td.member_code) {
      memberCodeMap.set(td.member_code.toLowerCase(), td);
    }
    nameMap.set(td.politician_name.toLowerCase(), td);
  }

  console.log('📥 Fetching ALL questions from API (this may take a while)...');
  console.log('─'.repeat(70));

  const allQuestions: any[] = [];
  const dateStart = '2024-01-01';
  const limit = 500;
  let skip = 0;
  let batchCount = 0;

  // Fetch all questions in batches
  while (true) {
    const url = `https://api.oireachtas.ie/v1/questions?date_start=${dateStart}&limit=${limit}&skip=${skip}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) break;
      
      allQuestions.push(...data.results);
      batchCount++;
      skip += limit;
      
      console.log(`   Batch ${batchCount}: Fetched ${allQuestions.length} questions (skip=${skip})`);
      
      // Stop if we've fetched 10,000 (API limit)
      if (skip >= 10000) {
        console.log('⚠️  Reached API limit of 10,000 questions');
        break;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error: any) {
      console.error(`❌ Error fetching batch: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Fetched ${allQuestions.length} total questions\n`);

  // Process and match questions to TDs
  console.log('🔗 Matching questions to TDs...');
  console.log('─'.repeat(70));

  const tdQuestionCounts = new Map<number, number>();
  const questionsToInsert: any[] = [];

  for (const result of allQuestions) {
    const question = result.question;
    if (!question || !question.by) continue;

    // Try to match by member code first (more reliable)
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

    if (!td) continue; // Not a current TD

    // Count questions per TD
    const currentCount = tdQuestionCounts.get(td.id) || 0;
    tdQuestionCounts.set(td.id, currentCount + 1);

    // Determine question type (only 'oral' or 'written' allowed)
    let questionType = 'written'; // Default to written
    if (question.showAs) {
      const showAsLower = question.showAs.toLowerCase();
      if (showAsLower.includes('oral') || showAsLower.includes('priority')) {
        questionType = 'oral';
      } else if (showAsLower.includes('written')) {
        questionType = 'written';
      }
    }

    // Prepare question data
    questionsToInsert.push({
      td_id: td.id,
      question_id: question.questionNumber || null,
      question_uri: question.uri || null,
      question_number: question.questionNumber || null,
      question_type: questionType,
      date_asked: question.date || null,
      date_answered: question.dateAnswered || null,
      subject: question.showAs?.substring(0, 500) || null,
      question_text: question.questionText?.substring(0, 5000) || null,
      answer_text: question.answerText?.substring(0, 10000) || null,
      minister_name: question.to?.showAs || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  console.log(`\n✅ Matched ${questionsToInsert.length} questions to current TDs\n`);

  // Show top questioners
  console.log('📊 Top 10 questioners:');
  const sorted = Array.from(tdQuestionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  for (const [tdId, count] of sorted) {
    const td = tds.find(t => t.id === tdId);
    console.log(`   ${td?.politician_name.padEnd(30)} ${count} questions`);
  }

  // Delete existing questions for all active TDs
  console.log('\n🗑️  Clearing existing questions...');
  const { error: deleteError } = await supabase
    .from('td_questions')
    .delete()
    .in('td_id', tds.map(t => t.id));

  if (deleteError) {
    console.error('❌ Delete failed:', deleteError);
  } else {
    console.log('✅ Cleared existing questions');
  }

  // Insert new questions in batches
  console.log('\n💾 Inserting questions...');
  console.log('─'.repeat(70));

  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < questionsToInsert.length; i += batchSize) {
    const batch = questionsToInsert.slice(i, i + batchSize);
    
    const { error: insertError } = await supabase
      .from('td_questions')
      .insert(batch);

    if (insertError) {
      console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, insertError.message);
    } else {
      inserted += batch.length;
      console.log(`   ✅ Inserted ${inserted}/${questionsToInsert.length}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Questions fetched: ${allQuestions.length}`);
  console.log(`Questions matched: ${questionsToInsert.length}`);
  console.log(`Questions inserted: ${inserted}`);
  console.log('═'.repeat(70));
}

extractQuestions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

