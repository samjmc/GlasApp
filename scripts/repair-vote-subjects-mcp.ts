/**
 * Repair Vote Subjects via MCP
 * Fetches ALL unique corrupted URIs, gets subjects from API, outputs SQL
 */

import axios from 'axios';
import * as fs from 'fs';

const apiClient = axios.create({
  baseURL: 'https://api.oireachtas.ie/v1',
  timeout: 30000
});

// These are the 384 unique URIs from corrupted votes (fetched via MCP)
// We'll fetch them from a file or hardcode them

async function fetchDivisionSubject(divisionUri: string): Promise<string | null> {
  try {
    const response = await apiClient.get('/divisions', {
      params: { division_id: divisionUri, limit: 1 }
    });
    const result = response.data.results?.[0]?.division;
    return result?.subject?.showAs || result?.showAs || null;
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('🔧 GENERATING SQL UPDATE STATEMENTS');
  console.log('Will output to: vote_repairs.sql\n');

  // Read URIs from stdin or file
  const urisRaw = fs.readFileSync('corrupted_uris.txt', 'utf-8');
  const uris = urisRaw.split('\n').filter(u => u.trim().length > 0);
  
  console.log(`Found ${uris.length} URIs to process.\n`);

  const sqlStatements: string[] = [];
  let processed = 0;
  let failed = 0;

  for (const uri of uris) {
    const subject = await fetchDivisionSubject(uri.trim());
    processed++;
    
    if (subject) {
      const escapedSubject = subject.replace(/'/g, "''");
      sqlStatements.push(`UPDATE td_votes SET vote_subject = '${escapedSubject}' WHERE vote_uri = '${uri.trim()}';`);
      console.log(`[${processed}/${uris.length}] ✅ ${uri.substring(uri.length - 30)}`);
    } else {
      failed++;
      console.log(`[${processed}/${uris.length}] ❌ ${uri.substring(uri.length - 30)}`);
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 50));
  }

  // Write SQL file
  fs.writeFileSync('vote_repairs.sql', sqlStatements.join('\n'));
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Generated ${sqlStatements.length} UPDATE statements`);
  console.log(`❌ Failed: ${failed}`);
  console.log('Output: vote_repairs.sql');
  console.log('═'.repeat(50));
}

main().catch(console.error);


