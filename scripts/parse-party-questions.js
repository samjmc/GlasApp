/**
 * Script to parse questions by party Excel file and generate standardized parliamentary activity scores
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parsePartyQuestions() {
  try {
    // Read the Excel file
    const filePath = path.join(__dirname, '..', 'attached_assets', 'questions_by_party.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log('Raw data structure:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
    
    // Process and merge party data
    const partyQuestions = {};
    
    data.forEach(row => {
      const party = row.party || row.Party || row.PARTY;
      const questions = parseInt(row.total_questions || row.Questions || row.questions || row.QUESTIONS || 0);
      
      if (party && !isNaN(questions)) {
        // Normalize party names and merge PBP variants
        let normalizedParty = party.trim();
        
        // Merge PBP-Solidarity variants
        if (normalizedParty.toLowerCase().includes('people before profit') || 
            normalizedParty.toLowerCase().includes('pbp') ||
            normalizedParty.toLowerCase().includes('solidarity')) {
          normalizedParty = 'People Before Profit-Solidarity';
        }
        
        // Add questions to party total
        if (partyQuestions[normalizedParty]) {
          partyQuestions[normalizedParty] += questions;
        } else {
          partyQuestions[normalizedParty] = questions;
        }
      }
    });
    
    console.log('\nProcessed party questions:');
    console.log(partyQuestions);
    
    // TD counts for each party (as of 2024 election)
    const tdCounts = {
      'Sinn Féin': 39,
      'Fianna Fáil': 48,
      'Fine Gael': 38,
      'Social Democrats': 11,
      'Labour Party': 11,
      'Independent': 17,
      'People Before Profit-Solidarity': 3,
      'Aontú': 2,
      'Independent Ireland': 4,
      'Green Party': 1,
      '100% RDR': 1
    };
    
    // Calculate questions per TD for each party
    const questionsPerTD = {};
    Object.entries(partyQuestions).forEach(([party, questions]) => {
      const tdCount = tdCounts[party] || 1;
      questionsPerTD[party] = questions / tdCount;
    });
    
    // Calculate standardized scores (1-100) based on questions per TD
    const maxQuestionsPerTD = Math.max(...Object.values(questionsPerTD));
    const minQuestionsPerTD = Math.min(...Object.values(questionsPerTD));
    
    const partyScores = {};
    Object.entries(partyQuestions).forEach(([party, questions]) => {
      const tdCount = tdCounts[party] || 1;
      const questionsPerTdValue = questionsPerTD[party];
      
      // Normalize to 1-100 scale based on questions per TD
      const score = Math.round(1 + ((questionsPerTdValue - minQuestionsPerTD) / (maxQuestionsPerTD - minQuestionsPerTD)) * 99);
      
      partyScores[party] = {
        questionsAsked: questions,
        tdCount: tdCount,
        questionsPerTD: Math.round(questionsPerTdValue * 10) / 10, // Round to 1 decimal
        activityScore: score,
        maxQuestionsPerTD: Math.round(maxQuestionsPerTD * 10) / 10,
        minQuestionsPerTD: Math.round(minQuestionsPerTD * 10) / 10
      };
    });
    
    console.log('\nStandardized party activity scores (based on questions per TD):');
    Object.entries(partyScores).forEach(([party, data]) => {
      console.log(`${party}: ${data.questionsAsked} questions / ${data.tdCount} TDs = ${data.questionsPerTD} per TD → ${data.activityScore}/100`);
    });
    
    // Save the processed data
    const outputPath = path.join(__dirname, '..', 'data', 'party-parliamentary-activity.json');
    fs.writeFileSync(outputPath, JSON.stringify(partyScores, null, 2));
    
    console.log(`\nSaved party activity scores to: ${outputPath}`);
    
    return partyScores;
    
  } catch (error) {
    console.error('Error parsing party questions:', error);
    return null;
  }
}

// Run the script
parsePartyQuestions();

export { parsePartyQuestions };