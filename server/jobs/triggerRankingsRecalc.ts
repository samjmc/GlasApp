/**
 * Trigger personal rankings recalculation for a specific user
 */

import 'dotenv/config';
import { PersonalRankingsService } from '../services/personalRankingsService.js';

async function main() {
  const userId = '21d4a28a-1efa-4640-bd3a-6bbd238fa000';
  
  console.log(`🔄 Recalculating personal rankings for user ${userId.substring(0, 8)}...`);
  
  try {
    await PersonalRankingsService.recalculatePersonalRankings(userId);
    console.log('\n✅ Rankings recalculated!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();























