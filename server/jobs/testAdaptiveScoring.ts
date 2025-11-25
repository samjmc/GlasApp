/**
 * Test and demonstrate the adaptive scoring engine
 * Shows how it prevents score saturation
 */

import { AdaptiveScoringEngine } from '../services/adaptiveScoringEngine.js';

console.log('🧪 ADAPTIVE SCORING ENGINE TEST\n');
console.log('=' .repeat(70));

// Test 1: High compatibility TD (90%) - should be hard to increase
console.log('\n📊 TEST 1: High Compatibility TD (starts at 90%)');
console.log('What happens when user agrees 10 times in a row?\n');

let score = 90;
let totalDelta = 0;

for (let i = 0; i < 10; i++) {
  const rawDelta = 3; // Agreement with strong stance
  const adaptiveDelta = AdaptiveScoringEngine.calculateAdaptiveDelta(score, rawDelta, i);
  const explanation = AdaptiveScoringEngine.explainDelta(score, rawDelta, adaptiveDelta, i);
  
  console.log(`Vote ${i+1}: Score ${score.toFixed(1)}% → ${(score + adaptiveDelta).toFixed(1)}%  (${adaptiveDelta >= 0 ? '+' : ''}${adaptiveDelta.toFixed(1)} vs +${rawDelta} raw)`);
  if (explanation !== 'Normal impact') {
    console.log(`        ${explanation}`);
  }
  
  score += adaptiveDelta;
  totalDelta += adaptiveDelta;
}

console.log(`\n✅ Result: Started at 90%, ended at ${score.toFixed(1)}% (+${totalDelta.toFixed(1)} total)`);
console.log(`   Without dampening would be: ${Math.min(100, 90 + (3 * 10))}%`);

// Test 2: High compatibility TD - disagreements should hurt MORE
console.log('\n' + '=' .repeat(70));
console.log('\n📊 TEST 2: High Compatibility TD (90%) - DISAGREEMENTS');
console.log('What happens when user disagrees 5 times?\n');

score = 90;
totalDelta = 0;

for (let i = 0; i < 5; i++) {
  const rawDelta = -3; // Disagreement with strong stance
  const adaptiveDelta = AdaptiveScoringEngine.calculateAdaptiveDelta(score, rawDelta, i);
  const explanation = AdaptiveScoringEngine.explainDelta(score, rawDelta, adaptiveDelta, i);
  
  console.log(`Vote ${i+1}: Score ${score.toFixed(1)}% → ${(score + adaptiveDelta).toFixed(1)}%  (${adaptiveDelta.toFixed(1)} vs ${rawDelta} raw)`);
  if (explanation !== 'Normal impact') {
    console.log(`        ${explanation}`);
  }
  
  score += adaptiveDelta;
  totalDelta += adaptiveDelta;
}

console.log(`\n✅ Result: Started at 90%, ended at ${score.toFixed(1)}% (${totalDelta.toFixed(1)} total)`);
console.log(`   Disagreements AMPLIFIED by ~${Math.abs(totalDelta / (3 * 5) * 100 - 100).toFixed(0)}%`);

// Test 3: Low compatibility TD (15%) - should be hard to decrease further
console.log('\n' + '=' .repeat(70));
console.log('\n📊 TEST 3: Low Compatibility TD (15%) - More disagreements');
console.log('What happens when user disagrees 5 more times?\n');

score = 15;
totalDelta = 0;

for (let i = 0; i < 5; i++) {
  const rawDelta = -3;
  const adaptiveDelta = AdaptiveScoringEngine.calculateAdaptiveDelta(score, rawDelta, i);
  
  console.log(`Vote ${i+1}: Score ${score.toFixed(1)}% → ${(score + adaptiveDelta).toFixed(1)}%  (${adaptiveDelta.toFixed(1)} vs ${rawDelta} raw)`);
  
  score += adaptiveDelta;
  totalDelta += adaptiveDelta;
}

console.log(`\n✅ Result: Started at 15%, ended at ${score.toFixed(1)}% (${totalDelta.toFixed(1)} total)`);
console.log(`   Without dampening would be: ${Math.max(0, 15 - 15)}% (floor hit!)`);
console.log(`   Dampening prevents unrealistic 0% scores`);

// Test 4: Middle range (55%) - should remain volatile
console.log('\n' + '=' .repeat(70));
console.log('\n📊 TEST 4: Middle Range TD (55%) - Mixed votes');
console.log('Alternating agreements and disagreements\n');

score = 55;
const startScore = score;

for (let i = 0; i < 10; i++) {
  const rawDelta = i % 2 === 0 ? 3 : -3; // Alternate
  const adaptiveDelta = AdaptiveScoringEngine.calculateAdaptiveDelta(score, rawDelta, i);
  
  console.log(`Vote ${i+1}: ${adaptiveDelta >= 0 ? 'Agree' : 'Disagree'} → ${score.toFixed(1)}% → ${(score + adaptiveDelta).toFixed(1)}%  (${adaptiveDelta >= 0 ? '+' : ''}${adaptiveDelta.toFixed(1)})`);
  
  score += adaptiveDelta;
}

console.log(`\n✅ Result: Middle range stays volatile! ${startScore}% → ${score.toFixed(1)}%`);
console.log(`   Middle scores (40-60) experience full deltas until many votes`);

// Test 5: Long-term simulation
console.log('\n' + '=' .repeat(70));
console.log('\n📊 TEST 5: Long-term Convergence (100 votes, 70% agreement)');

const sim = AdaptiveScoringEngine.simulateScoreDistribution(50, 100, 0.7);

console.log(`\nStarting score: 50%`);
console.log(`After 100 votes with 70% agreement:`);
console.log(`  Final score: ${sim.finalScore}%`);
console.log(`  Average volatility: ${sim.volatility} points/vote`);
console.log(`\n  Score progression (every 10 votes):`);
for (let i = 0; i <= 100; i += 10) {
  console.log(`    ${i} votes: ${sim.distribution[i].toFixed(1)}%`);
}

console.log('\n✅ Key insight: Score converges but never hits 100% (prevents saturation!)');

// Summary
console.log('\n' + '=' .repeat(70));
console.log('\n🎯 ADAPTIVE SCORING PRINCIPLES:\n');
console.log('1. Diminishing Returns: Hard to improve 90+ scores, hard to worsen <15 scores');
console.log('2. Asymmetric Penalties: Easier to LOSE trust at high scores than GAIN it');
console.log('3. Confidence Dampening: After 20+ votes, changes become smaller (stability)');
console.log('4. Middle Volatility: Scores 40-60 remain most responsive to new info');
console.log('5. Natural Distribution: Scores spread across range, not clustered at extremes');
console.log('\n✨ Result: Scores stay meaningful and interesting forever!\n');























