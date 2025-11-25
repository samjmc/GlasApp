/**
 * Populate Party Performance Scores
 * Migrates data from party-parliamentary-activity.json to database
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function populatePartyScores() {
  console.log('🎯 Populating Party Performance Scores');
  console.log('═══════════════════════════════════════\n');

  // Load party data
  const dataPath = path.join(process.cwd(), 'data', 'party-parliamentary-activity.json');
  const partyData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // First, get or create party IDs
  const partyNames = Object.keys(partyData);
  
  for (const partyName of partyNames) {
    const activity = partyData[partyName];
    
    // Insert or get party
    const { data: existingParty, error: partyError } = await supabase
      .from('parties')
      .select('id')
      .eq('name', partyName)
      .single();

    let partyId;
    
    if (existingParty) {
      partyId = existingParty.id;
    } else {
      // Create party
      const { data: newParty, error: createError } = await supabase
        .from('parties')
        .insert({
          name: partyName,
          abbreviation: partyName === 'Sinn Féin' ? 'SF' : 
                       partyName === 'Fine Gael' ? 'FG' :
                       partyName === 'Fianna Fáil' ? 'FF' :
                       partyName === 'Labour Party' ? 'Lab' :
                       partyName === 'Green Party' ? 'GP' :
                       partyName === 'Social Democrats' ? 'SD' :
                       partyName === 'People Before Profit-Solidarity' ? 'PBP-Sol' :
                       partyName === 'Aontú' ? 'Aon' :
                       partyName === 'Independent Ireland' ? 'II' :
                       partyName,
          color: partyName === 'Sinn Féin' ? '#326760' :
                partyName === 'Fine Gael' ? '#6699FF' :
                partyName === 'Fianna Fáil' ? '#66BB66' :
                partyName === 'Labour Party' ? '#CC0000' :
                partyName === 'Green Party' ? '#99CC33' :
                partyName === 'Social Democrats' ? '#752F8B' :
                partyName === 'People Before Profit-Solidarity' ? '#8C2A1C' :
                partyName === 'Aontú' ? '#44532A' :
                partyName === 'Independent Ireland' ? '#6F2DA8' :
                '#808080'
        })
        .select('id')
        .single();

      if (createError) {
        console.log(`❌ Error creating party ${partyName}:`, createError.message);
        continue;
      }
      partyId = newParty?.id;
    }

    if (!partyId) {
      console.log(`⚠️  Could not get/create party ID for ${partyName}`);
      continue;
    }

    // Check if score exists
    const { data: existingScore } = await supabase
      .from('party_performance_scores')
      .select('id')
      .eq('party_id', partyId)
      .eq('score_type', 'parliamentary_activity')
      .single();

    const scoreData = {
      party_id: partyId,
      score_type: 'parliamentary_activity',
      overall_score: activity.combinedActivityScore,
      parliamentary_activity_score: activity.combinedActivityScore,
      transparency_score: activity.attendanceScore,
      policy_consistency_score: activity.questionsScore,
      government_status: partyName === 'Fianna Fáil' || partyName === 'Fine Gael' || partyName === 'Green Party' ? 'coalition' : 'opposition',
      calculated_at: new Date().toISOString()
    };

    let scoreError;
    if (existingScore) {
      // Update existing
      const result = await supabase
        .from('party_performance_scores')
        .update(scoreData)
        .eq('id', existingScore.id);
      scoreError = result.error;
    } else {
      // Insert new
      const result = await supabase
        .from('party_performance_scores')
        .insert(scoreData);
      scoreError = result.error;
    }

    if (scoreError) {
      console.log(`❌ Error inserting score for ${partyName}:`, scoreError.message);
    } else {
      console.log(`✅ ${partyName}: Score ${activity.combinedActivityScore}/100 (${activity.tdCount} TDs)`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Party scores populated successfully!');
  console.log('═══════════════════════════════════════\n');
}

populatePartyScores()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });

