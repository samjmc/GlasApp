/**
 * Test Transparency/Trustworthiness Score
 * Combines Question-Bill Topic Match + Voting Stability
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

// Topic keywords for classification
const TOPICS = {
  housing: ['housing', 'homeless', 'rent', 'mortgage', 'dwelling', 'accommodation'],
  health: ['health', 'hospital', 'medical', 'doctor', 'nurse', 'patient', 'hse'],
  education: ['education', 'school', 'teacher', 'student', 'university', 'college'],
  transport: ['transport', 'road', 'rail', 'bus', 'traffic', 'motorway', 'public transport'],
  environment: ['environment', 'climate', 'pollution', 'emission', 'renewable', 'green'],
  justice: ['justice', 'court', 'garda', 'crime', 'prison', 'law enforcement'],
  economy: ['economy', 'budget', 'tax', 'revenue', 'fiscal', 'finance'],
  welfare: ['welfare', 'pension', 'disability', 'benefit', 'social protection'],
  agriculture: ['agriculture', 'farm', 'rural', 'beef', 'dairy', 'crops'],
  immigration: ['immigration', 'asylum', 'refugee', 'migrant', 'international protection']
};

// Test TDs with different profiles
const TEST_TDS = [
  'Peadar Tóibín',     // Lots of bills + questions
  'Cian O\'Callaghan', // Moderate bills
  'Eoin Ó Broin',      // Housing advocate
  'Roderic O\'Gorman', // Green Party minister
  'Michael Cahill'     // New TD
];

async function testTransparencyScore() {
  console.log('🧪 TESTING TRANSPARENCY/TRUSTWORTHINESS SCORE');
  console.log('═'.repeat(70));
  console.log('Components: Question-Bill Match (60%) + Voting Stability (40%)\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  for (const tdName of TEST_TDS) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 ${tdName}`);
    console.log('─'.repeat(70));

    const { data: td } = await supabase
      .from('td_scores')
      .select('id, politician_name, party')
      .eq('politician_name', tdName)
      .single();

    if (!td) {
      console.log('❌ TD not found');
      continue;
    }

    // Calculate components
    const questionBillMatch = await calculateQuestionBillMatch(td.id);
    const votingStability = await calculateVotingStability(td.id, td.party);
    
    const transparencyScore = Math.round(
      questionBillMatch * 0.60 +
      votingStability * 0.40
    );

    console.log(`\n📋 TRANSPARENCY SCORE: ${transparencyScore}/100`);
    console.log(`   Question-Bill Match: ${questionBillMatch}/100 (60% weight)`);
    console.log(`   Voting Stability: ${votingStability}/100 (40% weight)`);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ TEST COMPLETE');
  console.log('═'.repeat(70));
}

/**
 * Calculate Question-Bill Topic Match Score
 * Measures if TD sponsors bills on topics they ask questions about
 */
async function calculateQuestionBillMatch(tdId: number): Promise<number> {
  console.log('\n1️⃣ QUESTION-BILL TOPIC MATCH:');

  // Get all questions
  const { data: questions } = await supabase
    .from('td_questions')
    .select('subject, question_text')
    .eq('td_id', tdId);

  // Get all bills
  const { data: bills } = await supabase
    .from('td_legislation')
    .select('bill_title')
    .eq('td_id', tdId);

  if (!questions || questions.length === 0) {
    console.log('   No questions found - default 30/100');
    return 30;
  }

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

  console.log('   Question topics:');
  const sortedQTopics = Object.entries(questionTopics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  sortedQTopics.forEach(([topic, count]) => {
    console.log(`      ${topic}: ${count} questions`);
  });

  // Classify bills by topic
  const billTopics: Record<string, number> = {};
  
  if (bills && bills.length > 0) {
    for (const b of bills) {
      const text = (b.bill_title || '').toLowerCase();
      
      for (const [topic, keywords] of Object.entries(TOPICS)) {
        if (keywords.some(keyword => text.includes(keyword))) {
          billTopics[topic] = (billTopics[topic] || 0) + 1;
        }
      }
    }

    console.log('   Bill topics:');
    const sortedBTopics = Object.entries(billTopics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    sortedBTopics.forEach(([topic, count]) => {
      console.log(`      ${topic}: ${count} bills`);
    });
  } else {
    console.log('   No bills sponsored');
  }

  // Calculate match score
  let matchScore = 0;
  let topicsWithQuestions = 0;

  for (const [topic, questionCount] of Object.entries(questionTopics)) {
    if (questionCount < 5) continue; // Only topics they care about (5+ questions)
    
    topicsWithQuestions++;
    const billCount = billTopics[topic] || 0;
    
    // Expected bills: At least 1 bill per 10 questions on the topic
    const expectedBills = questionCount / 10;
    const matchRate = Math.min(100, (billCount / Math.max(1, expectedBills)) * 100);
    
    matchScore += matchRate;
    
    console.log(`   ${topic}: ${questionCount} Q, ${billCount} bills → ${Math.round(matchRate)}% match`);
  }

  if (topicsWithQuestions === 0) {
    console.log('   No focused topics (fewer than 5 questions on any topic)');
    return 50;
  }

  const avgMatchScore = matchScore / topicsWithQuestions;
  console.log(`   → Average Match: ${Math.round(avgMatchScore)}/100`);

  return Math.round(avgMatchScore);
}

/**
 * Calculate Voting Stability Score
 * Measures if TD votes consistently on similar issues
 */
async function calculateVotingStability(tdId: number, party: string): Promise<number> {
  console.log('\n2️⃣ VOTING STABILITY:');

  // Get all votes for this TD
  const { data: votes } = await supabase
    .from('td_votes')
    .select('vote_subject, td_vote, vote_date')
    .eq('td_id', tdId)
    .order('vote_date', { ascending: true });

  if (!votes || votes.length < 10) {
    console.log('   Insufficient votes (<10) - default 50/100');
    return 50;
  }

  console.log(`   Analyzing ${votes.length} votes for stability...`);

  // Group votes by topic
  const votesByTopic: Record<string, { ta: number; nil: number; staon: number }> = {};

  for (const vote of votes) {
    const subject = (vote.vote_subject || '').toLowerCase();
    
    // Find topic
    let matchedTopic = 'other';
    for (const [topic, keywords] of Object.entries(TOPICS)) {
      if (keywords.some(keyword => subject.includes(keyword))) {
        matchedTopic = topic;
        break;
      }
    }

    if (!votesByTopic[matchedTopic]) {
      votesByTopic[matchedTopic] = { ta: 0, nil: 0, staon: 0 };
    }

    if (vote.td_vote === 'ta') votesByTopic[matchedTopic].ta++;
    else if (vote.td_vote === 'nil') votesByTopic[matchedTopic].nil++;
    else if (vote.td_vote === 'staon') votesByTopic[matchedTopic].staon++;
  }

  // Calculate consistency per topic
  let stabilitySum = 0;
  let topicsWithVotes = 0;

  console.log('   Voting patterns by topic:');
  for (const [topic, counts] of Object.entries(votesByTopic)) {
    const total = counts.ta + counts.nil + counts.staon;
    if (total < 3) continue; // Skip topics with few votes
    
    topicsWithVotes++;
    
    // Consistency = highest vote type / total
    const maxVotes = Math.max(counts.ta, counts.nil, counts.staon);
    const consistency = (maxVotes / total) * 100;
    
    stabilitySum += consistency;
    
    console.log(`      ${topic}: ${counts.ta}Tá ${counts.nil}Níl ${counts.staon}Staon → ${Math.round(consistency)}% consistent`);
  }

  if (topicsWithVotes === 0) {
    console.log('   No topics with sufficient votes');
    return 50;
  }

  const avgStability = stabilitySum / topicsWithVotes;
  console.log(`   → Average Stability: ${Math.round(avgStability)}/100`);

  return Math.round(avgStability);
}

testTransparencyScore().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});



