/**
 * Calculate Dimensional Scores (OPTIMIZED)
 * Pre-loads all data to avoid repeated queries
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

async function calculateDimensionalScoresOptimized() {
  console.log('📊 CALCULATING DIMENSIONAL SCORES (OPTIMIZED)');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // PRE-LOAD ALL DATA AT ONCE (much faster!)
  console.log('📥 Pre-loading all data...');
  
  // 1. Get all active TDs
  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name, party, constituency, attendance_percentage, question_count_oral, question_count_written, total_stories, transparency_elo')
    .eq('is_active', true);

  console.log(`✅ Loaded ${tds?.length} TDs`);

  // 2. Get ALL votes at once (fetch in batches)
  console.log('📥 Loading all votes...');
  
  const allVotes: any[] = [];
  let voteOffset = 0;
  
  while (true) {
    const { data: voteBatch } = await supabase
      .from('td_votes')
      .select(`
        td_id,
        vote_uri,
        td_vote,
        td_scores!inner(party)
      `)
      .in('td_id', tds!.map(t => t.id))
      .range(voteOffset, voteOffset + 999);

    if (!voteBatch || voteBatch.length === 0) break;
    
    allVotes.push(...voteBatch);
    voteOffset += 1000;
    
    if (voteBatch.length < 1000) break;
  }

  console.log(`✅ Loaded ${allVotes.length} votes`);

  // 3. Get ALL legislation at once
  console.log('📥 Loading all legislation...');
  const { data: allLegislation } = await supabase
    .from('td_legislation')
    .select('td_id, sponsor_type')
    .in('td_id', tds!.map(t => t.id));

  console.log(`✅ Loaded ${allLegislation?.length} bill sponsorships`);

  // 4. Get ALL questions at once (Supabase limits to 1000 by default)
  console.log('📥 Loading all questions...');
  
  // Fetch in batches to get ALL questions
  const allQuestions: any[] = [];
  const batchSize = 1000;
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('td_questions')
      .select('td_id, subject, question_text')
      .in('td_id', tds!.map(t => t.id))
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;
    
    allQuestions.push(...batch);
    offset += batchSize;
    
    if (batch.length < batchSize) break; // Last batch
  }

  console.log(`✅ Loaded ${allQuestions.length} questions\n`);

  // Pre-calculate party majorities for all votes
  console.log('🔄 Pre-calculating party vote majorities...');
  const partyMajorities = calculatePartyMajorities(allVotes || []);
  console.log(`✅ Calculated majorities for ${partyMajorities.size} vote-party combinations\n`);

  // Process each TD
  console.log('📊 Processing TDs...');
  console.log('─'.repeat(70));

  let updated = 0;

  for (const td of (tds || [])) {
    try {
      // Filter data for this TD
      const tdVotes = (allVotes || []).filter(v => v.td_id === td.id);
      const tdBills = (allLegislation || []).filter(b => b.td_id === td.id);
      const tdQuestions = (allQuestions || []).filter(q => q.td_id === td.id);

      // 1. EFFECTIVENESS
      const effectivenessScore = calculateEffectiveness(
        td.attendance_percentage,
        tdBills
      );

      // 2. PARTY ALIGNMENT
      const partyAlignment = calculatePartyAlignment(
        tdVotes,
        td.party,
        partyMajorities
      );

      // 3. CONSTITUENCY SERVICE
      const constituencyScore = calculateConstituencyService(
        tdQuestions,
        td.constituency
      );

      // Calculate NEW overall ELO using the dimensional scores
      const hasNewsData = (td.total_stories || 0) > 0;
      const newsELO = hasNewsData ? (td.transparency_elo || 1500) : 1000;
      const effectivenessELO = (effectivenessScore * 10) + 1000;
      const constituencyELO = (constituencyScore * 10) + 1000;
      const questionsELO = (((td.question_count_oral || 0) + (td.question_count_written || 0)) / 200 * 100 * 10) + 1000;
      const trustELO = 1500;
      
      const newOverallELO = Math.round(
        newsELO * 0.40 +              // News: 40%
        effectivenessELO * 0.35 +     // Effectiveness (attendance + bills): 35%
        constituencyELO * 0.15 +      // Constituency service: 15%
        questionsELO * 0.05 +         // Questions bonus: 5%
        trustELO * 0.05               // Trust: 5%
      );

      // Update database
      await supabase
        .from('td_scores')
        .update({
          effectiveness_score: effectivenessScore,
          party_alignment_percentage: partyAlignment,
          constituency_service_score: constituencyScore,
          overall_elo: newOverallELO  // Update overall score too!
        })
        .eq('id', td.id);

      updated++;
      if (updated % 20 === 0) {
        console.log(`   Progress: ${updated}/${tds!.length}`);
      }

    } catch (error: any) {
      console.error(`❌ ${td.politician_name}: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('✅ COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Updated: ${updated}/${tds?.length}`);
  console.log('═'.repeat(70));

  // Show sample results
  const { data: samples } = await supabase
    .from('td_scores')
    .select('politician_name, effectiveness_score, party_alignment_percentage, constituency_service_score')
    .eq('is_active', true)
    .order('effectiveness_score', { ascending: false })
    .limit(10);

  console.log('\n📊 Top 10 by Effectiveness:');
  samples?.forEach(s => {
    console.log(`   ${s.politician_name.padEnd(30)} Eff:${s.effectiveness_score}/100  Party:${s.party_alignment_percentage || 'N/A'}%  Const:${s.constituency_service_score}/100`);
  });
}

function calculatePartyMajorities(allVotes: any[]): Map<string, string> {
  const majorities = new Map<string, string>();

  // Group votes by vote_uri and party
  const voteGroups = new Map<string, Map<string, any[]>>();

  for (const vote of allVotes) {
    const party = (vote.td_scores as any).party;
    if (!party) continue;

    const voteUri = vote.vote_uri;
    const key = `${voteUri}:${party}`;

    if (!voteGroups.has(key)) {
      voteGroups.set(key, new Map());
    }

    const partyVotes = voteGroups.get(key)!;
    const voteType = vote.td_vote;

    if (!partyVotes.has(voteType)) {
      partyVotes.set(voteType, []);
    }
    partyVotes.get(voteType)!.push(vote);
  }

  // Calculate majority for each vote-party combo
  for (const [key, partyVotes] of voteGroups) {
    const taCount = partyVotes.get('ta')?.length || 0;
    const nilCount = partyVotes.get('nil')?.length || 0;
    const staonCount = partyVotes.get('staon')?.length || 0;

    let majority = 'ta';
    if (nilCount > taCount && nilCount > staonCount) majority = 'nil';
    else if (staonCount > taCount && staonCount > nilCount) majority = 'staon';

    majorities.set(key, majority);
  }

  return majorities;
}

function calculateEffectiveness(
  attendancePercentage: number,
  bills: any[]
): number {
  // Attendance (60%)
  const attendanceScore = Math.min(100, (attendancePercentage / 95) * 100);

  // Bills (40%) - RELATIVE/PERCENTILE-BASED
  // Benchmark: 50 legislative points = 100% (95th percentile)
  // Top performers: 50-85 points
  // 75th percentile: 21 points
  // Median: 8.5 points
  const sponsorCount = bills.filter(b => b.sponsor_type === 'sponsor').length;
  const coSponsorCount = bills.filter(b => b.sponsor_type === 'co-sponsor').length;
  const legislativeActivity = (sponsorCount * 3) + coSponsorCount;
  const legislativeScore = Math.min(100, (legislativeActivity / 50) * 100);

  return Math.round(attendanceScore * 0.60 + legislativeScore * 0.40);
}

function calculatePartyAlignment(
  tdVotes: any[],
  party: string,
  partyMajorities: Map<string, string>
): number {
  if (!party || tdVotes.length === 0) return 50;

  let alignedVotes = 0;

  for (const vote of tdVotes) {
    const key = `${vote.vote_uri}:${party}`;
    const partyMajority = partyMajorities.get(key);

    if (partyMajority && vote.td_vote === partyMajority) {
      alignedVotes++;
    }
  }

  return tdVotes.length > 0 
    ? Math.round((alignedVotes / tdVotes.length) * 100)
    : 50;
}

function calculateConstituencyService(
  questions: any[],
  constituency: string
): number {
  if (questions.length === 0) return 30;

  const localKeywords = [
    'constituency', 'local', 'community', 'residents', 'area',
    constituency.toLowerCase(),
    'housing', 'transport', 'hospital', 'school', 'road', 'services',
    'town', 'village', 'county'
  ];

  let localCount = 0;

  for (const q of questions) {
    const text = `${q.subject || ''} ${q.question_text || ''}`.toLowerCase();
    
    if (localKeywords.some(k => k && text.includes(k))) {
      localCount++;
    }
  }

  const ratio = localCount / questions.length;
  const ratioScore = ratio * 100;
  const volumeScore = Math.min(100, (localCount / 50) * 100);

  return Math.round(ratioScore * 0.70 + volumeScore * 0.30);
}

calculateDimensionalScoresOptimized().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

