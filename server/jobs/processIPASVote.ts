/**
 * Process the IPAS article vote to update personal rankings
 */

import 'dotenv/config';
import { PersonalRankingsService } from '../services/personalRankingsService.js';

async function main() {
  const userId = '21d4a28a-1efa-4640-bd3a-6bbd238fa000';
  const articleId = 27; // IPAS rent article
  const rating = 5; // User rated it 5/5 (supports the policy)
  
  console.log(`Processing IPAS vote: Article ${articleId}, Rating ${rating}/5\n`);
  
  try {
    await PersonalRankingsService.updatePolicyAgreementFromVote(userId, articleId, rating);
    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();























