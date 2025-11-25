const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'shared', 'enhanced-quiz-data.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Replace all environmental scores by negating them
const flipped = content.replace(
  /environmental:\s*(-?\d+\.?\d*)/g,
  (match, value) => {
    const numValue = parseFloat(value);
    const flippedValue = -numValue;
    return `environmental: ${flippedValue}`;
  }
);

fs.writeFileSync(filePath, flipped);
console.log('✅ Flipped all environmental scores in enhanced-quiz-data.ts');
console.log('   (Changed scale: +10 = Ecological, -10 = Industrial)');

