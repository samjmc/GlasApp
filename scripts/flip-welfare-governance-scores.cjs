const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'shared', 'enhanced-quiz-data.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Flip welfare scores (negate them)
let flipped = content.replace(
  /welfare:\s*(-?\d+\.?\d*)/g,
  (match, value) => {
    const numValue = parseFloat(value);
    const flippedValue = -numValue;
    return `welfare: ${flippedValue}`;
  }
);

// Flip technocratic scores (negate them)
flipped = flipped.replace(
  /technocratic:\s*(-?\d+\.?\d*)/g,
  (match, value) => {
    const numValue = parseFloat(value);
    const flippedValue = -numValue;
    return `technocratic: ${flippedValue}`;
  }
);

fs.writeFileSync(filePath, flipped);
console.log('✅ Flipped all welfare and technocratic scores in enhanced-quiz-data.ts');
console.log('   Welfare: +10 = Communitarian, -10 = Individual');
console.log('   Governance: +10 = Technocratic, -10 = Populist');

