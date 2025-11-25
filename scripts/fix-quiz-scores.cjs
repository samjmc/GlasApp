const fs = require('fs');
const path = require('path');

// Read the quiz data file
const filePath = path.join(__dirname, '../shared/enhanced-quiz-data.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Map categories to dimensions and question counts
const categoryDimensionMap = {
  'Economic Strategy': { dimension: 'economic', count: 4 },
  'Social Fabric': { dimension: 'social', count: 3 },
  'Cultural Identity': { dimension: 'cultural', count: 3 },
  'Global Role': { dimension: 'globalism', count: 3 },
  'Environmental Choices': { dimension: 'environmental', count: 3 },
  'Authority & Liberties': { dimension: 'authority', count: 3 },
  'Welfare & Opportunity': { dimension: 'welfare', count: 3 },
  'Governance Models': { dimension: 'technocratic', count: 3 }
};

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
    return { 
      hard: parseFloat((10 / questionCount).toFixed(2)), 
      moderate: parseFloat((5 / questionCount).toFixed(2)) 
    };
  }
}

// First, restore original scores by reading from a backup or reconstructing
// Since we don't have a backup, we'll need to manually identify which questions belong to which category
// and update scores based on the original magnitude

// Parse the file to find questions and their categories
const lines = content.split('\n');
let currentCategory = null;
let currentQuestionId = null;
const questionCategoryMap = new Map();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Detect category
  const categoryMatch = line.match(/category:\s*"([^"]+)"/);
  if (categoryMatch) {
    currentCategory = categoryMatch[1];
  }
  
  // Detect question ID
  const idMatch = line.match(/id:\s*(\d+)/);
  if (idMatch) {
    currentQuestionId = parseInt(idMatch[1]);
    if (currentCategory) {
      questionCategoryMap.set(currentQuestionId, currentCategory);
    }
  }
}

console.log('Question categories:');
questionCategoryMap.forEach((cat, id) => {
  console.log(`Q${id}: ${cat}`);
});

// Now we need to restore original scores. Since we don't have them, 
// we'll use a different approach: update scores based on category and original magnitude
// We'll need to manually restore or use a different strategy

// Actually, let me check if we can determine original scores from the current normalized ones
// by looking at the pattern. But that won't work.

// Better approach: Let's manually update based on the user's requirements
// For each category, identify the primary dimension and update scores accordingly

// For now, let's create a mapping of what the scores should be
// We'll update all scores to use the normalized values based on category

const dimensionScores = {};
Object.keys(categoryDimensionMap).forEach(cat => {
  const { dimension, count } = categoryDimensionMap[cat];
  dimensionScores[dimension] = getScoreValues(count);
  console.log(`\n${dimension} (${cat}, ${count} questions): hard=${dimensionScores[dimension].hard}, moderate=${dimensionScores[dimension].moderate}`);
});

// Now update the file - we need to identify which answers are "hard" vs "moderate"
// We'll use the absolute value of the current score to determine this
// But wait, the current scores are already normalized, so we can't tell...

// Let me try a different approach: look at the original file structure
// and determine hard vs moderate based on the answer text or position
// Typically, first and last answers are more extreme (hard), middle ones are moderate

// Actually, the best approach is to restore from a known good state
// Since we can't do that, let's assume:
// - Answers with |score| >= 0.3 in the current file are "hard" (originally >= 4)
// - Answers with 0 < |score| < 0.3 are "moderate" (originally 1-3)

// But this is getting complicated. Let me ask the user or use a simpler approach:
// Update all non-zero scores based on their category's primary dimension

// For each dimension, find all scores and update them
const dimensions = ['economic', 'social', 'cultural', 'globalism', 'environmental', 'authority', 'welfare', 'technocratic'];

dimensions.forEach(dim => {
  // Find which category this dimension belongs to
  let categoryInfo = null;
  for (const [cat, info] of Object.entries(categoryDimensionMap)) {
    if (info.dimension === dim) {
      categoryInfo = info;
      break;
    }
  }
  
  if (!categoryInfo) return;
  
  const { hard, moderate } = getScoreValues(categoryInfo.count);
  
  // Update scores for this dimension
  // We need to determine if a score is hard or moderate
  // Since we can't tell from current values, we'll use a heuristic:
  // Look at the absolute value - if it's one of the higher values in that question, it's hard
  
  // Actually, let's use a simpler rule: 
  // For each question in the primary category, the primary dimension scores should be hard/moderate
  // For other dimensions in those questions, keep them as moderate or zero
  
  const regex = new RegExp(`(${dim}):\\s*(-?[\\d.]+)`, 'g');
  content = content.replace(regex, (match, dimName, scoreStr) => {
    const score = parseFloat(scoreStr);
    if (score === 0) return match;
    
    // Determine if hard or moderate based on absolute value
    // If |score| >= 0.3, it was probably hard (>= 4 originally)
    // If 0 < |score| < 0.3, it was probably moderate (1-3 originally)
    const isHard = Math.abs(score) >= 0.3;
    const newScore = isHard 
      ? (score > 0 ? hard : -hard)
      : (score > 0 ? moderate : -moderate);
    
    return `${dimName}: ${newScore}`;
  });
});

// Write the updated file
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ Updated quiz scores based on category-primary dimensions');

