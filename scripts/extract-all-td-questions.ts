/**
 * Bulk Extraction Script: Extract all parliamentary questions for all TDs
 * This populates the td_questions table with detailed question data
 */

import { supabaseDb as supabase } from '../server/db.js';
import { 
  getCurrentDailMembers, 
  extractMemberQuestions,
  classifyQuestionTopic,
  analyzeAnswerSentiment
} from '../server/services/oireachtasAPIService.js';

async function extractAllTDQuestions() {
  console.log('🚀 BULK QUESTION EXTRACTION');
  console.log('═'.repeat(70));
  console.log('This will extract parliamentary questions for all TDs');
  console.log('Estimated time: 30-60 minutes for all 173 TDs\n');

  if (!supabase) {
    console.error('❌ Supabase client not initialized. Check environment variables.');
    process.exit(1);
  }

  // Step 1: Get all current TDs
  console.log('📊 Step 1: Fetching all current TDs...');
  const dailMembers = await getCurrentDailMembers();
  console.log(`✅ Found ${dailMembers.length} TDs\n`);

  // Step 2: Match with database
  const { data: tdScores, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name');

  if (tdError || !tdScores) {
    console.error('❌ Failed to fetch TD scores from database');
    return;
  }

  console.log(`✅ Found ${tdScores.length} TDs in database\n`);

  // Step 3: Process each TD
  console.log('📋 Step 2: Extracting questions for each TD...');
  console.log('─'.repeat(70));

  let totalTDsProcessed = 0;
  let totalQuestionsInserted = 0;
  let totalErrors = 0;

  const dateFrom = '2024-01-01'; // Extract questions from 2024 onwards

  for (const member of dailMembers) {
    const tdInDb = tdScores.find(td => 
      td.politician_name.toLowerCase() === member.fullName.toLowerCase()
    );

    if (!tdInDb) {
      console.log(`⚠️  ${member.fullName} - Not found in database, skipping`);
      continue;
    }

    console.log(`\n${(totalTDsProcessed + 1).toString().padStart(3)}/${dailMembers.length} - ${member.fullName}`);
    console.log('─'.repeat(70));

    try {
      // Extract questions
      const memberUri = `/ie/oireachtas/member/${member.memberCode}`;
      const questions = await extractMemberQuestions(memberUri, dateFrom);

      if (questions.length === 0) {
        console.log('   📝 No questions found');
        totalTDsProcessed++;
        continue;
      }

      console.log(`   📝 Extracted ${questions.length} questions`);

      // Process and insert each question
      let insertedCount = 0;
      let duplicateCount = 0;

      for (const q of questions) {
        // Classify topic
        const topic = await classifyQuestionTopic(q.subject, q.questionText);
        
        // Analyze sentiment
        const sentiment = analyzeAnswerSentiment(q.answerText);

        // Prepare insert data
        const questionData = {
          td_id: tdInDb.id,
          question_id: q.questionId,
          question_uri: q.questionUri,
          question_number: q.questionNumber,
          question_type: q.questionType,
          date_asked: q.dateAsked,
          date_answered: q.dateAnswered,
          subject: q.subject,
          question_text: q.questionText,
          answer_text: q.answerText,
          minister_name: q.ministerName,
          minister_uri: q.ministerUri,
          department: q.department,
          ai_topic: topic,
          ai_sentiment: sentiment,
          ai_extracted_at: new Date().toISOString(),
          debate_uri: q.debateUri,
          debate_section: q.debateSection
        };

        // Insert (with ON CONFLICT DO NOTHING to skip duplicates)
        const { error: insertError } = await supabase
          .from('td_questions')
          .upsert(questionData, {
            onConflict: 'question_id',
            ignoreDuplicates: true
          });

        if (insertError) {
          // Check if it's a duplicate error
          if (insertError.message.includes('duplicate')) {
            duplicateCount++;
          } else {
            console.error(`   ❌ Insert error: ${insertError.message}`);
            totalErrors++;
          }
        } else {
          insertedCount++;
        }
      }

      console.log(`   ✅ Inserted: ${insertedCount} questions`);
      if (duplicateCount > 0) {
        console.log(`   ⏭️  Skipped: ${duplicateCount} duplicates`);
      }

      totalQuestionsInserted += insertedCount;
      totalTDsProcessed++;

      // Rate limiting - pause between TDs
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ Error processing ${member.fullName}: ${error.message}`);
      totalErrors++;
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`TDs Processed:       ${totalTDsProcessed}/${dailMembers.length}`);
  console.log(`Questions Inserted:  ${totalQuestionsInserted.toLocaleString()}`);
  console.log(`Errors:              ${totalErrors}`);
  console.log('═'.repeat(70));

  // Quick statistics
  const { data: stats } = await supabase
    .from('td_questions')
    .select('question_type, ai_topic');

  if (stats) {
    const oralCount = stats.filter(s => s.question_type === 'oral').length;
    const writtenCount = stats.filter(s => s.question_type === 'written').length;
    
    console.log('\n📈 DATABASE STATISTICS:');
    console.log(`   Total questions:  ${stats.length.toLocaleString()}`);
    console.log(`   Oral questions:   ${oralCount.toLocaleString()}`);
    console.log(`   Written questions: ${writtenCount.toLocaleString()}`);

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
        console.log(`   ${topic.padEnd(30)} ${count.toString().padStart(5)}`);
      });
  }

  console.log('\n✅ Questions extraction complete!\n');
}

// Run extraction
extractAllTDQuestions().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

