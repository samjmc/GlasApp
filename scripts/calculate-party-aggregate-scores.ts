/**
 * Calculate Party Aggregate Scores
 * Aggregates TD scores by party to create party-level performance metrics
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function calculatePartyAggregateScores() {
  console.log('🏛️  CALCULATING PARTY AGGREGATE SCORES');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all active TDs grouped by party
  const { data: tds } = await supabase
    .from('td_scores')
    .select(`
      party,
      overall_score,
      effectiveness_score,
      consistency_score,
      constituency_service_score,
      parliamentary_activity_score,
      question_count_oral,
      question_count_written,
      total_votes,
      votes_attended,
      bills_sponsored,
      attendance_percentage
    `)
    .eq('is_active', true)
    .not('party', 'is', null);

  if (!tds || tds.length === 0) {
    console.error('❌ No TDs found');
    return;
  }

  console.log(`✅ Loaded ${tds.length} active TDs\n`);

  // Group by party
  const partyGroups = new Map<string, any[]>();
  for (const td of tds) {
    if (!partyGroups.has(td.party)) {
      partyGroups.set(td.party, []);
    }
    partyGroups.get(td.party)!.push(td);
  }

  console.log('📊 Calculating aggregates by party...');
  console.log('─'.repeat(70));

  // Calculate aggregates for each party
  const partyResults: any[] = [];

  for (const [partyName, partyTDs] of partyGroups) {
    if (partyTDs.length === 0) continue;

    // Calculate averages
    const avgOverallScore = Math.round(
      partyTDs.reduce((sum, td) => sum + (td.overall_score || 0), 0) / partyTDs.length
    );

    const avgEffectiveness = Math.round(
      partyTDs.reduce((sum, td) => sum + (td.effectiveness_score || 0), 0) / partyTDs.length
    );

    const avgConsistency = Math.round(
      partyTDs.reduce((sum, td) => sum + (td.consistency_score || 0), 0) / partyTDs.length
    );

    const avgConstituencyService = Math.round(
      partyTDs.reduce((sum, td) => sum + (td.constituency_service_score || 0), 0) / partyTDs.length
    );

    const avgParliamentaryActivity = Math.round(
      partyTDs.reduce((sum, td) => sum + (td.parliamentary_activity_score || 0), 0) / partyTDs.length
    );

    const avgAttendance = Math.round(
      partyTDs.reduce((sum, td) => sum + parseFloat(td.attendance_percentage || '0'), 0) / partyTDs.length * 10
    ) / 10;

    // Sum totals
    const totalQuestions = partyTDs.reduce(
      (sum, td) => sum + (td.question_count_oral || 0) + (td.question_count_written || 0), 
      0
    );

    const totalBills = partyTDs.reduce((sum, td) => sum + (td.bills_sponsored || 0), 0);
    const totalVotes = partyTDs.reduce((sum, td) => sum + (td.total_votes || 0), 0);

    // Per-TD averages for comparison
    const avgQuestionsPerTD = Math.round(totalQuestions / partyTDs.length);
    const avgBillsPerTD = Math.round((totalBills / partyTDs.length) * 10) / 10;
    const avgVotesPerTD = Math.round(totalVotes / partyTDs.length);

    // Get or create party record
    const { data: party } = await supabase
      .from('parties')
      .select('id')
      .eq('name', partyName)
      .single();

    if (!party) {
      console.log(`⚠️  Party not found: ${partyName}, skipping...`);
      continue;
    }

    // Determine government status (34th Dáil coalition)
    const governmentParties = ['Fianna Fáil', 'Fine Gael'];
    const governmentStatus = governmentParties.includes(partyName) ? 'coalition' : 'opposition';

    // Check if score exists
    const { data: existingScore } = await supabase
      .from('party_performance_scores')
      .select('id')
      .eq('party_id', party.id)
      .eq('score_type', 'parliamentary_activity')
      .single();

    const scoreData = {
      party_id: party.id,
      score_type: 'parliamentary_activity',
      overall_score: avgOverallScore,
      
      // Dimensional scores
      parliamentary_activity_score: avgParliamentaryActivity,
      transparency_score: avgConsistency, // Using consistency as transparency
      policy_consistency_score: avgConsistency,
      
      // Additional metrics (using other fields creatively)
      pledge_fulfillment_score: avgEffectiveness,
      public_accountability_score: avgConstituencyService,
      
      government_status: governmentStatus,
      calculated_at: new Date().toISOString()
    };

    let error;
    if (existingScore) {
      const result = await supabase
        .from('party_performance_scores')
        .update(scoreData)
        .eq('id', existingScore.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('party_performance_scores')
        .insert(scoreData);
      error = result.error;
    }

    if (error) {
      console.error(`❌ ${partyName}: ${error.message}`);
    } else {
      partyResults.push({
        party: partyName,
        tdCount: partyTDs.length,
        overall: avgOverallScore,
        consistency: avgConsistency,
        effectiveness: avgEffectiveness,
        constituency: avgConstituencyService,
        parliamentary: avgParliamentaryActivity,
        attendance: avgAttendance,
        questionsPerTD: avgQuestionsPerTD,
        billsPerTD: avgBillsPerTD,
        status: governmentStatus
      });
      console.log(`✅ ${partyName.padEnd(30)} ${avgOverallScore}/100 (${partyTDs.length} TDs)`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated ${partyResults.length} parties`);
  console.log('═'.repeat(70));

  // Show ranked results
  console.log('\n📊 Party Rankings by Overall Score:');
  console.log('─'.repeat(70));
  
  partyResults.sort((a, b) => b.overall - a.overall);
  
  partyResults.forEach((p, idx) => {
    const statusLabel = p.status === 'coalition' ? ' [GOV]' : '';
    console.log(`${(idx + 1).toString().padStart(2)}. ${p.party.padEnd(30)} ${p.overall}/100${statusLabel}`);
    console.log(`    ${p.tdCount} TDs | Consist:${p.consistency} Eff:${p.effectiveness} Const:${p.constituency} Parl:${p.parliamentary}`);
    console.log(`    ${p.questionsPerTD}Q/TD | ${p.billsPerTD}B/TD | ${p.attendance}% attend`);
  });

  console.log('\n📊 Government vs Opposition Comparison:');
  console.log('─'.repeat(70));
  
  const govParties = partyResults.filter(p => p.status === 'coalition');
  const oppParties = partyResults.filter(p => p.status === 'opposition');
  
  const avgGov = govParties.reduce((sum, p) => sum + p.overall, 0) / govParties.length;
  const avgOpp = oppParties.reduce((sum, p) => sum + p.overall, 0) / oppParties.length;
  
  console.log(`Government (n=${govParties.length}): ${Math.round(avgGov)}/100 average`);
  console.log(`Opposition (n=${oppParties.length}): ${Math.round(avgOpp)}/100 average`);
  console.log(`Difference: Opposition ${avgOpp > avgGov ? 'leads' : 'trails'} by ${Math.abs(Math.round(avgOpp - avgGov))} points`);
}

calculatePartyAggregateScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

