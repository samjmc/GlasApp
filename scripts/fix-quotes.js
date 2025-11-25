/**
 * Script to fix quote escaping issues in politician names
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixQuotesInFile() {
  const filePath = path.join(__dirname, '..', 'shared', 'politicianData.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix specific problematic names
  const fixes = [
    { search: 'name: "Peter "Chap" Cleere"', replace: 'name: "Peter \\"Chap\\" Cleere"' },
    { search: 'name: "Pat "the Cope" Gallagher"', replace: 'name: "Pat \\"the Cope\\" Gallagher"' },
    { search: 'name: "Kevin "Boxer" Moran"', replace: 'name: "Kevin \\"Boxer\\" Moran"' }
  ];
  
  fixes.forEach(fix => {
    content = content.replace(new RegExp(fix.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fix.replace);
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed quote escaping issues in politician names');
}

fixQuotesInFile();