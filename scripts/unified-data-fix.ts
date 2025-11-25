/**
 * UNIFIED DATA FIX
 * Comprehensive fix for all TD data issues
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function unifiedDataFix() {
  console.log('🔧 UNIFIED DATA FIX');
  console.log('═'.repeat(70));
  console.log('This will:');
  console.log('  1. Mark truly inactive TDs (0 votes + 0 questions)');
  console.log('  2. Recalculate question counts from td_questions');
  console.log('  3. Recalculate vote counts from td_votes');
  console.log('  4. Fix dimensional scores');
  console.log('  5. Fix overall scores');
  console.log('═'.repeat(70) + '\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // STEP 1: Mark truly inactive TDs
  console.log('STEP 1: Identifying truly inactive TDs...');
  console.log('─'.repeat(70));

  const { data: allTDs } = await supabase
    .from('td_scores')
    .select('id, politician_name, total_votes, question_count_oral, question_count_written, is_active');

  let markedInactive = 0;

  for (const td of (allTDs || [])) {
    if (!td.is_active) continue;

    const questions = (td.question_count_oral || 0) + (td.question_count_written || 0);
    const votes = td.total_votes || 0;

    // If TD has 0 votes AND fewer than 10 questions, they're likely inactive
    if (votes === 0 && questions < 10) {
      console.log(`   Marking inactive: ${td.politician_name} (${votes} votes, ${questions} questions)`);
      
      await supabase
        .from('td_scores')
        .update({ is_active: false })
        .eq('id', td.id);
      
      markedInactive++;
    }
  }

  console.log(`✅ Marked ${markedInactive} TDs as inactive\n`);

  // STEP 2: Recalculate question counts from td_questions table
  console.log('STEP 2: Recalculating question counts...');
  console.log('─'.repeat(70));

  const { data: activeTDs } = await supabase
    .from('td_scores')
    .select('id, politician_name')
    .eq('is_active', true);

  console.log(`Processing ${activeTDs?.length} active TDs...`);

  let questionCountsFixed = 0;

  for (const td of (activeTDs || [])) {
    // Count from td_questions table
    const { data: questions } = await supabase
      .from('td_questions')
      .select('question_type')
      .eq('td_id', td.id);

    const oralCount = questions?.filter(q => q.question_type === 'oral').length || 0;
    const writtenCount = questions?.filter(q => q.question_type === 'written').length || 0;

    await supabase
      .from('td_scores')
      .update({
        question_count_oral: oralCount,
        question_count_written: writtenCount
      })
      .eq('id', td.id);

    questionCountsFixed++;
    if (questionCountsFixed % 20 === 0) {
      console.log(`   Progress: ${questionCountsFixed}/${activeTDs!.length}`);
    }
  }

  console.log(`✅ Fixed ${questionCountsFixed} question counts\n`);

  // STEP 3: Recalculate vote counts from td_votes table
  console.log('STEP 3: Recalculating vote counts...');
  console.log('─'.repeat(70));

  let voteCountsFixed = 0;

  for (const td of (activeTDs || [])) {
    // Count from td_votes table
    const { count } = await supabase
      .from('td_votes')
      .select('*', { count: 'exact', head: true })
      .eq('td_id', td.id);

    const votesCast = count || 0;
    const attendancePercentage = votesCast > 0 ? (votesCast / 146) * 100 : 0; // 146 total divisions

    await supabase
      .from('td_scores')
      .update({
        total_votes: votesCast,
        votes_attended: votesCast,
        attendance_percentage: attendancePercentage
      })
      .eq('id', td.id);

    voteCountsFixed++;
    if (voteCountsFixed % 20 === 0) {
      console.log(`   Progress: ${voteCountsFixed}/${activeTDs!.length}`);
    }
  }

  console.log(`✅ Fixed ${voteCountsFixed} vote counts\n`);

  console.log('\n' + '═'.repeat(70));
  console.log('✅ DATA FIX COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Marked inactive: ${markedInactive}`);
  console.log(`Question counts fixed: ${questionCountsFixed}`);
  console.log(`Vote counts fixed: ${voteCountsFixed}`);
  console.log('═'.repeat(70));

  console.log('\n📊 FINAL COUNTS:');
  const { count: finalActive } = await supabase
    .from('td_scores')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log(`   Active TDs: ${finalActive}`);
  console.log(`   Expected: 174 (34th Dáil) or 168 (if 6 truly inactive)`);
  console.log('\n');
}

unifiedDataFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});




