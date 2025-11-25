/**
 * One-time script to update personal rankings from existing policy votes
 * Run this after extracting TD stances from already-voted articles
 */

import 'dotenv/config';
import { PersonalRankingsService } from '../services/personalRankingsService.js';
import { supabaseDb } from '../db.js';

async function main() {
  console.log('🔄 Updating personal rankings from existing votes...\n');
  
  try {
    // Get all policy votes
    const { data: votes } = await supabaseDb
      .from('user_policy_votes')
      .select('user_id, article_id, support_rating');
    
    if (!votes || votes.length === 0) {
      console.log('No votes found');
      return;
    }
    
    console.log(`Found ${votes.length} policy votes to process`);
    
    // Process each vote
    for (const vote of votes) {
      console.log(`\nProcessing vote: User ${vote.user_id.substring(0, 8)} on article ${vote.article_id} (rating: ${vote.support_rating})`);
      
      try {
        await PersonalRankingsService.updatePolicyAgreementFromVote(
          vote.user_id,
          vote.article_id,
          vote.support_rating
        );
      } catch (error) {
        console.error(`  ❌ Error processing vote:`, error);
      }
    }
    
    console.log('\n✅ All votes processed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();























