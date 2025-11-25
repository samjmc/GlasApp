/**
 * One-time script to recalculate all TD scores from their articles
 * Run this after setting up the automated scoring system
 */

import 'dotenv/config';
import { TDScoreCalculator } from '../services/tdScoreCalculator.js';

async function main() {
  console.log('🔄 Recalculating all TD scores from articles...\n');
  
  try {
    await TDScoreCalculator.recalculateAllScores();
    console.log('\n✅ All scores recalculated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

