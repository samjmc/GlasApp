/**
 * Extract and apply all TD photo SQL statements
 */

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read the output file
const output = fs.readFileSync('td-images-output.txt', 'utf-8');

// Extract all SQL UPDATE statements
const sqlStatements = [];
const lines = output.split('\n');
let currentStatement = '';

for (const line of lines) {
  if (line.startsWith('UPDATE td_scores')) {
    if (currentStatement) {
      sqlStatements.push(currentStatement.trim());
    }
    currentStatement = line;
  } else if (currentStatement && line.trim()) {
    currentStatement += ' ' + line.trim();
  } else if (currentStatement && line.includes(';')) {
    currentStatement += ' ' + line.trim();
    sqlStatements.push(currentStatement.trim());
    currentStatement = '';
  }
}

// Supabase credentials - using MCP
console.log(`Found ${sqlStatements.length} SQL statements to execute\n`);

// Save to a single SQL file for MCP execution
const sqlFile = sqlStatements.join('\n\n');
fs.writeFileSync('update-all-td-photos.sql', sqlFile);

console.log('✅ Saved all SQL statements to: update-all-td-photos.sql');
console.log('\nTo apply these to the database, run:');
console.log('Use the MCP Supabase tool to execute the SQL file');

