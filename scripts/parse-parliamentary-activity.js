/**
 * Parse parliamentary activity data from Excel file
 * Extract attendance records and questions asked data
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseParliamentaryData() {
  try {
    // Read the Excel file
    const filePath = path.join(__dirname, '..', 'attached_assets', 'questions_by_deputy.xlsx');
    const workbook = XLSX.readFile(filePath);
    
    console.log('Excel file loaded successfully');
    console.log('Sheet names:', workbook.SheetNames);
    
    // Process each sheet
    const allData = {};
    
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\nProcessing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      console.log(`Rows in ${sheetName}: ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        console.log('First few rows:');
        jsonData.slice(0, 5).forEach((row, index) => {
          console.log(`Row ${index}:`, row);
        });
      }
      
      allData[sheetName] = jsonData;
    });
    
    // Try to extract parliamentary activity data
    const activityData = extractParliamentaryActivity(allData);
    
    // Save processed data
    const outputPath = path.join(__dirname, '..', 'data', 'parliamentary-activity.json');
    fs.writeFileSync(outputPath, JSON.stringify(activityData, null, 2));
    
    console.log(`\nProcessed data saved to: ${outputPath}`);
    console.log(`Total TDs with activity data: ${Object.keys(activityData).length}`);
    
    return activityData;
    
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

function extractParliamentaryActivity(sheetsData) {
  const activityData = {};
  
  // Process each sheet to extract TD activity data
  Object.entries(sheetsData).forEach(([sheetName, data]) => {
    console.log(`\nExtracting data from sheet: ${sheetName}`);
    
    if (data.length === 0) return;
    
    // Look for headers to identify data structure
    const headers = data[0];
    console.log('Headers:', headers);
    
    // Skip header row and process data
    data.slice(1).forEach((row, index) => {
      if (row.length === 0) return;
      
      // Try to extract TD name, attendance, and questions data
      const tdData = extractTDData(row, headers);
      if (tdData && tdData.name) {
        // Normalize TD name for matching
        const normalizedName = normalizeTDName(tdData.name);
        
        activityData[normalizedName] = {
          fullName: tdData.name,
          surname: tdData.surname,
          questionsAsked: tdData.questionsAsked,
          memberId: tdData.memberId,
          party: tdData.party,
          dailAttendance: tdData.dailAttendance,
          otherAttendance: tdData.otherAttendance,
          attendancePercentage: tdData.attendancePercentage,
          totalPossibleDays: 29,
          sheet: sheetName
        };
      }
    });
  });
  
  return activityData;
}

function extractTDData(row, headers) {
  if (!row || row.length === 0) return null;
  
  const data = {};
  
  // Map based on known header structure
  // Headers: ['sort', 'name', 'questions_asked', 'member_id', 'party', 'Dail Attendance', 'Other Attendance']
  
  if (row.length < 7) return null;
  
  // Extract data based on column positions
  data.surname = row[0] || '';
  data.name = row[1] || '';
  data.questionsAsked = row[2] || 0;
  data.memberId = row[3] || '';
  data.party = row[4] || '';
  data.dailAttendance = row[5] || 0;
  data.otherAttendance = row[6] || 0;
  
  // Calculate attendance percentage
  data.attendancePercentage = data.dailAttendance ? Math.round((data.dailAttendance / 29) * 100) : 0;
  
  // Skip if no valid name
  if (!data.name || data.name.length < 2) {
    return null;
  }
  
  return data;
}

function normalizeTDName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .replace(/[áàâäã]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôöõ]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    .replace(/['']/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Run the parser
parseParliamentaryData();