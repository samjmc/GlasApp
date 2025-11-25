/**
 * Correct Party Baselines for Existing TD Ideology Profiles
 * 
 * This script fixes TD ideology profiles that were created with baseline 0
 * instead of their party's baseline scores.
 */

import { supabaseDb as supabase } from '../db';
import { IDEOLOGY_DIMENSIONS, clampIdeologyValue } from '../constants/ideology';

async function correctPartyBaselines() {
  if (!supabase) {
    console.error('❌ Supabase not initialized');
    return;
  }

  console.log('🔧 Correcting Party Baselines for TD Ideology Profiles\n');

  // Get all TD profiles with their party info
  const { data: profiles, error: profileError } = await supabase
    .from('td_ideology_profiles')
    .select('*')
    .not('party', 'is', null)
    .neq('party', 'Independent');

  if (profileError) {
    console.error('❌ Error fetching TD profiles:', profileError.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('ℹ️  No TD profiles found');
    return;
  }

  console.log(`Found ${profiles.length} TD profiles to check\n`);

  // Get all party baselines
  const { data: parties, error: partyError } = await supabase
    .from('parties')
    .select('name, economic_score, social_score, cultural_score, globalism_score, environmental_score, authority_score, welfare_score, technocratic_score');

  if (partyError) {
    console.error('❌ Error fetching party baselines:', partyError.message);
    return;
  }

  const partyMap = new Map();
  parties?.forEach((party: any) => {
    if (party.economic_score !== null) {
      partyMap.set(party.name, {
        economic: Number(party.economic_score),
        social: Number(party.social_score),
        cultural: Number(party.cultural_score),
        globalism: Number(party.globalism_score),
        environmental: Number(party.environmental_score),
        authority: Number(party.authority_score),
        welfare: Number(party.welfare_score),
        technocratic: Number(party.technocratic_score),
      });
    }
  });

  let corrected = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const partyBaseline = partyMap.get(profile.party);
    
    if (!partyBaseline) {
      console.log(`⚠️  No baseline found for party: ${profile.party} (${profile.politician_name})`);
      skipped++;
      continue;
    }

    // Check if profile looks like it started at 0 instead of party baseline
    // We look at dimensions that typically have strong party signals
    const economicDiff = Math.abs(profile.economic - partyBaseline.economic);
    const socialDiff = Math.abs(profile.social - partyBaseline.social);
    const welfareDiff = Math.abs(profile.welfare - partyBaseline.welfare);
    
    // If all three dimensions are more than 1.5 points away from baseline,
    // AND the profile has low weight (< 5 articles), it likely started at 0
    const needsCorrection = 
      profile.total_weight < 5 &&
      (economicDiff > 1.5 || socialDiff > 1.5 || welfareDiff > 1.5) &&
      (Math.abs(profile.economic) < 1 && Math.abs(profile.social) < 1 && Math.abs(profile.welfare) < 1);

    if (needsCorrection) {
      console.log(`🔧 Correcting ${profile.politician_name} (${profile.party})`);
      console.log(`   Current: economic=${profile.economic.toFixed(2)}, social=${profile.social.toFixed(2)}, welfare=${profile.welfare.toFixed(2)}`);
      console.log(`   Party baseline: economic=${partyBaseline.economic}, social=${partyBaseline.social}, welfare=${partyBaseline.welfare}`);
      
      // Add party baseline to current profile (preserving any adjustments that were made)
      const correctedProfile: any = {
        politician_name: profile.politician_name,
        updated_at: new Date().toISOString(),
      };

      for (const dimension of IDEOLOGY_DIMENSIONS) {
        const current = Number(profile[dimension]) || 0;
        const baseline = partyBaseline[dimension] || 0;
        
        // If current is near 0, set to baseline + current (preserving adjustments)
        // This assumes adjustments were made from 0 instead of from baseline
        const corrected = clampIdeologyValue(baseline + current);
        correctedProfile[dimension] = corrected;
      }

      const { error: updateError } = await supabase
        .from('td_ideology_profiles')
        .update(correctedProfile)
        .eq('politician_name', profile.politician_name);

      if (updateError) {
        console.error(`   ❌ Error updating ${profile.politician_name}:`, updateError.message);
      } else {
        console.log(`   ✅ Corrected: economic=${correctedProfile.economic.toFixed(2)}, social=${correctedProfile.social.toFixed(2)}, welfare=${correctedProfile.welfare.toFixed(2)}`);
        corrected++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Correction complete!`);
  console.log(`   Corrected: ${corrected} profiles`);
  console.log(`   Skipped: ${skipped} profiles (already correct or high weight)`);
}

correctPartyBaselines().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

