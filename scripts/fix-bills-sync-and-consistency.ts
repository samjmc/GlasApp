/**
 * Fix Bills Sync & Recalculate Consistency Score
 * 
 * Issues Found:
 * 1. bills_sponsored field not synced with td_legislation table
 * 2. Voting stability metric is useless (just measures if they vote same way)
 * 
 * NEW Consistency Score (Do vs Say):
 * - 60%: Question-Bill Match (do they legislate on what they talk about?)
 * - 40%: Topic Voting Consistency (do they vote consistently on topics they prioritize?)
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

const TOPICS = {
  housing: ['housing', 'homeless', 'rent', 'mortgage', 'dwelling', 'accommodation'],
  health: ['health', 'hospital', 'medical', 'doctor', 'nurse', 'patient', 'hse'],
  education: ['education', 'school', 'teacher', 'student', 'university', 'college'],
  transport: ['transport', 'road', 'rail', 'bus', 'traffic', 'motorway'],
  environment: ['environment', 'climate', 'pollution', 'emission', 'renewable'],
  justice: ['justice', 'court', 'garda', 'crime', 'prison', 'law'],
  economy: ['economy', 'budget', 'tax', 'revenue', 'fiscal', 'finance'],
  welfare: ['welfare', 'pension', 'disability', 'benefit', 'social protection'],
  agriculture: ['agriculture', 'farm', 'rural', 'beef', 'dairy'],
  immigration: ['immigration', 'asylum', 'refugee', 'migrant']
};

async function fixBillsSyncAndConsistency() {
  console.log('🔧 FIXING BILLS SYNC & RECALCULATING CONSISTENCY');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Step 1: Fix bills_sponsored sync
  console.log('\n📊 Step 1: Syncing bills_sponsored field...');
  console.log('─'.repeat(70));

  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name')
    .eq('is_active', true);

  let billsSynced = 0;

  for (const td of (tds || [])) {
    // Count actual bills
    const { data: bills } = await supabase
      .from('td_legislation')
      .select('sponsor_type')
      .eq('td_id', td.id);

    const sponsorCount = bills?.filter(b => b.sponsor_type === 'sponsor').length || 0;
    const coSponsorCount = bills?.filter(b => b.sponsor_type === 'co-sponsor').length || 0;

    // Build bills_details array
    const billsDetails = bills?.map(b => ({
      sponsor_type: b.sponsor_type
    })) || [];

    // Update td_scores
    await supabase
      .from('td_scores')
      .update({
        bills_sponsored: sponsorCount,
        bills_details: billsDetails
      })
      .eq('id', td.id);

    if (sponsorCount > 0 || coSponsorCount > 0) {
      console.log(`   ${td.politician_name.padEnd(30)} ${sponsorCount} sponsored, ${coSponsorCount} co-sponsored`);
      billsSynced++;
    }
  }

  console.log(`\n✅ Synced bills for ${billsSynced} TDs with legislation\n`);

  // Step 2: Recalculate Consistency with IMPROVED logic
  console.log('📊 Step 2: Recalculating Consistency Scores...');
  console.log('─'.repeat(70));

  // Pre-load all data
  console.log('Loading questions...');
  
  // Load questions in batches (Supabase has limits)
  const allQuestions: any[] = [];
  let questionOffset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('td_questions')
      .select('td_id, subject, question_text')
      .in('td_id', tds!.map(t => t.id))
      .range(questionOffset, questionOffset + 999);

    if (!batch || batch.length === 0) break;
    allQuestions.push(...batch);
    questionOffset += 1000;
    if (batch.length < 1000) break;
  }

  const { data: allBills } = await supabase
    .from('td_legislation')
    .select('td_id, bill_title')
    .in('td_id', tds!.map(t => t.id));

  const allVotes: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('td_votes')
      .select('td_id, vote_subject, td_vote')
      .in('td_id', tds!.map(t => t.id))
      .range(offset, offset + 999);

    if (!batch || batch.length === 0) break;
    allVotes.push(...batch);
    offset += 1000;
    if (batch.length < 1000) break;
  }

  console.log(`✅ Loaded ${allQuestions?.length} questions, ${allBills?.length} bills, ${allVotes.length} votes\n`);

  let updated = 0;
  const results: any[] = [];

  for (const td of (tds || [])) {
    const tdQuestions = allQuestions?.filter(q => q.td_id === td.id) || [];
    const tdBills = allBills?.filter(b => b.td_id === td.id) || [];
    const tdVotes = allVotes.filter(v => v.td_id === td.id);

    // Component 1: Question-Bill Match (60%)
    const questionBillMatch = calculateQuestionBillMatch(tdQuestions, tdBills);
    
    // Component 2: IMPROVED - Topic Voting Consistency (40%)
    // Do they vote consistently on topics they care about (questions/bills)?
    const topicVotingConsistency = calculateTopicVotingConsistency(tdQuestions, tdBills, tdVotes);
    
    const consistencyScore = Math.round(
      questionBillMatch * 0.60 +
      topicVotingConsistency * 0.40
    );

    await supabase
      .from('td_scores')
      .update({
        consistency_score: consistencyScore
      })
      .eq('id', td.id);

    results.push({
      name: td.politician_name,
      consistency: consistencyScore,
      questionBillMatch,
      topicVotingConsistency,
      questions: tdQuestions.length,
      bills: tdBills.length
    });

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

  // Show Peadar Tóibín specifically
  const peadar = results.find(r => r.name.toLowerCase().includes('peadar'));
  if (peadar) {
    console.log('\n🎯 Peadar Tóibín Results:');
    console.log('─'.repeat(70));
    console.log(`Overall Consistency: ${peadar.consistency}/100`);
    console.log(`  - Question-Bill Match (60%): ${peadar.questionBillMatch}/100`);
    console.log(`  - Topic Voting Consistency (40%): ${peadar.topicVotingConsistency}/100`);
    console.log(`  - Questions Asked: ${peadar.questions}`);
    console.log(`  - Bills Sponsored: ${peadar.bills}`);
  }

  // Show top 10
  console.log('\n📊 Top 10 Consistency Scores:');
  results.sort((a, b) => b.consistency - a.consistency);
  results.slice(0, 10).forEach(r => {
    console.log(`   ${r.name.padEnd(30)} ${r.consistency}/100  (Q-B:${r.questionBillMatch} Vote:${r.topicVotingConsistency})  [${r.questions}Q, ${r.bills}B]`);
  });
}

/**
 * Calculate Question-Bill Match Score
 * Do they introduce bills on topics they ask questions about?
 */
function calculateQuestionBillMatch(questions: any[], bills: any[]): number {
  if (questions.length === 0) return 30; // Low default
  if (bills.length === 0) return 20; // Even lower if no bills at all

  // Classify questions by topic
  const questionTopics: Record<string, number> = {};
  
  for (const q of questions) {
    const text = `${q.subject || ''} ${q.question_text || ''}`.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(TOPICS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        questionTopics[topic] = (questionTopics[topic] || 0) + 1;
      }
    }
  }

  // Classify bills by topic
  const billTopics: Record<string, number> = {};
  
  for (const b of bills) {
    const text = (b.bill_title || '').toLowerCase();
    
    for (const [topic, keywords] of Object.entries(TOPICS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        billTopics[topic] = (billTopics[topic] || 0) + 1;
      }
    }
  }

  // Calculate match score
  let matchScore = 0;
  let topicsWithQuestions = 0;

  for (const [topic, questionCount] of Object.entries(questionTopics)) {
    if (questionCount < 5) continue; // Only significant topics (5+ questions)
    
    topicsWithQuestions++;
    const billCount = billTopics[topic] || 0;
    
    // Expected: ~1 bill per 20 questions on a topic (more realistic threshold)
    const expectedBills = questionCount / 20;
    const matchRate = Math.min(100, (billCount / Math.max(0.5, expectedBills)) * 100);
    
    matchScore += matchRate;
  }

  if (topicsWithQuestions === 0) {
    // No focused topics - spread thin
    return 40;
  }

  return Math.round(matchScore / topicsWithQuestions);
}

/**
 * Calculate Topic Voting Consistency (IMPROVED)
 * Do they vote consistently on topics they prioritize (questions/bills)?
 */
function calculateTopicVotingConsistency(questions: any[], bills: any[], votes: any[]): number {
  if (votes.length < 10) return 50; // Not enough data

  // Identify TD's priority topics (based on questions + bills)
  const priorityTopics: Record<string, number> = {};

  // Count questions by topic
  for (const q of questions) {
    const text = `${q.subject || ''} ${q.question_text || ''}`.toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPICS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        priorityTopics[topic] = (priorityTopics[topic] || 0) + 1;
      }
    }
  }

  // Count bills by topic (weight bills 10x since they're more significant)
  for (const b of bills) {
    const text = (b.bill_title || '').toLowerCase();
    for (const [topic, keywords] of Object.entries(TOPICS)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        priorityTopics[topic] = (priorityTopics[topic] || 0) + 10;
      }
    }
  }

  // Get top 3 priority topics
  const topPriorities = Object.entries(priorityTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  if (topPriorities.length === 0) return 50;

  // Check voting consistency on priority topics
  const votingPatterns: Record<string, { ta: number; nil: number; staon: number }> = {};

  for (const topic of topPriorities) {
    votingPatterns[topic] = { ta: 0, nil: 0, staon: 0 };
  }

  let relevantVotes = 0;

  for (const vote of votes) {
    const subject = (vote.vote_subject || '').toLowerCase();
    
    // Check if vote relates to any priority topic
    for (const topic of topPriorities) {
      const keywords = TOPICS[topic as keyof typeof TOPICS];
      if (keywords.some(keyword => subject.includes(keyword))) {
        relevantVotes++;
        
        if (vote.td_vote === 'ta') votingPatterns[topic].ta++;
        else if (vote.td_vote === 'nil') votingPatterns[topic].nil++;
        else if (vote.td_vote === 'staon') votingPatterns[topic].staon++;
        break; // Only count once per vote
      }
    }
  }

  if (relevantVotes < 5) return 50; // Not enough relevant votes

  // Calculate consistency per topic
  let consistencySum = 0;
  let topicsWithVotes = 0;

  for (const [topic, counts] of Object.entries(votingPatterns)) {
    const total = counts.ta + counts.nil + counts.staon;
    if (total < 3) continue;
    
    topicsWithVotes++;
    
    // Consistency = how often they vote the same way on this topic
    const maxVotes = Math.max(counts.ta, counts.nil, counts.staon);
    const consistency = (maxVotes / total) * 100;
    consistencySum += consistency;
  }

  if (topicsWithVotes === 0) return 50;

  return Math.round(consistencySum / topicsWithVotes);
}

fixBillsSyncAndConsistency().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

