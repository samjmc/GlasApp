/**
 * Test Dimensional Scores Calculation
 * Test on a few TDs before running on all 169
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

// Test TDs with different characteristics
const TEST_TDS = [
  'Michael Cahill',      // New TD with lots of questions
  'Peadar Tóibín',       // Aontú leader
  'Cathal Crowe'         // FF TD
];

async function testDimensionalScores() {
  console.log('🧪 TESTING DIMENSIONAL SCORES');
  console.log('═'.repeat(70));
  console.log(`Testing on ${TEST_TDS.length} TDs\n`);

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  for (const tdName of TEST_TDS) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 ${tdName}`);
    console.log('─'.repeat(70));

    // Get TD data
    const { data: td, error } = await supabase
      .from('td_scores')
      .select('id, politician_name, party, attendance_percentage, question_count_oral, question_count_written, constituency')
      .eq('politician_name', tdName)
      .single();

    if (error || !td) {
      console.error(`❌ TD not found: ${tdName}`);
      continue;
    }

    // Calculate each score
    console.log('\n1️⃣ EFFECTIVENESS SCORE:');
    const effectivenessScore = await calculateEffectiveness(td);
    console.log(`   Final Score: ${effectivenessScore}/100`);

    console.log('\n2️⃣ PARTY ALIGNMENT (Display-only):');
    const partyAlignment = await calculatePartyAlignment(td);
    console.log(`   Final: ${partyAlignment}% (${partyAlignment === 100 ? 'Always votes with party' : partyAlignment > 90 ? 'Usually votes with party' : partyAlignment > 50 ? 'Sometimes votes independently' : 'Often votes independently'})`);

    console.log('\n3️⃣ CONSTITUENCY SERVICE SCORE:');
    const constituencyScore = await calculateConstituencyService(td);
    console.log(`   Final Score: ${constituencyScore}/100`);

    console.log('\n📋 SUMMARY:');
    console.log(`   Effectiveness: ${effectivenessScore}/100`);
    console.log(`   Party Alignment: ${partyAlignment}% (info only)`);
    console.log(`   Constituency Service: ${constituencyScore}/100`);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(70));
}

async function calculateEffectiveness(td: unknown): Promise<number> {
  // 1. ATTENDANCE (50%)
  console.log(`   Attendance: ${td.attendance_percentage}%`);
  const attendanceScore = Math.min(100, (td.attendance_percentage / 95) * 100);
  console.log(`   → Attendance Score: ${Math.round(attendanceScore)}/100`);

  // 2. BILLS SPONSORED (30%)
  const { data: bills } = await supabase
    .from('td_legislation')
    .select('sponsor_type')
    .eq('td_id', td.id);

  const sponsorCount = bills?.filter(b => b.sponsor_type === 'sponsor').length || 0;
  const coSponsorCount = bills?.filter(b => b.sponsor_type === 'co-sponsor').length || 0;
  
  console.log(`   Bills: ${sponsorCount} primary, ${coSponsorCount} co-sponsor`);
  const legislativeActivity = (sponsorCount * 3) + coSponsorCount;
  const legislativeScore = Math.min(100, (legislativeActivity / 9) * 100);
  console.log(`   → Legislative Score: ${Math.round(legislativeScore)}/100`);

  // EFFECTIVENESS = 60% Attendance + 40% Bills
  // TDs without bills get max 60/100 (as intended)
  const effectivenessScore = Math.round(
    attendanceScore * 0.60 +
    legislativeScore * 0.40
  );

  console.log(`   → Combined: (${Math.round(attendanceScore)} × 60%) + (${Math.round(legislativeScore)} × 40%) = ${effectivenessScore}/100`);

  return Math.min(100, Math.max(0, effectivenessScore));
}

const partyVoteCache = new Map<string, {ta: number, nil: number, staon: number}>();

async function calculatePartyAlignment(td: unknown): Promise<number> {
  if (!td.party) {
    console.log(`   Independent - default score`);
    return 50;
  }

  const { data: tdVotes } = await supabase
    .from('td_votes')
    .select('vote_uri, td_vote')
    .eq('td_id', td.id);

  if (!tdVotes || tdVotes.length === 0) {
    console.log(`   No votes found`);
    return 50;
  }

  console.log(`   Total votes: ${tdVotes.length}`);

  let alignedVotes = 0;
  let totalVotesChecked = 0;

  for (const vote of tdVotes) {
    const cacheKey = `${vote.vote_uri}:${td.party}`;
    
    let partyCounts = partyVoteCache.get(cacheKey);
    
    if (!partyCounts) {
      // Get all votes for this division from TDs in same party (join with td_scores for party)
      const { data: partyVotes } = await supabase
        .from('td_votes')
        .select(`
          td_vote,
          td_scores!inner(party)
        `)
        .eq('vote_uri', vote.vote_uri)
        .eq('td_scores.party', td.party);

      if (!partyVotes || partyVotes.length < 2) continue;

      partyCounts = {
        ta: partyVotes.filter(v => v.td_vote === 'ta').length,
        nil: partyVotes.filter(v => v.td_vote === 'nil').length,
        staon: partyVotes.filter(v => v.td_vote === 'staon').length
      };
      
      partyVoteCache.set(cacheKey, partyCounts);
    }

    let partyMajorityVote = 'ta';
    if (partyCounts.nil > partyCounts.ta && partyCounts.nil > partyCounts.staon) {
      partyMajorityVote = 'nil';
    } else if (partyCounts.staon > partyCounts.ta && partyCounts.staon > partyCounts.nil) {
      partyMajorityVote = 'staon';
    }

    if (vote.td_vote === partyMajorityVote) {
      alignedVotes++;
    }
    totalVotesChecked++;
  }

  console.log(`   Aligned with party: ${alignedVotes}/${totalVotesChecked} votes`);

  if (totalVotesChecked === 0) return 50;

  const consistencyScore = Math.round((alignedVotes / totalVotesChecked) * 100);
  return Math.min(100, Math.max(0, consistencyScore));
}

async function calculateConstituencyService(td: unknown): Promise<number> {
  const { data: questions } = await supabase
    .from('td_questions')
    .select('subject, question_text')
    .eq('td_id', td.id);

  if (!questions || questions.length === 0) {
    console.log(`   No questions found - default low score`);
    return 30;
  }

  const totalQuestions = questions.length;
  console.log(`   Total questions: ${totalQuestions}`);

  const constituency = td.constituency || '';
  const localKeywords = [
    'constituency',
    'local',
    'community',
    'residents',
    'area',
    constituency.toLowerCase(),
    'housing',
    'transport',
    'hospital',
    'school'
  ];

  let localQuestionCount = 0;

  for (const q of questions) {
    const text = `${q.subject || ''} ${q.question_text || ''}`.toLowerCase();
    
    const hasLocalFocus = localKeywords.some(keyword => 
      keyword && text.includes(keyword)
    );

    if (hasLocalFocus) {
      localQuestionCount++;
    }
  }

  console.log(`   Local/constituency questions: ${localQuestionCount}/${totalQuestions}`);

  const localQuestionRatio = localQuestionCount / totalQuestions;
  const ratioScore = localQuestionRatio * 100;
  const volumeScore = Math.min(100, (localQuestionCount / 50) * 100);

  console.log(`   Ratio score: ${Math.round(ratioScore)}/100, Volume score: ${Math.round(volumeScore)}/100`);

  const constituencyScore = Math.round(
    ratioScore * 0.70 +
    volumeScore * 0.30
  );

  return Math.min(100, Math.max(0, constituencyScore));
}

testDimensionalScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

