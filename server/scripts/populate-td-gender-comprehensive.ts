/**
 * Comprehensive TD Gender Population Script
 * Uses multiple sources: Oireachtas API + manual curation based on public information
 * 
 * Run with: npx tsx server/scripts/populate-td-gender-comprehensive.ts
 */

import axios from 'axios';
import { supabaseDb } from '../db';

const BASE_URL = 'https://api.oireachtas.ie/v1';

interface TDGenderInfo {
  name: string;
  gender: 'Male' | 'Female';
  source: string;
}

// Known female TDs (based on public information - names that are typically female or known politicians)
const KNOWN_FEMALE_TD_NAMES = [
  'Jennifer', 'Holly', 'Mairéad', 'Marie', 'Catherine', 'Claire', 'Joanne', 
  'Maeve', 'Norma', 'Louise', 'Pauline', 'Paula', 'Róisín', 'Ivana', 'Emer',
  'Kathleen', 'Jennifer', 'Verona', 'Carol', 'Hildegarde', 'Frances', 'Neasa',
  'Cian', 'Aodhán', 'Brendan', 'Brian', 'Cathal', 'Colm', 'Cormac', 'Dara',
  'Darren', 'Denis', 'Dermot', 'Dessie', 'Eamon', 'Jack', 'James', 'John',
  'Kevin', 'Kieran', 'Malcolm', 'Marc', 'Mark', 'Martin', 'Matt', 'Michael',
  'Mick', 'Neale', 'Niall', 'Noel', 'Oisín', 'Paddy', 'Padraig', 'Patrick',
  'Paul', 'Pearse', 'Peter', 'Pádraig', 'Richard', 'Robert', 'Seán', 'Simon',
  'Stephen', 'Steven', 'Thomas', 'Tim', 'Tom', 'Willie'
];

// Common Irish female first names
const FEMALE_FIRST_NAMES = [
  'Aoife', 'Jennifer', 'Holly', 'Mairéad', 'Marie', 'Mary', 'Catherine', 
  'Claire', 'Joanne', 'Maeve', 'Norma', 'Louise', 'Pauline', 'Paula', 
  'Róisín', 'Ivana', 'Emer', 'Kathleen', 'Verona', 'Carol', 'Hildegarde', 
  'Frances', 'Neasa', 'Helen', 'Neale', 'Niamh', 'Patricia', 'Caoimhe',
  'Saoirse', 'Sorcha', 'Fiona', 'Sarah', 'Lisa', 'Rebecca', 'Emma',
  'Sophie', 'Kate', 'Michelle', 'Anne', 'Ann', 'Caitlin', 'Ciara',
  'Sinead', 'Siobhan', 'Eithne', 'Grainne', 'Orla', 'Deirdre'
];

// Common Irish male first names
const MALE_FIRST_NAMES = [
  'Cian', 'Aodhán', 'Brendan', 'Brian', 'Cathal', 'Colm', 'Cormac', 'Dara',
  'Darren', 'Denis', 'Dermot', 'Dessie', 'Eamon', 'Éamon', 'Jack', 'James',
  'John', 'Kevin', 'Kieran', 'Malcolm', 'Marc', 'Mark', 'Martin', 'Matt',
  'Matthew', 'Michael', 'Mick', 'Niall', 'Noel', 'Oisín', 'Paddy', 'Padraig',
  'Patrick', 'Paul', 'Pearse', 'Peter', 'Pádraig', 'Richard', 'Robert',
  'Seán', 'Sean', 'Simon', 'Stephen', 'Steven', 'Thomas', 'Tim', 'Tom',
  'Willie', 'William', 'Aengus', 'Aidan', 'Barry', 'Conor', 'Connor',
  'Darragh', 'David', 'Declan', 'Donal', 'Donncha', 'Gary', 'Gerard',
  'Graham', 'Ian', 'Joe', 'Joseph', 'Kenneth', 'Liam', 'Luke', 'Maurice',
  'Manus', 'Micheál', 'Micheal', 'Neale', 'Noel', 'Ossian', 'Owen',
  'Paraic', 'Patrick', 'Paudie', 'Peadar', 'Ray', 'Rian', 'Ruairi',
  'Ruairí', 'Shane', 'Tadhg', 'Tony', 'Vincent', 'Ciarán', 'Ciaran',
  'Christopher', 'Chris', 'Daniel', 'Alan', 'Anthony', 'Bernard',
  'Fergus', 'Francis', 'Frank', 'Gregory', 'Hugh', 'Ivor', 'Jer',
  'Jonathan', 'Marcella', 'Mattie', 'Brendan', 'Seamus', 'Séamus'
];

function inferGenderFromName(fullName: string): 'Male' | 'Female' | null {
  const firstName = fullName.split(' ')[0];
  
  // Check female names first
  for (const femaleName of FEMALE_FIRST_NAMES) {
    if (firstName.toLowerCase() === femaleName.toLowerCase()) {
      return 'Female';
    }
  }
  
  // Check male names
  for (const maleName of MALE_FIRST_NAMES) {
    if (firstName.toLowerCase() === maleName.toLowerCase()) {
      return 'Male';
    }
  }
  
  return null;
}

async function fetchCurrentTDs(): Promise<TDGenderInfo[]> {
  console.log('📡 Fetching current Dáil members...');
  
  try {
    const response = await axios.get(`${BASE_URL}/members`, {
      params: {
        chamber: 'dail',
        house_no: 34, // 34th Dáil (current)
        limit: 200
      }
    });
    
    const tds: TDGenderInfo[] = [];
    
    if (response.data?.results) {
      for (const result of response.data.results) {
        const member = result.member;
        
        // Find current Dáil membership
        const currentMembership = member.memberships?.find((m: any) => 
          m.membership.house?.houseCode === 'dail' &&
          m.membership.house?.houseNo === '34' &&
          m.membership.dateRange?.end === null
        );
        
        if (!currentMembership) continue;
        
        const fullName = member.fullName;
        
        // First check if API has gender
        let gender: 'Male' | 'Female' | null = null;
        let source = 'inferred';
        
        if (member.gender === 'male') {
          gender = 'Male';
          source = 'oireachtas_api';
        } else if (member.gender === 'female') {
          gender = 'Female';
          source = 'oireachtas_api';
        } else {
          // Infer from name
          gender = inferGenderFromName(fullName);
        }
        
        if (gender) {
          tds.push({
            name: fullName,
            gender,
            source
          });
        } else {
          console.log(`   ⚠️  Could not determine gender for: ${fullName}`);
        }
      }
    }
    
    console.log(`✅ Found ${tds.length} TDs`);
    console.log(`   Male: ${tds.filter(t => t.gender === 'Male').length}`);
    console.log(`   Female: ${tds.filter(t => t.gender === 'Female').length}`);
    
    return tds;
    
  } catch (error: any) {
    console.error('❌ Failed to fetch TDs:', error.message);
    return [];
  }
}

async function updateDatabaseWithGender(tds: TDGenderInfo[]): Promise<void> {
  if (!supabaseDb) {
    console.error('❌ Database not connected');
    return;
  }
  
  console.log('\n💾 Updating database with gender information...');
  
  let updated = 0;
  let notFound = 0;
  let alreadySet = 0;
  
  for (const td of tds) {
    try {
      // Try exact match first
      let { data: existingTD, error: fetchError } = await supabaseDb
        .from('td_scores')
        .select('id, politician_name, gender')
        .eq('politician_name', td.name)
        .maybeSingle();
      
      // If not found, try case-insensitive match
      if (!existingTD) {
        const { data: fuzzyMatch } = await supabaseDb
          .from('td_scores')
          .select('id, politician_name, gender')
          .ilike('politician_name', td.name);
        
        if (fuzzyMatch && fuzzyMatch.length > 0) {
          existingTD = fuzzyMatch[0];
        }
      }
      
      if (!existingTD) {
        console.log(`   ⚠️  TD not found in database: ${td.name}`);
        notFound++;
        continue;
      }
      
      // Skip if already has gender
      if (existingTD.gender && existingTD.gender.trim() !== '') {
        console.log(`   ℹ️  Gender already set for ${td.name}: ${existingTD.gender}`);
        alreadySet++;
        continue;
      }
      
      // Update gender
      const { error: updateError } = await supabaseDb
        .from('td_scores')
        .update({ gender: td.gender })
        .eq('id', existingTD.id);
      
      if (updateError) {
        console.error(`   ❌ Failed to update ${td.name}:`, updateError.message);
      } else {
        console.log(`   ✅ Updated ${td.name}: ${td.gender} (${td.source})`);
        updated++;
      }
      
    } catch (error: any) {
      console.error(`   ❌ Error processing ${td.name}:`, error.message);
    }
  }
  
  console.log('\n==========================================');
  console.log('📊 Summary:');
  console.log(`   TDs updated: ${updated}`);
  console.log(`   TDs already set: ${alreadySet}`);
  console.log(`   TDs not found: ${notFound}`);
  console.log('==========================================\n');
}

async function main() {
  console.log('\n🏛️ ========================================');
  console.log('👥 TD GENDER POPULATION SCRIPT');
  console.log('==========================================\n');
  
  try {
    // Fetch TDs
    const tds = await fetchCurrentTDs();
    
    if (tds.length === 0) {
      console.error('❌ No TDs found - exiting');
      process.exit(1);
    }
    
    // Update database
    await updateDatabaseWithGender(tds);
    
    // Verify results
    if (supabaseDb) {
      const { data: stats } = await supabaseDb
        .from('td_scores')
        .select('gender')
        .eq('is_active', true);
      
      if (stats) {
        const total = stats.length;
        const withGender = stats.filter(t => t.gender && t.gender.trim() !== '').length;
        const male = stats.filter(t => t.gender?.toLowerCase() === 'male').length;
        const female = stats.filter(t => t.gender?.toLowerCase() === 'female').length;
        
        console.log('📊 Database Statistics:');
        console.log(`   Total active TDs: ${total}`);
        console.log(`   TDs with gender: ${withGender} (${Math.round(withGender/total*100)}%)`);
        console.log(`   Male: ${male}`);
        console.log(`   Female: ${female}`);
        console.log(`   Missing: ${total - withGender}\n`);
      }
    }
    
    console.log('✅ Gender population complete!\n');
    process.exit(0);
    
  } catch (error: any) {
    console.error('❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

























