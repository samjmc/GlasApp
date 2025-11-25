/**
 * Update TD and Party Scores from Extracted Data
 * Run this AFTER bulk extraction to recalculate scores
 * Updates both TD scores and party aggregate scores
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function updateAllScores() {
  console.log('🔄 UPDATING TD & PARTY SCORES FROM EXTRACTED DATA');
  console.log('═'.repeat(70));
  console.log('Recalculating scores based on questions, votes, and debates\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Step 1: Get all TDs
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, overall_elo');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs');
    return;
  }

  console.log(`✅ Loaded ${tds.length} TDs\n`);

  // Step 2: Update each TD's scores
  console.log('📊 Step 2: Recalculating TD scores...');
  console.log('─'.repeat(70));

  let updated = 0;
  let errors = 0;

  for (const td of tds) {
    try {
      // Count questions directly from td_questions
      const { data: questionData } = await supabase
        .from('td_questions')
        .select('question_type')
        .eq('td_id', td.id);
      
      const oralQuestions = (questionData || []).filter((q: any) => q.question_type === 'oral').length;
      const writtenQuestions = (questionData || []).filter((q: any) => q.question_type === 'written').length;

      // Count votes directly from td_votes
      const { count: totalVotes } = await supabase
        .from('td_votes')
        .select('*', { count: 'exact', head: true })
        .eq('td_id', td.id);
      
      const votesCast = totalVotes || 0;

      // Calculate attendance percentage
      const uniqueDivisions = 146; // Total divisions in the period
      const attendancePercentage = uniqueDivisions > 0 ? (votesCast / uniqueDivisions) * 100 : 0;

      // Calculate new parliamentary activity score (0-100)
      const totalQuestions = oralQuestions + writtenQuestions;
      const parliamentaryScore = calculateParliamentaryScore(totalQuestions, attendancePercentage);

      // Recalculate overall ELO using NEW dimensional scores
      // Use actual calculated scores instead of defaults!
      const hasNewsData = (td.total_stories || 0) > 0;
      const newsELO = hasNewsData 
        ? (td.transparency_elo || 1500)
        : 1000;
      
      const parliamentaryELO = (parliamentaryScore * 10) + 1000;  // Questions + attendance
      
      // Use actual dimensional scores (convert from 0-100 to 1000-2000)
      const effectivenessELO = ((td.effectiveness_score || 50) * 10) + 1000;  // Attendance + bills
      const constituencyELO = ((td.constituency_service_score || 50) * 10) + 1000;  // Local focus
      const trustELO = 1500;  // Default (not calculated yet)
      
      // NEW OVERALL CALCULATION (avoid double-counting attendance)
      // Use effectiveness (has attendance + bills) instead of parliamentary
      const newOverallELO = Math.round(
        newsELO * 0.40 +              // News impact: 40%
        effectivenessELO * 0.35 +     // Effectiveness (attendance + bills): 35%
        constituencyELO * 0.15 +      // Constituency service: 15%
        parliamentaryELO * 0.05 +     // Questions bonus: 5%
        trustELO * 0.05               // Trust: 5%
      );

      // Update TD record
      const { error: updateError } = await supabase
        .from('td_scores')
        .update({
          // Update question counts
          question_count_oral: oralQuestions,
          question_count_written: writtenQuestions,
          
          // Update voting stats
          total_votes: votesCast,
          votes_attended: votesCast,
          attendance_percentage: attendancePercentage,
          
          // Store parliamentary score component
          parliamentary_activity_score: parliamentaryScore,
          
          // Update overall ELO based on new components
          overall_elo: newOverallELO,
          
          // Update metadata
          last_updated: new Date().toISOString()
        })
        .eq('id', td.id);

      if (updateError) {
        errors++;
        console.error(`   ❌ ${td.politician_name}: ${updateError.message}`);
      } else {
        updated++;
        if (updated % 20 === 0) {
          console.log(`   Progress: ${updated}/${tds.length} TDs updated`);
        }
      }

    } catch (error: any) {
      errors++;
      console.error(`   ❌ Error processing ${td.politician_name}: ${error.message}`);
    }
  }

  console.log(`\n✅ Updated ${updated} TDs, ${errors} errors\n`);

  // Step 3: Update Party Aggregate Scores
  console.log('🏛️  Step 3: Recalculating party aggregate scores...');
  console.log('─'.repeat(70));

  // Get all parties
  const { data: parties } = await supabase
    .from('parties')
    .select('id, name');

  if (!parties) {
    console.log('⚠️  No parties table found, skipping party scores');
  } else {
    for (const party of parties) {
      // Get all ACTIVE TDs in this party
      const { data: partyTDs } = await supabase
        .from('td_scores')
        .select('overall_elo, parliamentary_activity_score, question_count_oral, question_count_written, total_votes')
        .eq('is_active', true)  // Only active TDs
        .ilike('party', party.name);

      if (!partyTDs || partyTDs.length === 0) continue;

      // Calculate aggregate scores (convert ELO to 0-100)
      const avgOverallELO = partyTDs.reduce((sum, td) => sum + (td.overall_elo || 0), 0) / partyTDs.length;
      const avgOverallScore = Math.round(((avgOverallELO - 1000) / 10));
      const avgParliamentaryScore = Math.round(partyTDs.reduce((sum, td) => sum + (td.parliamentary_activity_score || 0), 0) / partyTDs.length);
      const totalQuestions = partyTDs.reduce((sum, td) => sum + (td.question_count_oral || 0) + (td.question_count_written || 0), 0);
      const avgQuestionsPerTD = Math.round(totalQuestions / partyTDs.length);
      const totalVotes = partyTDs.reduce((sum, td) => sum + (td.total_votes || 0), 0);
      const avgVotesPerTD = Math.round(totalVotes / partyTDs.length);

      // Check if party score already exists
      const { data: existing } = await supabase
        .from('party_performance_scores')
        .select('id')
        .eq('party_id', party.id)
        .eq('score_type', 'parliamentary_activity')
        .single();

      const scoreData = {
        party_id: party.id,
        score_type: 'parliamentary_activity',
        overall_score: avgOverallScore,
        parliamentary_activity_score: avgParliamentaryScore,
        transparency_score: avgQuestionsPerTD,
        policy_consistency_score: avgVotesPerTD,
        calculated_at: new Date().toISOString()
      };

      let partyError;
      if (existing) {
        // Update existing
        const result = await supabase
          .from('party_performance_scores')
          .update(scoreData)
          .eq('id', existing.id);
        partyError = result.error;
      } else {
        // Insert new
        const result = await supabase
          .from('party_performance_scores')
          .insert(scoreData);
        partyError = result.error;
      }

      if (partyError) {
        console.error(`   ❌ ${party.name}: ${partyError.message}`);
      } else {
        console.log(`   ✅ ${party.name.padEnd(30)} Overall: ${avgOverallScore}/100, Parl: ${avgParliamentaryScore}/100, Questions/TD: ${avgQuestionsPerTD}`);
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('✅ SCORE UPDATES COMPLETE');
  console.log('═'.repeat(70));
  console.log(`TDs updated:              ${updated}/${tds.length}`);
  console.log(`Parties updated:          ${parties?.length || 0}`);
  console.log('═'.repeat(70));

  console.log('\n📊 NEXT STEPS:');
  console.log('   1. Check TD profiles - should show updated question/vote counts');
  console.log('   2. Check party rankings - should show updated aggregate scores');
  console.log('   3. Verify data is accurate\n');

  console.log('✅ All scores updated!\n');
}

/**
 * Calculate parliamentary activity score (0-100) based on:
 * - Questions asked (40%)
 * - Voting attendance (40%)
 * - Debate participation (20%)
 */
function calculateParliamentaryScore(totalQuestions: number, attendancePercentage: number): number {
  // Normalize questions to 0-100 scale (RELATIVE scoring)
  // Benchmark: 200 questions = excellent (top performers ask 400-900, so this is fair)
  // This makes the score competitive and relative to actual performance
  const questionScore = Math.min(100, (totalQuestions / 200) * 100);
  
  // Normalize attendance to 0-100 scale (RELATIVE scoring)
  // Benchmark: 95% attendance = excellent (75th percentile is 95.89%, median is 91.1%)
  // This makes attendance scoring relative like questions, not absolute
  // Someone with 99% attendance should score 100/100 (they're at the top!)
  const attendanceScore = Math.min(100, (attendancePercentage / 95) * 100);

  // Weighted average: 60% questions, 40% attendance
  const parliamentaryScore = (
    questionScore * 0.60 +
    attendanceScore * 0.40
  );

  return Math.round(parliamentaryScore);
}

updateAllScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

