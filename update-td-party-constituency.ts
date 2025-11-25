/**
 * UPDATE TD PARTY AND CONSTITUENCY DATA
 * Fixes the "Unknown" party and constituency issue in td_scores table
 * Run with: npx tsx update-td-party-constituency.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://ospxqnxlotakujloltqy.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Comprehensive TD data from 2024 election
const tdData: Record<string, { party: string; constituency: string }> = {
  // Dublin Central
  'Mary Lou McDonald': { party: 'Sinn Féin', constituency: 'Dublin Central' },
  'Paschal Donohoe': { party: 'Fine Gael', constituency: 'Dublin Central' },
  'Gary Gannon': { party: 'Social Democrats', constituency: 'Dublin Central' },
  'Neasa Hourigan': { party: 'Green Party', constituency: 'Dublin Central' },
  
  // Dublin Bay North
  'Denise Mitchell': { party: 'Sinn Féin', constituency: 'Dublin Bay North' },
  'Richard Bruton': { party: 'Fine Gael', constituency: 'Dublin Bay North' },
  'Aodhán Ó Ríordáin': { party: 'Labour Party', constituency: 'Dublin Bay North' },
  'Cian O\'Callaghan': { party: 'Social Democrats', constituency: 'Dublin Bay North' },
  
  // Dublin Bay South
  'Ivana Bacik': { party: 'Labour Party', constituency: 'Dublin Bay South' },
  'Eamon Ryan': { party: 'Green Party', constituency: 'Dublin Bay South' },
  'Jim O\'Callaghan': { party: 'Fianna Fáil', constituency: 'Dublin Bay South' },
  
  // Cork
  'Micheál Martin': { party: 'Fianna Fáil', constituency: 'Cork South-Central' },
  'Simon Coveney': { party: 'Fine Gael', constituency: 'Cork South-Central' },
  'Michael McGrath': { party: 'Fianna Fáil', constituency: 'Cork South-Central' },
  
  // Kerry
  'Michael Healy-Rae': { party: 'Independent', constituency: 'Kerry' },
  'Danny Healy-Rae': { party: 'Independent', constituency: 'Kerry' },
  'Brendan Griffin': { party: 'Fine Gael', constituency: 'Kerry' },
  'Norma Foley': { party: 'Fianna Fáil', constituency: 'Kerry' },
  
  // Donegal
  'Pearse Doherty': { party: 'Sinn Féin', constituency: 'Donegal' },
  'Pádraig Mac Lochlainn': { party: 'Sinn Féin', constituency: 'Donegal' },
  'Charlie McConalogue': { party: 'Fianna Fáil', constituency: 'Donegal' },
  'Joe McHugh': { party: 'Fine Gael', constituency: 'Donegal' },
  'Thomas Pringle': { party: 'Independent', constituency: 'Donegal' },
  
  // Galway
  'Catherine Connolly': { party: 'Independent', constituency: 'Galway West' },
  'Mairead Farrell': { party: 'Sinn Féin', constituency: 'Galway West' },
  'Éamon Ó Cuív': { party: 'Fianna Fáil', constituency: 'Galway West' },
  
  // Kildare
  'Catherine Murphy': { party: 'Social Democrats', constituency: 'Kildare North' },
  'Bernard Durkan': { party: 'Fine Gael', constituency: 'Kildare North' },
  'James Lawless': { party: 'Fianna Fáil', constituency: 'Kildare North' },
  'Réada Cronin': { party: 'Sinn Féin', constituency: 'Kildare North' },
  
  // Carlow-Kilkenny
  'John McGuinness': { party: 'Fianna Fáil', constituency: 'Carlow–Kilkenny' },
  'Kathleen Funchion': { party: 'Sinn Féin', constituency: 'Carlow–Kilkenny' },
  'John Paul Phelan': { party: 'Fine Gael', constituency: 'Carlow–Kilkenny' },
  'Jennifer Murnane O\'Connor': { party: 'Fianna Fáil', constituency: 'Carlow–Kilkenny' },
  
  // Dublin South-West
  'Paul Murphy': { party: 'People Before Profit-Solidarity', constituency: 'Dublin South-West' },
  'Seán Crowe': { party: 'Sinn Féin', constituency: 'Dublin South-West' },
  
  // Dublin West
  'Jack Chambers': { party: 'Fianna Fáil', constituency: 'Dublin West' },
  'Leo Varadkar': { party: 'Fine Gael', constituency: 'Dublin West' },
  'Roderic O\'Gorman': { party: 'Green Party', constituency: 'Dublin West' },
  
  // Wicklow
  'Simon Harris': { party: 'Fine Gael', constituency: 'Wicklow' },
  'John Brady': { party: 'Sinn Féin', constituency: 'Wicklow' },
  'Steven Matthews': { party: 'Green Party', constituency: 'Wicklow' },
  
  // Louth
  'Fergus O\'Dowd': { party: 'Fine Gael', constituency: 'Louth' },
  'Ruairí Ó Murchú': { party: 'Sinn Féin', constituency: 'Louth' },
  
  // Meath
  'Helen McEntee': { party: 'Fine Gael', constituency: 'Meath East' },
  'Damien English': { party: 'Fine Gael', constituency: 'Meath West' },
  
  // Wexford
  'James Browne': { party: 'Fianna Fáil', constituency: 'Wexford' },
  'Paul Kehoe': { party: 'Fine Gael', constituency: 'Wexford' },
  
  // Waterford
  'Mary Butler': { party: 'Fianna Fáil', constituency: 'Waterford' },
  'David Cullinane': { party: 'Sinn Féin', constituency: 'Waterford' },
  
  // Tipperary
  'Michael Lowry': { party: 'Independent', constituency: 'Tipperary' },
  'Jackie Cahill': { party: 'Fianna Fáil', constituency: 'Tipperary' },
  'Alan Kelly': { party: 'Labour Party', constituency: 'Tipperary' },
  
  // Limerick
  'Willie O\'Dea': { party: 'Fianna Fáil', constituency: 'Limerick City' },
  'Maurice Quinlivan': { party: 'Sinn Féin', constituency: 'Limerick City' },
  
  // Clare
  'Cathal Crowe': { party: 'Fianna Fáil', constituency: 'Clare' },
  'Violet-Anne Wynne': { party: 'Sinn Féin', constituency: 'Clare' },
  
  // Mayo
  'Dara Calleary': { party: 'Fianna Fáil', constituency: 'Mayo' },
  'Alan Dillon': { party: 'Fine Gael', constituency: 'Mayo' },
  
  // Sligo-Leitrim
  'Marc MacSharry': { party: 'Fianna Fáil', constituency: 'Sligo–Leitrim' },
  'Marian Harkin': { party: 'Independent', constituency: 'Sligo–Leitrim' },
  
  // Laois-Offaly
  'Barry Cowen': { party: 'Fianna Fáil', constituency: 'Laois–Offaly' },
  'Sean Fleming': { party: 'Fianna Fáil', constituency: 'Laois–Offaly' },
  
  // Longford-Westmeath
  'Peter Burke': { party: 'Fine Gael', constituency: 'Longford–Westmeath' },
  'Robert Troy': { party: 'Fianna Fáil', constituency: 'Longford–Westmeath' },
  
  // Cavan-Monaghan
  'Matt Carthy': { party: 'Sinn Féin', constituency: 'Cavan–Monaghan' },
  'Brendan Smith': { party: 'Fianna Fáil', constituency: 'Cavan–Monaghan' },
  
  // Additional TDs
  'Frances Black': { party: 'Independent', constituency: 'Dublin South-Central' },
  'Patrick Costello': { party: 'Green Party', constituency: 'Dublin South-Central' },
  'Bríd Smith': { party: 'People Before Profit', constituency: 'Dublin South-Central' },
  'Richard Boyd Barrett': { party: 'People Before Profit-Solidarity', constituency: 'Dún Laoghaire' },
  'Jennifer Whitmore': { party: 'Social Democrats', constituency: 'Wicklow' },
  'Holly Cairns': { party: 'Social Democrats', constituency: 'Cork South-West' },
  'Róisín Shortall': { party: 'Social Democrats', constituency: 'Dublin North-West' },
  'Jennifer Carroll MacNeill': { party: 'Fine Gael', constituency: 'Dún Laoghaire' },
  'Patrick O\'Donovan': { party: 'Fine Gael', constituency: 'Limerick County' },
  'Heather Humphreys': { party: 'Fine Gael', constituency: 'Cavan–Monaghan' },
  'Hildegarde Naughton': { party: 'Fine Gael', constituency: 'Galway West' },
  'Niall Collins': { party: 'Fianna Fáil', constituency: 'Limerick County' },
  'Darragh O\'Brien': { party: 'Fianna Fáil', constituency: 'Dublin Fingal' },
  'Norma Foley': { party: 'Fianna Fáil', constituency: 'Kerry' },
  'Louise O\'Reilly': { party: 'Sinn Féin', constituency: 'Dublin Fingal' },
  'Darren O\'Rourke': { party: 'Sinn Féin', constituency: 'Meath East' },
  'Chris Andrews': { party: 'Sinn Féin', constituency: 'Dublin Bay South' },
  'Dessie Ellis': { party: 'Sinn Féin', constituency: 'Dublin North-West' },
  'Aengus Ó Snodaigh': { party: 'Sinn Féin', constituency: 'Dublin South-Central' },
  'Pa Daly': { party: 'Sinn Féin', constituency: 'Kerry' },
  'Pat Buckley': { party: 'Sinn Féin', constituency: 'Cork East' },
  'Duncan Smith': { party: 'Labour Party', constituency: 'Dublin Fingal' },
  'Ged Nash': { party: 'Labour Party', constituency: 'Louth' },
  'Seán Sherlock': { party: 'Labour Party', constituency: 'Cork East' },
  'Colm Burke': { party: 'Fine Gael', constituency: 'Cork North-Central' },
  'Neale Richmond': { party: 'Fine Gael', constituency: 'Dublin Rathdown' },
  'Michael Creed': { party: 'Fine Gael', constituency: 'Cork North-West' },
  'Christopher O\'Sullivan': { party: 'Fianna Fáil', constituency: 'Cork South-West' },
  'Michael Moynihan': { party: 'Fianna Fáil', constituency: 'Cork North-West' },
  'James O\'Connor': { party: 'Fianna Fáil', constituency: 'Cork East' },
  'Brian Leddin': { party: 'Green Party', constituency: 'Limerick City' },
  'Marc Ó Cathasaigh': { party: 'Green Party', constituency: 'Waterford' },
  'Malcolm Noonan': { party: 'Green Party', constituency: 'Carlow–Kilkenny' },
  'Sorca Clarke': { party: 'Sinn Féin', constituency: 'Longford–Westmeath' },
  'Rose Conway-Walsh': { party: 'Sinn Féin', constituency: 'Mayo' },
  'Martin Browne': { party: 'Sinn Féin', constituency: 'Tipperary' },
  'Martin Kenny': { party: 'Sinn Féin', constituency: 'Sligo–Leitrim' },
  'Brian Stanley': { party: 'Sinn Féin', constituency: 'Laois–Offaly' },
  'Carol Nolan': { party: 'Independent', constituency: 'Laois–Offaly' },
  'Verona Murphy': { party: 'Independent', constituency: 'Wexford' },
  'Noel Grealish': { party: 'Independent', constituency: 'Galway West' },
  'Michael Fitzmaurice': { party: 'Independent', constituency: 'Roscommon–Galway' },
  'Denis Naughten': { party: 'Independent', constituency: 'Roscommon–Galway' },
  'Seán Canney': { party: 'Independent', constituency: 'Galway East' },
  'Peter Fitzpatrick': { party: 'Independent', constituency: 'Louth' },
  'Mattie McGrath': { party: 'Independent', constituency: 'Tipperary' },
  'Michael Collins': { party: 'Independent', constituency: 'Cork South-West' }
};

async function updateTDData() {
  console.log('🔄 Updating TD Party and Constituency Data');
  console.log('═════════════════════════════════════════════\n');
  
  let updated = 0;
  let notFound = 0;
  
  for (const [tdName, info] of Object.entries(tdData)) {
    try {
      const { data, error } = await supabase
        .from('td_scores')
        .update({
          party: info.party,
          constituency: info.constituency
        })
        .eq('politician_name', tdName);
      
      if (error) {
        console.log(`❌ Error updating ${tdName}:`, error.message);
      } else {
        console.log(`✅ Updated ${tdName} - ${info.party} (${info.constituency})`);
        updated++;
      }
    } catch (err) {
      console.log(`❌ Failed to update ${tdName}:`, err);
    }
  }
  
  // Also update any TDs not in our list with "Independent" if they're still Unknown
  try {
    const { data: unknownTDs, error } = await supabase
      .from('td_scores')
      .select('politician_name')
      .or('party.is.null,party.eq.Unknown');
    
    if (unknownTDs && unknownTDs.length > 0) {
      console.log(`\n📋 Found ${unknownTDs.length} TDs still with Unknown/null party:`);
      unknownTDs.forEach((td: any) => {
        if (!tdData[td.politician_name]) {
          console.log(`   - ${td.politician_name}`);
          notFound++;
        }
      });
    }
  } catch (err) {
    console.log('Error checking for unknown TDs:', err);
  }
  
  console.log('\n═════════════════════════════════════════════');
  console.log(`✅ Updated ${updated} TDs successfully`);
  console.log(`ℹ️  ${notFound} TDs still need manual data entry`);
  console.log('═════════════════════════════════════════════\n');
  
  console.log('✨ Next steps:');
  console.log('1. Restart your development server');
  console.log('2. Check the homepage - TD scores should now show parties!');
  console.log('3. If some TDs still show "Unknown", add them to this script\n');
}

// Run the update
updateTDData()
  .then(() => {
    console.log('✅ Update complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Update failed:', err);
    process.exit(1);
  });

