/**
 * Populate Initial TD Scores
 * Creates baseline scores for all 200 TDs from parliamentary data
 */

import 'dotenv/config';
import { supabaseDb } from './server/db';
import fs from 'fs';
import path from 'path';

async function populateInitialTDScores() {
  console.log('🚀 POPULATING INITIAL TD SCORES');
  console.log('=====================================\n');

  if (!supabaseDb) {
    console.error('❌ Supabase not connected');
    process.exit(1);
  }

  try {
    // Load parliamentary data
    console.log('📊 Loading parliamentary data...');
    const dataPath = path.join(process.cwd(), 'data', 'parliamentary-activity.json');
    const parliamentaryData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    const tdNames = Object.keys(parliamentaryData);
    console.log(`✅ Found ${tdNames.length} TDs\n`);

    // Check how many TDs already have scores
    const { count: existingCount } = await supabaseDb
      .from('td_scores')
      .select('*', { count: 'exact', head: true });

    console.log(`📋 Existing TD scores in database: ${existingCount || 0}`);

    if (existingCount && existingCount > 0) {
      console.log('\n⚠️  Database already has TD scores.');
      console.log('   Do you want to recreate all scores? This will reset everything.');
      console.log('\n   To proceed: Delete all records from td_scores table first.');
      console.log('   Then run this script again.\n');
      process.exit(0);
    }

    // Create initial scores for all TDs
    console.log('\n📝 Creating initial scores for all TDs...\n');
    
    let created = 0;
    let skipped = 0;
    
    for (const tdKey of tdNames) {
      const td = parliamentaryData[tdKey];
      const tdName = td.fullName;
      
      try {
        // Create baseline score record
        const { error } = await supabaseDb
          .from('td_scores')
          .insert({
            politician_name: tdName,
            constituency: td.constituency || 'Unknown',
            party: td.party || 'Unknown',
            
            // Start all TDs at baseline (50/100 = 1500 ELO)
            overall_elo: 1500,
            transparency_elo: 1500,
            effectiveness_elo: 1500,
            integrity_elo: 1500,
            consistency_elo: 1500,
            constituency_service_elo: 1500,
            
            // Initialize stats
            total_stories: 0,
            positive_stories: 0,
            negative_stories: 0,
            neutral_stories: 0,
            
            // Metadata
            last_updated: new Date().toISOString()
          });

        if (error) {
          if (error.code === '23505') {
            // Duplicate - skip
            skipped++;
          } else {
            console.error(`   ❌ Error for ${tdName}:`, error.message);
          }
        } else {
          created++;
          if (created % 20 === 0) {
            console.log(`   ✅ Created ${created} scores...`);
          }
        }

      } catch (error: any) {
        console.error(`   ❌ Failed for ${tdName}:`, error.message);
      }
    }

    console.log(`\n✅ COMPLETE!`);
    console.log(`   Created: ${created} TD scores`);
    console.log(`   Skipped: ${skipped} (already exist)`);
    console.log(`\n📊 Your database now has ${created} TDs ready for scoring!`);
    console.log(`\n🎯 Next Steps:`);
    console.log(`   1. Restart your server`);
    console.log(`   2. Refresh homepage - TDs will appear!`);
    console.log(`   3. Run news scraper to update scores with real news`);
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run it
populateInitialTDScores()
  .then(() => {
    console.log('\n✨ Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });



