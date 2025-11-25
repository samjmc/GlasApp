/**
 * Generate Historical Summaries for TDs
 * 
 * This script generates 2-3 sentence historical critiques for each TD
 * using existing data (news sentiment, performance metrics, tenure) to minimize API costs.
 * 
 * Cost-saving strategies:
 * - Uses Anthropic Claude Haiku (cheapest model) for generation
 * - Batches multiple TDs per request when possible
 * - Uses existing database data as context
 * - Generates concise summaries (2-3 sentences max)
 */

import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// Database connection
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
  historical_summary: string | null;
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
      historical_summary
    FROM td_scores
    WHERE is_active = true
    ORDER BY overall_elo DESC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

function calculateSentimentRatio(td: TDData): string {
  if (td.total_stories === 0) return 'limited news coverage';
  
  const positiveRatio = td.positive_stories / td.total_stories;
  const negativeRatio = td.negative_stories / td.total_stories;
  
  if (positiveRatio > 0.6) return 'predominantly positive news coverage';
  if (negativeRatio > 0.5) return 'significant negative press coverage';
  if (positiveRatio > 0.4) return 'mixed-to-positive news coverage';
  return 'mixed news coverage';
}

function getPerformanceLevel(elo: number): string {
  if (elo >= 1700) return 'exceptional';
  if (elo >= 1600) return 'very strong';
  if (elo >= 1500) return 'solid';
  if (elo >= 1400) return 'moderate';
  return 'below average';
}

function getTenure(firstElected: string | null): string {
  if (!firstElected) return 'recently elected';
  
  const years = new Date().getFullYear() - new Date(firstElected).getFullYear();
  if (years < 2) return 'newly elected';
  if (years < 5) return 'relatively new';
  if (years < 10) return 'experienced';
  if (years < 20) return 'veteran';
  return 'long-serving';
}

async function generateSummaryBatch(tds: TDData[]): Promise<Map<string, string>> {
  // Create a structured prompt for batch generation
  const tdContexts = tds.map(td => {
    const tenure = getTenure(td.first_elected_date);
    const performance = getPerformanceLevel(td.overall_elo);
    const sentiment = calculateSentimentRatio(td);
    const role = td.is_minister ? `Minister (${td.ministerial_role})` : 'TD';
    const offices = td.offices && td.offices.length > 0 ? `Has held: ${td.offices.join(', ')}` : '';
    
    return {
      name: td.politician_name,
      party: td.party || 'Independent',
      constituency: td.constituency,
      context: `${role} for ${td.constituency} (${td.party || 'Independent'}). ${tenure.charAt(0).toUpperCase() + tenure.slice(1)} politician with ${performance} performance record (score: ${td.overall_elo}). Has ${sentiment}. Asked ${td.questions_asked} parliamentary questions. ${offices}`.trim()
    };
  });

  const prompt = `You are writing brief, balanced historical critiques for Irish TDs (Members of Parliament). For each TD listed below, write exactly 2-3 sentences that:

1. Summarize their political career and record (good or bad)
2. Mention specific achievements, controversies, or notable positions
3. Provide an honest assessment without being overly positive or negative

Write in a neutral, journalistic tone. Be factual and balanced.

${tdContexts.map((td, i) => `${i + 1}. ${td.name} (${td.party}, ${td.constituency})
Context: ${td.context}`).join('\n\n')}

Format your response as a JSON object with politician names as keys and summaries as values:
{
  "Politician Name": "2-3 sentence summary here",
  ...
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Cheapest model
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const summaries = JSON.parse(jsonMatch[0]);
      return new Map(Object.entries(summaries));
    }
    
    console.error('Failed to parse JSON response');
    return new Map();
  } catch (error) {
    console.error('Error generating summaries:', error);
    return new Map();
  }
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
  
  // Filter out TDs that already have summaries (unless you want to regenerate)
  const tdsNeedingSummaries = tds.filter(td => !td.historical_summary);
  
  console.log(`📊 Found ${tds.length} total TDs`);
  console.log(`✏️  ${tdsNeedingSummaries.length} need summaries`);
  
  if (tdsNeedingSummaries.length === 0) {
    console.log('✅ All TDs already have summaries!');
    await pool.end();
    return;
  }
  
  // Process in batches of 5 to keep prompts manageable
  const BATCH_SIZE = 5;
  let processed = 0;
  
  for (let i = 0; i < tdsNeedingSummaries.length; i += BATCH_SIZE) {
    const batch = tdsNeedingSummaries.slice(i, i + BATCH_SIZE);
    console.log(`\n📝 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tdsNeedingSummaries.length / BATCH_SIZE)}...`);
    console.log(`   TDs: ${batch.map(td => td.politician_name).join(', ')}`);
    
    const summaries = await generateSummaryBatch(batch);
    
    // Update database
    for (const [name, summary] of summaries.entries()) {
      if (summary) {
        await updateTDSummary(name, summary);
        processed++;
        console.log(`   ✅ ${name}: ${summary.substring(0, 60)}...`);
      }
    }
    
    // Small delay between batches to be respectful of API
    if (i + BATCH_SIZE < tdsNeedingSummaries.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`\n✅ Complete! Updated ${processed} TD summaries`);
  console.log(`💰 Estimated cost: ~$${(Math.ceil(tdsNeedingSummaries.length / BATCH_SIZE) * 0.01).toFixed(2)} USD (using Claude Haiku)`);
  
  await pool.end();
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { main as generateTDHistoricalSummaries };

