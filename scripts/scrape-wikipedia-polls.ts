/**
 * Wikipedia Polling Data Scraper
 * 
 * Scrapes historical Irish polling data from Wikipedia and populates the database.
 * Source: https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_Irish_general_election
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const WIKIPEDIA_URL = 'https://en.wikipedia.org/wiki/Opinion_polling_for_the_next_Irish_general_election';

interface PollData {
  source_name: string;
  poll_date: string;
  publication_date: string;
  sample_size: number;
  methodology?: string;
  party_results: { [key: string]: number };
}

// Party name mapping from Wikipedia to our database
const PARTY_NAME_MAP: { [key: string]: string } = {
  'FF': 'Fianna Fáil',
  'FG': 'Fine Gael',
  'SF': 'Sinn Féin',
  'Lab': 'Labour Party',
  'SD': 'Social Democrats',
  'GP': 'Green Party',
  'PBP–Sol': 'People Before Profit-Solidarity',
  'Aontú': 'Aontú',
  'Ind': 'Independents',
  'Others': 'Others'
};

/**
 * Fetch and parse Wikipedia polling tables
 */
async function scrapeWikipediaPolls(): Promise<PollData[]> {
  console.log('🔍 Fetching Wikipedia polling data...');
  
  try {
    const response = await axios.get(WIKIPEDIA_URL, {
      headers: {
        'User-Agent': 'Glas Politics Polling Scraper (Educational Project)'
      }
    });

    const $ = cheerio.load(response.data);
    const polls: PollData[] = [];

    // Find polling tables (usually marked with class "wikitable")
    $('table.wikitable').each((tableIndex, table) => {
      const $table = $(table);
      
      // Check if this is a polling table by looking for headers
      const headers: string[] = [];
      $table.find('tr').first().find('th').each((i, th) => {
        headers.push($(th).text().trim());
      });

      // Skip if not a polling table
      if (!headers.some(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('poll'))) {
        return;
      }

      console.log(`📊 Processing table ${tableIndex + 1} with headers:`, headers);

      // Process each row
      $table.find('tr').each((rowIndex, row) => {
        if (rowIndex === 0) return; // Skip header row

        const $cells = $(row).find('td');
        if ($cells.length < 3) return; // Skip invalid rows

        try {
          const pollData: PollData = {
            source_name: '',
            poll_date: '',
            publication_date: '',
            sample_size: 0,
            party_results: {}
          };

          // Extract date (usually first column)
          const dateText = $cells.eq(0).text().trim();
          pollData.poll_date = parseDateFromWikipedia(dateText);
          pollData.publication_date = pollData.poll_date; // Default to same

          // Extract polling firm (usually second column)
          pollData.source_name = $cells.eq(1).text().trim();

          // Extract sample size (look for pattern like "n=1,000")
          const sampleText = $cells.eq(2).text().trim();
          const sampleMatch = sampleText.match(/n[=\s]*([0-9,]+)/i);
          if (sampleMatch) {
            pollData.sample_size = parseInt(sampleMatch[1].replace(/,/g, ''));
          } else {
            pollData.sample_size = 1000; // Default assumption
          }

          // Extract party percentages (remaining columns)
          for (let i = 3; i < $cells.length; i++) {
            const cellText = $cells.eq(i).text().trim();
            const percentage = parseFloat(cellText.replace('%', ''));
            
            if (!isNaN(percentage) && headers[i]) {
              const partyName = headers[i].trim();
              pollData.party_results[partyName] = percentage;
            }
          }

          // Only add if we have valid data
          if (pollData.poll_date && pollData.source_name && Object.keys(pollData.party_results).length > 0) {
            polls.push(pollData);
          }
        } catch (error) {
          console.log(`⚠️  Error parsing row ${rowIndex}:`, error);
        }
      });
    });

    console.log(`✅ Successfully scraped ${polls.length} polls from Wikipedia`);
    return polls;
  } catch (error) {
    console.error('❌ Error scraping Wikipedia:', error);
    throw error;
  }
}

/**
 * Parse date strings from Wikipedia (various formats)
 */
function parseDateFromWikipedia(dateStr: string): string {
  // Clean the string
  dateStr = dateStr.replace(/\[.*?\]/g, '').trim(); // Remove citations

  // Handle ranges (take the end date)
  if (dateStr.includes('–') || dateStr.includes('-')) {
    const parts = dateStr.split(/[–-]/);
    dateStr = parts[parts.length - 1].trim();
  }

  try {
    // Format: "21 Oct 2024"
    const months: { [key: string]: string } = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
      'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    };

    const match = dateStr.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i);
    if (match) {
      const day = match[1].padStart(2, '0');
      const monthAbbr = match[2].toLowerCase().substring(0, 3);
      const year = match[3];
      const month = months[monthAbbr] || '01';
      return `${year}-${month}-${day}`;
    }

    // Fallback: try parsing with Date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (error) {
    console.log(`⚠️  Could not parse date: ${dateStr}`);
  }

  // Return current date as fallback
  return new Date().toISOString().split('T')[0];
}

/**
 * Get or create poll source in database
 */
async function getOrCreatePollSource(sourceName: string): Promise<number> {
  // Try to find existing source
  const { data: existing } = await supabase
    .from('poll_sources')
    .select('id')
    .eq('name', sourceName)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new source
  const { data: newSource, error } = await supabase
    .from('poll_sources')
    .insert({
      name: sourceName,
      type: 'pollster',
      reliability_score: 0.80,
      political_bias: 'neutral',
      active: true
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating poll source:', error);
    throw error;
  }

  return newSource.id;
}

/**
 * Get party ID by name
 */
async function getPartyId(partyName: string): Promise<number | null> {
  // Map abbreviated names
  const fullName = PARTY_NAME_MAP[partyName] || partyName;

  const { data } = await supabase
    .from('parties')
    .select('id')
    .ilike('name', fullName)
    .single();

  return data?.id || null;
}

/**
 * Insert poll into database
 */
async function insertPoll(poll: PollData): Promise<void> {
  try {
    // Get or create poll source
    const sourceId = await getOrCreatePollSource(poll.source_name);

    // Insert poll
    const { data: pollRecord, error: pollError } = await supabase
      .from('polls')
      .insert({
        source_id: sourceId,
        poll_date: poll.poll_date,
        publication_date: poll.publication_date,
        sample_size: poll.sample_size,
        methodology: poll.methodology || 'online',
        scope: 'national',
        quality_score: 75, // Default quality score
        verified: true,
        source_url: WIKIPEDIA_URL,
        article_title: 'Wikipedia Opinion Polling',
        notes: 'Imported from Wikipedia'
      })
      .select('id')
      .single();

    if (pollError) {
      console.error('Error inserting poll:', pollError);
      return;
    }

    // Insert party results
    for (const [partyName, percentage] of Object.entries(poll.party_results)) {
      const partyId = await getPartyId(partyName);

      await supabase
        .from('poll_party_results')
        .insert({
          poll_id: pollRecord.id,
          party_id: partyId,
          party_name: PARTY_NAME_MAP[partyName] || partyName,
          first_preference: percentage,
          vote_share: percentage
        });
    }

    console.log(`✅ Inserted poll: ${poll.source_name} - ${poll.poll_date}`);
  } catch (error) {
    console.error(`❌ Error inserting poll from ${poll.source_name}:`, error);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting Wikipedia polling data scraper...\n');

  try {
    // Check for existing polls to avoid duplicates
    const { data: existingPolls } = await supabase
      .from('polls')
      .select('id')
      .eq('source_url', WIKIPEDIA_URL);

    if (existingPolls && existingPolls.length > 0) {
      console.log(`⚠️  Found ${existingPolls.length} existing polls from Wikipedia.`);
      console.log('Delete them first if you want to re-import.');
      
      const response = prompt('Continue anyway? (y/n): ');
      if (response?.toLowerCase() !== 'y') {
        console.log('Aborted.');
        return;
      }
    }

    // Scrape Wikipedia
    const polls = await scrapeWikipediaPolls();

    // Insert into database
    console.log(`\n📥 Importing ${polls.length} polls into database...\n`);
    let successCount = 0;
    let errorCount = 0;

    for (const poll of polls) {
      try {
        await insertPoll(poll);
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total: ${polls.length}`);

    // Calculate some statistics
    const { data: totalPolls } = await supabase
      .from('polls')
      .select('id', { count: 'exact' });

    const { data: partyResults } = await supabase
      .from('poll_party_results')
      .select('party_name, first_preference')
      .order('created_at', { ascending: false })
      .limit(20);

    console.log(`\n📊 Database Statistics:`);
    console.log(`   Total polls in database: ${totalPolls?.length || 0}`);
    console.log(`   Recent party results:`);
    partyResults?.forEach(r => {
      console.log(`     - ${r.party_name}: ${r.first_preference}%`);
    });

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

export { scrapeWikipediaPolls, insertPoll };

// Execute if run directly
main();



