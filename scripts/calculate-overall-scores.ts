/**
 * Calculate Overall Scores (SIMPLE WEIGHTED SUM)
 * No ELO conversions - just direct 0-100 scores
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function calculateOverallScores() {
  console.log('🎯 CALCULATING OVERALL SCORES');
  console.log('═'.repeat(70));
  console.log('Simple weighted sum of dimensional scores (0-100)\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all active TDs with their dimensional scores
  const { data: tds } = await supabase
    .from('td_scores')
    .select(`
      id,
      politician_name,
      effectiveness_score,
      effectiveness_elo,
      constituency_service_score,
      constituency_service_elo,
      consistency_score,
      consistency_elo,
      parliamentary_activity_score,
      question_count_oral,
      question_count_written,
      total_stories,
      transparency_elo,
      party_alignment_percentage
    `)
    .eq('is_active', true);

  console.log(`✅ Loaded ${tds?.length} TDs\n`);

  let updated = 0;

  for (const td of (tds || [])) {
    // Component 1: NEWS SCORE (30%)
    // If they have news coverage, use transparency_elo
    // Otherwise, default to 50/100 (neutral baseline - not researched yet)
    const newsScore = (td.total_stories || 0) > 0
      ? Math.round((td.transparency_elo - 1000) / 10)
      : 50;  // Baseline for non-researched TDs (1500 ELO = 50/100)

    // Component 2: PARLIAMENTARY ACTIVITY (25%)
    // Questions asked + attendance
    const parliamentaryScore = td.parliamentary_activity_score !== null && td.parliamentary_activity_score !== undefined
      ? td.parliamentary_activity_score
      : 50;

    // Component 3: CONSISTENCY (20%)
    // Question-Bill Match + Topic Voting Consistency (do vs say)
    // Use calculated score OR convert from ELO as fallback
    const consistencyScore = td.consistency_score || Math.round(((td.consistency_elo || 1500) - 1000) / 10);

    // Component 4: EFFECTIVENESS (15%)
    // Attendance + Bills Sponsored
    // Use calculated score OR convert from ELO as fallback (matches API logic)
    const effectivenessScore = td.effectiveness_score || Math.round(((td.effectiveness_elo || 1500) - 1000) / 10);

    // Component 5: CONSTITUENCY SERVICE (10%)
    // Local focus and representation
    // Use calculated score OR convert from ELO as fallback (matches API logic)
    const constituencyScore = td.constituency_service_score || Math.round(((td.constituency_service_elo || 1500) - 1000) / 10);

    // SIMPLE WEIGHTED SUM (UPDATED WEIGHTS)
    const overallScore = Math.round(
      newsScore * 0.30 +              // News: 30%
      parliamentaryScore * 0.25 +     // Parliamentary Activity: 25%
      consistencyScore * 0.20 +       // Consistency (Do vs Say): 20%
      effectivenessScore * 0.15 +     // Effectiveness: 15%
      constituencyScore * 0.10        // Constituency Service: 10%
    );

    // Also update overall_elo for backward compatibility
    const overallELO = (overallScore * 10) + 1000;

    // Update database
    await supabase
      .from('td_scores')
      .update({
        overall_score: overallScore,
        overall_elo: overallELO
      })
      .eq('id', td.id);

    updated++;
    if (updated % 20 === 0) {
      console.log(`   Progress: ${updated}/${tds!.length}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated: ${updated}/${tds?.length}`);
  console.log('═'.repeat(70));

  // Show sample results with breakdown
  const { data: samples } = await supabase
    .from('td_scores')
    .select(`
      politician_name,
      overall_score,
      effectiveness_score,
      consistency_score,
      constituency_service_score,
      question_count_oral,
      question_count_written,
      total_stories,
      party_alignment_percentage,
      party
    `)
    .eq('is_active', true)
    .order('overall_score', { ascending: false })
    .limit(10);

  console.log('\n📊 Top 10 Overall Scores:');
  console.log('─'.repeat(70));
  
  // 34th Dáil Government Coalition: FF + FG + Independents
  const govParties = ['Fianna Fáil', 'Fine Gael'];
  const govIndependents = [
    'Seán Canney', 'Noel Grealish', 'Marian Harkin', 'Barry Heneghan',
    'Michael Lowry', 'Kevin Boxer Moran', 'Gillian Toole', 'Verona Murphy',
    'Danny Healy-Rae', 'Michael Healy-Rae'
  ];
  
  samples?.forEach(s => {
    const govLabel = (govParties.includes(s.party) || govIndependents.includes(s.politician_name)) ? ' [GOV]' : '';
    
    console.log(`${s.politician_name.padEnd(30)} Overall:${s.overall_score}/100${govLabel}`);
    console.log(`   News:30% Parl:${s.parliamentary_activity_score || 50}  Consist:${s.consistency_score}  Eff:${s.effectiveness_score}  Const:${s.constituency_service_score}`);
  });
}

calculateOverallScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

