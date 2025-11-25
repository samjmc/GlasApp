/**
 * Bulk Legislation Extraction
 * WORKAROUND for broken member_id filtering
 * Fetches ALL bills and legislation, then matches sponsors to TDs client-side
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000,
  headers: {
    'User-Agent': 'GlasPolitics/1.0',
    'Accept': 'application/json'
  }
});

// Create legislation table
const CREATE_LEGISLATION_TABLE = `
CREATE TABLE IF NOT EXISTS td_legislation (
  id SERIAL PRIMARY KEY,
  td_id INTEGER REFERENCES td_scores(id) ON DELETE CASCADE,
  bill_id TEXT NOT NULL,
  bill_uri TEXT,
  bill_no TEXT,
  bill_year INTEGER,
  bill_title TEXT,
  bill_short_title TEXT,
  bill_type TEXT CHECK (bill_type IN ('Government', 'Private Member')),
  bill_status TEXT,
  sponsor_type TEXT CHECK (sponsor_type IN ('sponsor', 'co-sponsor')),
  date_introduced DATE,
  date_last_updated DATE,
  stages JSONB DEFAULT '[]'::jsonb,
  acts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(td_id, bill_id)
);

CREATE INDEX IF NOT EXISTS idx_td_legislation_td_id ON td_legislation(td_id);
CREATE INDEX IF NOT EXISTS idx_td_legislation_status ON td_legislation(bill_status);
CREATE INDEX IF NOT EXISTS idx_td_legislation_type ON td_legislation(bill_type);
CREATE INDEX IF NOT EXISTS idx_td_legislation_year ON td_legislation(bill_year);
`;

async function bulkExtractLegislation() {
  console.log('📜 BULK LEGISLATION EXTRACTION');
  console.log('═'.repeat(70));
  console.log('WORKAROUND: Fetching ALL bills, filtering client-side');
  console.log('Extracting bill sponsorship and legislative activity\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Create table
  console.log('📋 Creating td_legislation table...');
  try {
    await supabase.rpc('exec_sql', { sql: CREATE_LEGISLATION_TABLE });
    console.log('✅ Table ready\n');
  } catch (error) {
    console.log('   (Table may already exist - continuing...)\n');
  }

  // Step 1: Get all TDs
  console.log('📊 Step 1: Loading TDs from database...');
  const { data: tds, error: tdError } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  if (tdError || !tds) {
    console.error('❌ Failed to load TDs:', tdError);
    return;
  }

  console.log(`✅ Loaded ${tds.length} TDs\n`);

  const tdLookup = new Map<string, any>();
  tds.forEach(td => {
    if (td.member_uri) tdLookup.set(td.member_uri, td);
    if (td.member_code) {
      // Store multiple variations to handle API inconsistencies
      tdLookup.set(`/ie/oireachtas/member/${td.member_code}`, td);
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td); // API format
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td); // Full URL
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/${td.member_code}`, td); // Alt format
    }
  });

  // Step 2: Fetch ALL legislation
  console.log('📜 Step 2: Fetching ALL legislation from Oireachtas API...');
  console.log('Fetching from 2020 onwards (34th Dáil term)...\n');

  const allBills: any[] = [];
  const dateFrom = '2020-01-01'; // Entire 34th Dáil term
  let skip = 0;
  const limit = 100;
  let totalFetched = 0;

  while (true) {
    console.log(`   Fetching batch ${Math.floor(skip / limit) + 1} (skip: ${skip})...`);

    try {
      const response = await apiClient.get('/legislation', {
        params: {
          date_start: dateFrom,
          limit,
          skip
        }
      });

      const results = response.data.results || [];
      
      if (results.length === 0) {
        console.log('   ✅ No more bills to fetch\n');
        break;
      }

      allBills.push(...results);
      totalFetched += results.length;
      console.log(`   ✅ Fetched ${results.length} bills (Total: ${totalFetched})`);

      if (results.length < limit) break;

      skip += limit;

      if (skip > 2000) {
        console.log('   ⚠️  Reached safety limit');
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      break;
    }
  }

  console.log(`\n✅ Total bills fetched: ${allBills.length}`);

  // Step 3: Extract sponsorship data
  console.log('\n📥 Step 3: Extracting bill sponsorships...');
  console.log('─'.repeat(70));

  let matched = 0;
  let unmatched = 0;
  const billsToInsert: any[] = [];

  for (const result of allBills) {
    const bill = result.bill;
    
    // Extract sponsors (already an array of {sponsor: {...}} objects)
    const sponsorsArray = bill.sponsors || [];

    for (const sponsorWrapper of sponsorsArray) {
      const sponsor = sponsorWrapper.sponsor;
      const sponsorUri = sponsor?.by?.uri;
      if (!sponsorUri) continue;

      const td = tdLookup.get(sponsorUri);
      if (!td) {
        unmatched++;
        continue;
      }

      matched++;

      // Extract bill data
      const billData = {
        td_id: td.id,
        bill_id: bill.billNo + '-' + bill.billYear || bill.uri?.split('/').pop() || `bill-${Date.now()}`,
        bill_uri: bill.uri || '',
        bill_no: bill.billNo || null,
        bill_year: parseInt(bill.billYear) || null,
        bill_title: (bill.longTitleEn || '').substring(0, 1000),
        bill_short_title: (bill.shortTitleEn || '').substring(0, 500),
        bill_type: bill.source === 'Government' ? 'Government' : 'Private Member',
        bill_status: bill.status || 'Unknown',
        sponsor_type: sponsor.isPrimary ? 'sponsor' : 'co-sponsor',
        date_introduced: bill.introducedDate || null,
        date_last_updated: bill.lastUpdated || null,
        stages: bill.stages || {},
        acts: bill.act ? [bill.act] : []
      };

      billsToInsert.push(billData);
    }

    if ((matched + unmatched) % 100 === 0) {
      console.log(`   Progress: ${matched} matched, ${unmatched} unmatched`);
    }
  }

  console.log(`\n✅ Extracted ${billsToInsert.length} bill sponsorships`);
  console.log('💾 Inserting into database (batch mode)...\n');

  // Delete existing records first
  await supabase.from('td_legislation').delete().gte('id', 0);

  // Batch insert
  let inserted = 0;
  let errors = 0;
  const batchSize = 500;

  for (let i = 0; i < billsToInsert.length; i += batchSize) {
    const batch = billsToInsert.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase
        .from('td_legislation')
        .insert(batch);

      if (!error) {
        inserted += batch.length;
        console.log(`   ✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} bills (Total: ${inserted})`);
      } else {
        errors += batch.length;
        console.error(`   ❌ Batch error: ${error.message}`);
      }
    } catch (error: any) {
      errors += batch.length;
      console.error(`   ❌ Batch error: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 EXTRACTION COMPLETE');
  console.log('═'.repeat(70));
  console.log(`Bills processed:          ${allBills.length.toLocaleString()}`);
  console.log(`Sponsorships matched:     ${matched.toLocaleString()}`);
  console.log(`Unmatched:                ${unmatched.toLocaleString()}`);
  console.log(`Successfully inserted:    ${inserted.toLocaleString()}`);
  console.log(`Errors:                   ${errors.toLocaleString()}`);
  console.log('═'.repeat(70));

  // Statistics
  const { data: stats } = await supabase.from('td_legislation').select('*');

  if (stats) {
    const privateMember = stats.filter((b: any) => b.bill_type === 'Private Member').length;
    const government = stats.filter((b: any) => b.bill_type === 'Government').length;
    const enacted = stats.filter((b: any) => b.bill_status === 'Enacted').length;
    const current = stats.filter((b: any) => b.bill_status === 'Current').length;

    console.log('\n📈 LEGISLATION STATISTICS:');
    console.log(`   Total bills in DB:        ${stats.length.toLocaleString()}`);
    console.log(`   Private Member Bills:     ${privateMember.toLocaleString()}`);
    console.log(`   Government Bills:         ${government.toLocaleString()}`);
    console.log(`   Enacted:                  ${enacted.toLocaleString()}`);
    console.log(`   Current (in progress):    ${current.toLocaleString()}`);

    // TDs with most bills
    const tdBillCounts = new Map<number, number>();
    stats.forEach((b: any) => {
      tdBillCounts.set(b.td_id, (tdBillCounts.get(b.td_id) || 0) + 1);
    });

    console.log('\n🏆 TOP BILL SPONSORS:');
    const sortedSponsors = Array.from(tdBillCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    for (const [tdId, count] of sortedSponsors) {
      const td = tds.find(t => t.id === tdId);
      if (td) {
        console.log(`   ${td.politician_name.padEnd(30)} ${count.toString().padStart(3)} bills`);
      }
    }
  }

  console.log('\n✅ Bulk legislation extraction complete!\n');
}

bulkExtractLegislation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

