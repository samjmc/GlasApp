/**
 * Calculate Dimensional Scores
 * Implements proper scoring for effectiveness, consistency, and constituency service
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

interface TDScoreData {
  id: number;
  politician_name: string;
  party: string;
  attendance_percentage: number;
  question_count_oral: number;
  question_count_written: number;
  is_minister: boolean;
  ministerial_role: string | null;
}

async function calculateDimensionalScores() {
  console.log('📊 CALCULATING DIMENSIONAL SCORES');
  console.log('═'.repeat(70));
  console.log('Calculating: Effectiveness, Consistency, Constituency Service\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Get all active TDs
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, attendance_percentage, question_count_oral, question_count_written, is_minister, ministerial_role')
    .eq('is_active', true);

  if (tdError || !tds) {
    console.error('❌ Failed to fetch TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} active TDs\n`);

  let updated = 0;
  let errors = 0;

  for (const td of tds) {
    try {
      // ============================================================
      // 1. EFFECTIVENESS SCORE
      // ============================================================
      const effectivenessScore = await calculateEffectiveness(td);

      // ============================================================
      // 2. PARTY ALIGNMENT (Display-only metric, not scored)
      // ============================================================
      const partyAlignment = await calculatePartyAlignment(td);

      // ============================================================
      // 3. CONSTITUENCY SERVICE SCORE
      // ============================================================
      const constituencyScore = await calculateConstituencyService(td);

      // Update database
      const { error: updateError } = await supabase
        .from('td_scores')
        .update({
          effectiveness_score: effectivenessScore,
          party_alignment_percentage: partyAlignment, // Display only
          constituency_service_score: constituencyScore
        })
        .eq('id', td.id);

      if (updateError) {
        console.error(`❌ ${td.politician_name}: ${updateError.message}`);
        errors++;
      } else {
        updated++;
        if (updated % 20 === 0) {
          console.log(`   Progress: ${updated}/${tds.length} TDs updated`);
        }
      }

    } catch (error: any) {
      console.error(`❌ Error processing ${td.politician_name}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ CALCULATION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated: ${updated}/${tds.length}`);
  console.log(`Errors: ${errors}`);
  console.log('═'.repeat(70));

  // Show sample results
  console.log('\n📊 Sample Results:');
  const { data: samples } = await supabase
    .from('td_scores')
    .select('politician_name, effectiveness_score, party_alignment_percentage, constituency_service_score')
    .eq('is_active', true)
    .order('effectiveness_score', { ascending: false })
    .limit(5);

  if (samples) {
    samples.forEach(s => {
      console.log(`   ${s.politician_name.padEnd(30)} Eff:${s.effectiveness_score}/100  Party:${s.party_alignment_percentage || 'N/A'}%  Const:${s.constituency_service_score}/100`);
    });
  }
}

/**
 * Calculate Effectiveness Score (0-100)
 * Components for BACKBENCHERS:
 * - Attendance (60%) - showing up to vote
 * - Bills Sponsored (40%) - legislative initiative
 * 
 * Components for MINISTERS:
 * - Attendance (100%) - ministers are expected to attend/vote heavily
 * - Government bills stewarded - credit for government policy implementation
 */
async function calculateEffectiveness(td: TDScoreData): Promise<number> {
  // 1. ATTENDANCE
  const attendanceScore = Math.min(100, (td.attendance_percentage / 95) * 100);

  // 2. LEGISLATIVE ACTIVITY
  const { data: bills } = await supabase
    .from('td_legislation')
    .select('sponsor_type, bill_type')
    .eq('td_id', td.id);

  const sponsorCount = bills?.filter(b => b.sponsor_type === 'sponsor').length || 0;
  const coSponsorCount = bills?.filter(b => b.sponsor_type === 'co-sponsor').length || 0;
  const govBills = bills?.filter(b => b.bill_type === 'Government').length || 0;
  
  // Primary sponsor worth 3x, co-sponsor worth 1x
  const legislativeActivity = (sponsorCount * 3) + coSponsorCount;
  const legislativeScore = Math.min(100, (legislativeActivity / 9) * 100); // 9 = 3 primary sponsors = 100%

  // MINISTERS: Different formula - emphasize attendance, give credit for government bills
  if (td.is_minister) {
    // Ministers get high base score for attendance + bonus for government bills
    const ministerBaseScore = attendanceScore; // 100% if perfect attendance
    const govBillBonus = Math.min(20, govBills * 5); // Up to +20 for government bills
    return Math.round(Math.min(100, Math.max(70, ministerBaseScore + govBillBonus))); // Floor of 70 for ministers
  }

  // BACKBENCHERS: Original formula
  // 60% attendance + 40% bills
  const effectivenessScore = Math.round(
    attendanceScore * 0.60 +
    legislativeScore * 0.40
  );

  return Math.min(100, Math.max(0, effectivenessScore));
}

// Cache for party majority votes to avoid repeated queries
const partyVoteCache = new Map<string, {ta: number, nil: number, staon: number}>();

/**
 * Calculate Party Alignment Percentage (0-100)
 * Display-only metric showing how often TD votes with their party
 * NOT used in scoring - just informational
 * Optimized version with caching
 */
async function calculatePartyAlignment(td: TDScoreData): Promise<number> {
  if (!td.party) return 50; // Independents default to 50

  // Get all votes for this TD
  const { data: tdVotes } = await supabase
    .from('td_votes')
    .select('vote_uri, td_vote')
    .eq('td_id', td.id);

  if (!tdVotes || tdVotes.length === 0) return 50;

  let alignedVotes = 0;
  let totalVotesChecked = 0;

  // For each vote, check if they voted with party majority
  for (const vote of tdVotes) {
    const cacheKey = `${vote.vote_uri}:${td.party}`;
    
    // Check cache first
    let partyCounts = partyVoteCache.get(cacheKey);
    
    if (!partyCounts) {
      // Get all votes for this division from TDs in same party
      const { data: partyVotes } = await supabase
        .from('td_votes')
        .select('td_vote')
        .eq('vote_uri', vote.vote_uri)
        .eq('td_party_at_vote', td.party);

      if (!partyVotes || partyVotes.length < 2) continue;

      // Count party votes
      partyCounts = {
        ta: partyVotes.filter(v => v.td_vote === 'ta').length,
        nil: partyVotes.filter(v => v.td_vote === 'nil').length,
        staon: partyVotes.filter(v => v.td_vote === 'staon').length
      };
      
      // Cache it
      partyVoteCache.set(cacheKey, partyCounts);
    }

    // Determine party majority vote
    let partyMajorityVote = 'ta';
    if (partyCounts.nil > partyCounts.ta && partyCounts.nil > partyCounts.staon) {
      partyMajorityVote = 'nil';
    } else if (partyCounts.staon > partyCounts.ta && partyCounts.staon > partyCounts.nil) {
      partyMajorityVote = 'staon';
    }

    // Check if TD voted with majority
    if (vote.td_vote === partyMajorityVote) {
      alignedVotes++;
    }
    totalVotesChecked++;
  }

  if (totalVotesChecked === 0) return 50;

  const partyAlignmentPercentage = Math.round((alignedVotes / totalVotesChecked) * 100);
  return Math.min(100, Math.max(0, partyAlignmentPercentage));
}

/**
 * Calculate Constituency Service Score (0-100)
 * 
 * BACKBENCHERS: Based on text analysis of questions for local/constituency focus
 * MINISTERS: Fixed score of 60 - they serve the nation, not just their constituency through questions
 */
async function calculateConstituencyService(td: TDScoreData): Promise<number> {
  // MINISTERS: Give them a fair baseline - they serve nationally, not via constituency questions
  if (td.is_minister) {
    return 60; // Fair score - they focus on national policy, not local questions
  }

  // Get all questions for this TD
  const { data: questions } = await supabase
    .from('td_questions')
    .select('subject, question_text')
    .eq('td_id', td.id);

  if (!questions || questions.length === 0) return 30; // Low default if no questions

  let localQuestionCount = 0;
  const totalQuestions = questions.length;

  // Get constituency info
  const { data: tdData } = await supabase
    .from('td_scores')
    .select('constituency')
    .eq('id', td.id)
    .single();

  const constituency = tdData?.constituency || '';

  // Keywords for local/constituency issues
  const localKeywords = [
    'constituency',
    'local',
    'community',
    'residents',
    'area',
    constituency.toLowerCase(),
    'town',
    'village',
    'county',
    'housing',
    'transport',
    'hospital',
    'school',
    'road',
    'services'
  ];

  // Check each question for local focus
  for (const q of questions) {
    const text = `${q.subject || ''} ${q.question_text || ''}`.toLowerCase();
    
    // Check if question mentions local keywords
    const hasLocalFocus = localKeywords.some(keyword => 
      keyword && text.includes(keyword)
    );

    if (hasLocalFocus) {
      localQuestionCount++;
    }
  }

  // Calculate score based on proportion of local questions
  const localQuestionRatio = localQuestionCount / totalQuestions;
  
  // Score components:
  // - 70% based on ratio of local questions
  // - 30% based on absolute count of local questions
  const ratioScore = localQuestionRatio * 100;
  const volumeScore = Math.min(100, (localQuestionCount / 50) * 100); // 50 local questions = 100%

  const constituencyScore = Math.round(
    ratioScore * 0.70 +
    volumeScore * 0.30
  );

  return Math.min(100, Math.max(0, constituencyScore));
}

calculateDimensionalScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

