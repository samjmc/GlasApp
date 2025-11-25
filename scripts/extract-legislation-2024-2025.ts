/**
 * Extract Legislation 2020-2025
 * (Bills span multiple years, so we fetch broader range)
 */

import 'dotenv/config';
import { supabaseDb as supabase } from '../server/db.js';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

async function extractLegislation() {
  console.log('📜 EXTRACTING 2020-2025 LEGISLATION\n');

  if (!supabase) {
    console.error('❌ Supabase not initialized');
    process.exit(1);
  }

  // Load TDs
  const { data: tds } = await supabase
    .from('td_scores')
    .select('id, politician_name, member_code, member_uri');

  console.log(`✅ Loaded ${tds?.length} TDs`);

  const tdLookup = new Map<string, any>();
  tds?.forEach(td => {
    if (td.member_code) {
      tdLookup.set(`/ie/oireachtas/member/id/${td.member_code}`, td);
      tdLookup.set(`https://data.oireachtas.ie/ie/oireachtas/member/id/${td.member_code}`, td);
    }
  });

  console.log(`✅ Created lookup\n`);

  // Fetch legislation
  console.log('📥 Fetching bills...');
  const allBills: any[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const response = await apiClient.get('/legislation', {
      params: {
        date_start: '2020-01-01',
        limit,
        skip
      }
    });

    const results = response.data.results || [];
    if (results.length === 0) break;

    allBills.push(...results);
    console.log(`   Fetched ${allBills.length} bills`);

    if (results.length < limit) break;
    skip += limit;
    if (skip > 2000) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Total bills: ${allBills.length}\n`);

  // Process sponsorships
  console.log('🔗 Extracting sponsorships...');
  const legislationToInsert: any[] = [];

  for (const result of allBills) {
    const bill = result.bill;
    
    const sponsors = Array.isArray(bill.sponsors?.sponsor) 
      ? bill.sponsors.sponsor 
      : bill.sponsors?.sponsor 
      ? [bill.sponsors.sponsor] 
      : [];

    for (const sponsor of sponsors) {
      const sponsorUri = sponsor.by?.uri || sponsor.uri;
      if (!sponsorUri) continue;

      const td = tdLookup.get(sponsorUri);
      if (!td) continue;

      legislationToInsert.push({
        td_id: td.id,
        bill_id: `${bill.billNo}-${bill.billYear}`,
        bill_uri: bill.uri || '',
        bill_no: bill.billNo || null,
        bill_year: parseInt(bill.billYear) || null,
        bill_title: (bill.longTitleEn || '').substring(0, 1000),
        bill_short_title: (bill.shortTitleEn || '').substring(0, 500),
        bill_type: bill.source === 'Government' ? 'Government' : 'Private Member',
        bill_status: bill.status || 'Unknown',
        sponsor_type: sponsor.sponsorType || 'sponsor',
        date_introduced: bill.introducedDate || null,
        date_last_updated: bill.lastUpdated || null,
        stages: bill.stages || {},
        acts: bill.act ? [bill.act] : []
      });
    }

    if (legislationToInsert.length % 50 === 0 && legislationToInsert.length > 0) {
      console.log(`   Progress: ${legislationToInsert.length} sponsorships`);
    }
  }

  console.log(`\n✅ Matched ${legislationToInsert.length} bill sponsorships\n`);

  // Batch insert
  if (legislationToInsert.length > 0) {
    console.log('💾 Inserting legislation...');
    
    const { error } = await supabase
      .from('td_legislation')
      .upsert(legislationToInsert, { onConflict: 'bill_id' });

    if (!error) {
      console.log(`✅ Inserted ${legislationToInsert.length} sponsorships!`);
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n✅ Legislation extraction complete!\n');
}

extractLegislation().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

