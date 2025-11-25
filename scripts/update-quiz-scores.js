const fs = require('fs');
const path = require('path');

// Read the quiz data file
const filePath = path.join(__dirname, '../shared/enhanced-quiz-data.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Parse questions and answers
const questions = [];
const questionRegex = /id:\s*(\d+)[\s\S]*?text:\s*"([^"]+)"[\s\S]*?answers:\s*\[([\s\S]*?)\]/g;
const answerRegex = /\{[\s\S]*?text:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"[\s\S]*?(economic:\s*(-?\d+))?[\s\S]*?(social:\s*(-?\d+))?[\s\S]*?(cultural:\s*(-?\d+))?[\s\S]*?(globalism:\s*(-?\d+))?[\s\S]*?(environmental:\s*(-?\d+))?[\s\S]*?(authority:\s*(-?\d+))?[\s\S]*?(welfare:\s*(-?\d+))?[\s\S]*?(technocratic:\s*(-?\d+))?[\s\S]*?\}/g;

// Extract all dimension scores from the file
const dimensions = ['economic', 'social', 'cultural', 'globalism', 'environmental', 'authority', 'welfare', 'technocratic'];

// Count relevant questions per dimension
const dimensionQuestionCounts = {};
dimensions.forEach(dim => dimensionQuestionCounts[dim] = 0);

// Find all dimension scores in the file
const allMatches = content.matchAll(/(economic|social|cultural|globalism|environmental|authority|welfare|technocratic):\s*(-?\d+)/g);
const questionDimensionMap = new Map(); // questionId -> Set of dimensions

let currentQuestionId = null;
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect question ID
  const idMatch = line.match(/id:\s*(\d+)/);
  if (idMatch) {
    currentQuestionId = parseInt(idMatch[1]);
    if (!questionDimensionMap.has(currentQuestionId)) {
      questionDimensionMap.set(currentQuestionId, new Set());
    }
  }
  
  // Detect dimension scores
  const dimMatch = line.match(/(economic|social|cultural|globalism|environmental|authority|welfare|technocratic):\s*(-?\d+)/);
  if (dimMatch && currentQuestionId) {
    const dim = dimMatch[1];
    const score = parseInt(dimMatch[2]);
    if (score !== 0) {
      questionDimensionMap.get(currentQuestionId).add(dim);
    }
  }
}

// Count questions per dimension
questionDimensionMap.forEach((dims) => {
  dims.forEach(dim => {
    dimensionQuestionCounts[dim]++;
  });
});

console.log('Questions per dimension:');
console.log(JSON.stringify(dimensionQuestionCounts, null, 2));

// Calculate score values based on question count
function getScoreValues(questionCount) {
  if (questionCount === 4) {
    return { hard: 2.5, moderate: 1.25 };
  } else if (questionCount === 3) {
    return { hard: 3.33, moderate: 1.67 };
  } else if (questionCount === 2) {
    return { hard: 5, moderate: 2.5 };
  } else if (questionCount === 1) {
    return { hard: 10, moderate: 5 };
  } else {
    // For other counts, calculate: hard = 10/N, moderate = 5/N
    return { 
      hard: parseFloat((10 / questionCount).toFixed(2)), 
      moderate: parseFloat((5 / questionCount).toFixed(2)) 
    };
  }
}

// Now update the file
let updatedContent = content;

dimensions.forEach(dim => {
  const questionCount = dimensionQuestionCounts[dim];
  const { hard, moderate } = getScoreValues(questionCount);
  
  console.log(`\n${dim}: ${questionCount} questions, hard=${hard}, moderate=${moderate}`);
  
  // Find all scores for this dimension and replace them
  // We need to determine if a score is "hard" or "moderate" based on its absolute value
  // Hard scores are typically |score| >= 4, moderate are |score| < 4 but != 0
  
  const regex = new RegExp(`(${dim}):\\s*(-?\\d+)`, 'g');
  updatedContent = updatedContent.replace(regex, (match, dimName, scoreStr) => {
    const oldScore = parseInt(scoreStr);
    if (oldScore === 0) {
      return match; // Keep zeros as zeros
    }
    
    // Determine if it's hard or moderate based on absolute value
    // Hard: |score| >= 4, Moderate: 0 < |score| < 4
    const isHard = Math.abs(oldScore) >= 4;
    const newScore = isHard 
      ? (oldScore > 0 ? hard : -hard)
      : (oldScore > 0 ? moderate : -moderate);
    
    return `${dimName}: ${newScore}`;
  });
});

// Write the updated file
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('\n✅ Updated quiz scores in enhanced-quiz-data.ts');

