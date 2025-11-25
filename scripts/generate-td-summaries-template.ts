/**
 * Template-Based TD Summary Generator (Zero API Cost)
 * 
 * Generates basic historical summaries using templates and existing data.
 * No AI API calls - completely free alternative for testing or budget constraints.
 * 
 * Quality: Basic but factual
 * Cost: $0.00
 */

import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

interface TDData {
  politician_name: string;
  party: string | null;
  constituency: string;
  overall_elo: number;
  total_stories: number;
  positive_stories: number;
  negative_stories: number;
  questions_asked: number;
  attendance_percentage: number;
  first_elected_date: string | null;
  offices: any[];
  is_minister: boolean;
  ministerial_role: string | null;
  bills_sponsored: number;
}

async function getAllTDs(): Promise<TDData[]> {
  const query = `
    SELECT 
      politician_name,
      party,
      constituency,
      overall_elo,
      total_stories,
      positive_stories,
      negative_stories,
      questions_asked,
      attendance_percentage,
      first_elected_date,
      offices,
      is_minister,
      ministerial_role,
      bills_sponsored
    FROM td_scores
    WHERE is_active = true
    ORDER BY overall_elo DESC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

function getTenureYears(firstElected: string | null): number {
  if (!firstElected) return 0;
  return new Date().getFullYear() - new Date(firstElected).getFullYear();
}

function generateTemplateSummary(td: TDData): string {
  const tenure = getTenureYears(td.first_elected_date);
  const party = td.party || 'Independent';
  const perfScore = td.overall_elo;
  
  // Sentence 1: Role and basic info
  let s1 = '';
  if (td.is_minister && td.ministerial_role) {
    s1 = `Currently serves as ${td.ministerial_role} representing ${td.constituency}.`;
  } else if (td.offices && td.offices.length > 0) {
    s1 = `${party} TD for ${td.constituency} who has held positions including ${td.offices[0]}.`;
  } else {
    s1 = `${party} TD representing ${td.constituency} in Dáil Éireann.`;
  }
  
  // Sentence 2: Experience and activity
  let s2 = '';
  if (tenure >= 15) {
    s2 = `A veteran parliamentarian with ${tenure} years of experience, having asked ${td.questions_asked} parliamentary questions and sponsored ${td.bills_sponsored} bills.`;
  } else if (tenure >= 5) {
    s2 = `An experienced TD with ${tenure} years in the Dáil, actively engaging in parliamentary work with ${td.questions_asked} questions asked.`;
  } else if (tenure >= 2) {
    s2 = `Relatively new to the Dáil with ${tenure} years of service, showing ${td.questions_asked > 100 ? 'strong' : 'moderate'} parliamentary activity.`;
  } else {
    s2 = `Recently elected to the Dáil, already contributing with ${td.questions_asked} parliamentary questions.`;
  }
  
  // Sentence 3: Performance and media
  let s3 = '';
  const newsRatio = td.total_stories > 0 ? td.positive_stories / td.total_stories : 0;
  
  if (perfScore >= 1600) {
    if (td.total_stories > 50) {
      s3 = `Maintains a strong performance record with significant media presence and ${newsRatio > 0.5 ? 'predominantly positive' : 'mixed'} coverage.`;
    } else {
      s3 = `Demonstrates strong parliamentary performance with a high effectiveness rating.`;
    }
  } else if (perfScore >= 1500) {
    if (td.total_stories > 30) {
      s3 = `Shows solid parliamentary work with regular media coverage.`;
    } else {
      s3 = `Maintains consistent parliamentary engagement with moderate public profile.`;
    }
  } else if (perfScore >= 1400) {
    if (td.total_stories > 20) {
      s3 = `Records moderate performance with some media attention.`;
    } else {
      s3 = `Works primarily on constituency matters with less national media focus.`;
    }
  } else {
    if (td.attendance_percentage < 70) {
      s3 = `Shows lower parliamentary engagement with attendance and activity below average.`;
    } else {
      s3 = `Focuses on constituency work with less emphasis on national parliamentary profile.`;
    }
  }
  
  return `${s1} ${s2} ${s3}`;
}

async function updateTDSummary(name: string, summary: string): Promise<void> {
  await pool.query(
    'UPDATE td_scores SET historical_summary = $1 WHERE politician_name = $2',
    [summary, name]
  );
}

async function main() {
  console.log('🔍 Fetching TDs from database...');
  const tds = await getAllTDs();
  
  const tdsNeedingSummaries = tds.filter(td => !td.historical_summary);
  
  console.log(`📊 Found ${tds.length} total TDs`);
  console.log(`✏️  ${tdsNeedingSummaries.length} need summaries`);
  console.log(`💰 Cost: $0.00 (template-based, no AI)`);
  
  if (tdsNeedingSummaries.length === 0) {
    console.log('✅ All TDs already have summaries!');
    await pool.end();
    return;
  }
  
  console.log('\n📝 Generating template-based summaries...\n');
  
  let processed = 0;
  for (const td of tdsNeedingSummaries) {
    const summary = generateTemplateSummary(td);
    await updateTDSummary(td.politician_name, summary);
    processed++;
    
    console.log(`✅ ${td.politician_name}`);
    console.log(`   ${summary.substring(0, 100)}...`);
    
    if (processed % 10 === 0) {
      console.log(`\n   Progress: ${processed}/${tdsNeedingSummaries.length}\n`);
    }
  }
  
  console.log(`\n✅ Complete! Generated ${processed} summaries`);
  console.log(`💰 Total cost: $0.00`);
  console.log(`\n💡 Tip: For higher quality summaries with nuanced critiques, run:`);
  console.log(`   npm run generate-summaries`);
  
  await pool.end();
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { main as generateTemplateBasedSummaries };

