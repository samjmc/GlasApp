/**
 * Script to calculate party attendance rates and combine with questions per TD
 * Using 60% attendance, 40% questions per TD weighting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function calculatePartyAttendanceAndActivity() {
  try {
    // Load individual TD parliamentary activity data
    const activityDataPath = path.join(__dirname, '..', 'data', 'parliamentary-activity.json');
    const rawActivityData = fs.readFileSync(activityDataPath, 'utf8');
    const tdActivityData = JSON.parse(rawActivityData);
    
    // Load existing party questions data
    const partyQuestionsPath = path.join(__dirname, '..', 'data', 'party-parliamentary-activity.json');
    const rawPartyData = fs.readFileSync(partyQuestionsPath, 'utf8');
    const partyQuestionsData = JSON.parse(rawPartyData);
    
    console.log('Calculating party attendance rates from individual TD data...');
    
    // Party mapping for TD data
    const partyMapping = {
      'Sinn Féin': 'Sinn Féin',
      'Fianna Fáil': 'Fianna Fáil', 
      'Fine Gael': 'Fine Gael',
      'Social Democrats': 'Social Democrats',
      'Labour Party': 'Labour Party',
      'People Before Profit-Solidarity': 'People Before Profit-Solidarity',
      'People Before Profit': 'People Before Profit-Solidarity',
      'Solidarity': 'People Before Profit-Solidarity',
      'Aontú': 'Aontú',
      'Independent Ireland': 'Independent Ireland',
      'Green Party': 'Green Party',
      'Independent': 'Independent'
    };
    
    // Calculate party attendance averages
    const partyAttendance = {};
    const partyTDCounts = {};
    
    Object.entries(tdActivityData).forEach(([tdName, data]) => {
      const partyName = data.party;
      const normalizedParty = partyMapping[partyName] || partyName;
      const attendancePercentage = data.attendancePercentage;
      
      if (attendancePercentage !== null && !isNaN(attendancePercentage)) {
        if (!partyAttendance[normalizedParty]) {
          partyAttendance[normalizedParty] = [];
        }
        partyAttendance[normalizedParty].push(attendancePercentage);
      }
    });
    
    // Calculate average attendance per party
    const partyAttendanceAverages = {};
    Object.entries(partyAttendance).forEach(([party, attendanceRates]) => {
      const avgAttendance = attendanceRates.reduce((sum, rate) => sum + rate, 0) / attendanceRates.length;
      partyAttendanceAverages[party] = {
        averageAttendance: Math.round(avgAttendance * 10) / 10,
        tdCount: attendanceRates.length
      };
    });
    
    console.log('\nParty attendance averages:');
    Object.entries(partyAttendanceAverages).forEach(([party, data]) => {
      console.log(`${party}: ${data.averageAttendance}% (${data.tdCount} TDs)`);
    });
    
    // Combine attendance and questions data with 60/40 weighting
    const combinedPartyScores = {};
    
    Object.entries(partyQuestionsData).forEach(([party, questionsData]) => {
      const attendanceData = partyAttendanceAverages[party];
      
      if (attendanceData) {
        // Normalize attendance (0-100) and questions per TD scores
        const maxAttendance = 100; // Maximum possible attendance
        const minAttendance = 0;   // Minimum possible attendance
        
        const maxQuestionsPerTD = 359.5; // From existing data
        const minQuestionsPerTD = 70;    // From existing data
        
        // Normalize attendance score (0-100)
        const attendanceScore = (attendanceData.averageAttendance - minAttendance) / (maxAttendance - minAttendance) * 100;
        
        // Normalize questions per TD score (0-100)
        const questionsScore = (questionsData.questionsPerTD - minQuestionsPerTD) / (maxQuestionsPerTD - minQuestionsPerTD) * 100;
        
        // Apply 60/40 weighting (60% attendance, 40% questions)
        const combinedScore = Math.round((attendanceScore * 0.6) + (questionsScore * 0.4));
        
        combinedPartyScores[party] = {
          ...questionsData,
          averageAttendance: attendanceData.averageAttendance,
          attendanceScore: Math.round(attendanceScore),
          questionsScore: Math.round(questionsScore),
          combinedActivityScore: combinedScore,
          weighting: '60% attendance, 40% questions per TD'
        };
      } else {
        // Keep original data if no attendance data available
        combinedPartyScores[party] = {
          ...questionsData,
          averageAttendance: null,
          attendanceScore: null,
          questionsScore: questionsData.activityScore,
          combinedActivityScore: questionsData.activityScore,
          weighting: 'Questions per TD only (no attendance data)'
        };
      }
    });
    
    console.log('\nCombined party scores (60% attendance, 40% questions per TD):');
    Object.entries(combinedPartyScores).forEach(([party, data]) => {
      if (data.averageAttendance !== null) {
        console.log(`${party}: ${data.combinedActivityScore}/100 (${data.averageAttendance}% attendance, ${data.questionsPerTD} q/TD)`);
      } else {
        console.log(`${party}: ${data.combinedActivityScore}/100 (questions only)`);
      }
    });
    
    // Save combined data
    const outputPath = path.join(__dirname, '..', 'data', 'party-parliamentary-activity.json');
    fs.writeFileSync(outputPath, JSON.stringify(combinedPartyScores, null, 2));
    
    console.log(`\nSaved combined party activity scores to: ${outputPath}`);
    
    return combinedPartyScores;
    
  } catch (error) {
    console.error('Error calculating party attendance and activity:', error);
    return null;
  }
}

// Run the script
calculatePartyAttendanceAndActivity();

export { calculatePartyAttendanceAndActivity };