/**
 * Calculate Transparency Score for All TDs
 * Question-Bill Match (60%) + Voting Stability (40%)
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';

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

// Government parties and supporting independents (34th Dáil - Nov 2024 coalition)
const GOVERNMENT_PARTIES = ['Fianna Fáil', 'Fine Gael'];

// Independent TDs formally supporting the government
const GOVERNMENT_INDEPENDENTS = [
  'Seán Canney', 'Noel Grealish', 'Marian Harkin', 'Barry Heneghan',
  'Michael Lowry', 'Kevin Boxer Moran', 'Gillian Toole', 'Verona Murphy',
  'Danny Healy-Rae', 'Michael Healy-Rae'
];

async function calculateTransparencyAllTDs() {
  console.log('🔍 CALCULATING TRANSPARENCY SCORES FOR ALL TDs');
  console.log('═'.repeat(70));

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Pre-load all data
  console.log('📥 Pre-loading data...');
  
  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name, party')
    .eq('is_active', true);

  console.log(`✅ Loaded ${tds?.length} TDs`);

  // Load all questions
  const { data: allQuestions } = await supabase
    .from('td_questions')
    .select('td_id, subject, question_text')
    .in('td_id', tds!.map(t => t.id));

  console.log(`✅ Loaded ${allQuestions?.length} questions`);

  // Load all bills
  const { data: allBills } = await supabase
    .from('td_legislation')
    .select('td_id, bill_title')
    .in('td_id', tds!.map(t => t.id));

  console.log(`✅ Loaded ${allBills?.length} bills`);

  // Load all votes
  const allVotes: any[] = [];
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('td_votes')
      .select('td_id, vote_subject, td_vote, vote_date')
      .in('td_id', tds!.map(t => t.id))
      .range(offset, offset + 999);

    if (!batch || batch.length === 0) break;
    allVotes.push(...batch);
    offset += 1000;
    if (batch.length < 1000) break;
  }

  console.log(`✅ Loaded ${allVotes.length} votes\n`);

  // Process each TD
  console.log('📊 Calculating transparency scores...');
  console.log('─'.repeat(70));

  let updated = 0;
  const results: any[] = [];

  for (const td of (tds || [])) {
    const tdQuestions = allQuestions?.filter(q => q.td_id === td.id) || [];
    const tdBills = allBills?.filter(b => b.td_id === td.id) || [];
    const tdVotes = allVotes.filter(v => v.td_id === td.id);

    const questionBillMatch = calculateQuestionBillMatch(tdQuestions, tdBills);
    const votingStability = calculateVotingStability(tdVotes);
    
    const consistencyScore = Math.round(
      questionBillMatch * 0.60 +
      votingStability * 0.40
    );

    const isGovernment = GOVERNMENT_PARTIES.includes(td.party) || 
                        GOVERNMENT_INDEPENDENTS.includes(td.politician_name);

    // Update database
    await supabase
      .from('td_scores')
      .update({
        consistency_score: consistencyScore
      })
      .eq('id', td.id);

    results.push({
      name: td.politician_name,
      party: td.party,
      consistency: consistencyScore,
      questionBillMatch,
      votingStability,
      isGovernment
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

  // Show comparison: Government vs Opposition
  const govScores = results.filter(r => r.isGovernment);
  const oppScores = results.filter(r => !r.isGovernment);

  const avgGov = govScores.reduce((sum, r) => sum + r.consistency, 0) / govScores.length;
  const avgOpp = oppScores.reduce((sum, r) => sum + r.consistency, 0) / oppScores.length;

  console.log('\n📊 COMPARISON: Government vs Opposition');
  console.log('─'.repeat(70));
  console.log(`Government TDs (FF+FG+Independents, n=${govScores.length}): Avg ${Math.round(avgGov)}/100`);
  console.log(`Opposition TDs (n=${oppScores.length}): Avg ${Math.round(avgOpp)}/100`);
  console.log(`Difference: ${Math.round(avgOpp - avgGov)} points`);

  // Show top 10
  console.log('\n📊 Top 10 Consistency Scores:');
  results.sort((a, b) => b.consistency - a.consistency);
  results.slice(0, 10).forEach(r => {
    const govLabel = r.isGovernment ? ' [GOV]' : '';
    console.log(`   ${r.name.padEnd(30)} ${r.consistency}/100${govLabel}  (Match:${r.questionBillMatch} Stable:${r.votingStability})`);
  });

  // Show bottom 10
  console.log('\n📉 Bottom 10 Consistency Scores:');
  results.slice(-10).reverse().forEach(r => {
    const govLabel = r.isGovernment ? ' [GOV]' : '';
    console.log(`   ${r.name.padEnd(30)} ${r.consistency}/100${govLabel}  (Match:${r.questionBillMatch} Stable:${r.votingStability})`);
  });
}

function calculateQuestionBillMatch(questions: any[], bills: any[]): number {
  if (questions.length === 0) return 30;

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
    if (questionCount < 5) continue; // Only significant topics
    
    topicsWithQuestions++;
    const billCount = billTopics[topic] || 0;
    const expectedBills = questionCount / 10;
    const matchRate = Math.min(100, (billCount / Math.max(1, expectedBills)) * 100);
    
    matchScore += matchRate;
  }

  if (topicsWithQuestions === 0) return 50;

  return Math.round(matchScore / topicsWithQuestions);
}

function calculateVotingStability(votes: any[]): number {
  if (votes.length < 10) return 50;

  const votesByTopic: Record<string, { ta: number; nil: number; staon: number }> = {};

  for (const vote of votes) {
    const subject = (vote.vote_subject || '').toLowerCase();
    
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

  let stabilitySum = 0;
  let topicsWithVotes = 0;

  for (const [topic, counts] of Object.entries(votesByTopic)) {
    const total = counts.ta + counts.nil + counts.staon;
    if (total < 3) continue;
    
    topicsWithVotes++;
    const maxVotes = Math.max(counts.ta, counts.nil, counts.staon);
    const consistency = (maxVotes / total) * 100;
    stabilitySum += consistency;
  }

  if (topicsWithVotes === 0) return 50;

  return Math.round(stabilitySum / topicsWithVotes);
}

calculateTransparencyAllTDs().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

