import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name properly in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the constituencies data
const filePath = path.join(__dirname, '../data/constituencies.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Update the parties data for all constituencies
data.forEach(constituency => {
  // Check if Aontú is already in the constituency
  const hasAontu = constituency.parties.some(party => party.name === 'Aontú');
  
  // Check if People Before Profit is already in the constituency
  const hasPBP = constituency.parties.some(party => party.name === 'People Before Profit');
  
  // Calculate the sum of current percentages
  const currentSum = constituency.parties.reduce((sum, party) => sum + party.percent, 0);
  
  // Adjust Independents percentage if needed
  const independentsIndex = constituency.parties.findIndex(party => party.name === 'Independents');
  
  // If there's no Aontú, add it
  if (!hasAontu) {
    // Generate realistic vote count and percentage
    const aontuPercent = Math.min(2.5, Math.random() * 2 + 1); // 1-3%
    const aontuVotes = Math.round((constituency.parties[0].votes / constituency.parties[0].percent) * aontuPercent);
    
    // Add Aontú to parties
    constituency.parties.push({
      name: 'Aontú',
      votes: aontuVotes,
      seats: 0,
      color: '#FF5300',
      percent: aontuPercent
    });
    
    // Reduce Independents percentage if needed
    if (independentsIndex !== -1 && constituency.parties[independentsIndex].percent > aontuPercent + 5) {
      constituency.parties[independentsIndex].percent -= aontuPercent;
      // Also adjust votes to maintain consistency
      constituency.parties[independentsIndex].votes -= aontuVotes;
    }
  }
  
  // If there's no People Before Profit, add it
  if (!hasPBP) {
    // Generate realistic vote count and percentage
    const pbpPercent = Math.min(3.0, Math.random() * 3 + 1.5); // 1.5-4.5%
    const pbpVotes = Math.round((constituency.parties[0].votes / constituency.parties[0].percent) * pbpPercent);
    
    // Add People Before Profit to parties
    constituency.parties.push({
      name: 'People Before Profit',
      votes: pbpVotes,
      seats: 0,
      color: '#800000',
      percent: pbpPercent
    });
    
    // Reduce Independents percentage if needed
    if (independentsIndex !== -1 && constituency.parties[independentsIndex].percent > pbpPercent + 5) {
      constituency.parties[independentsIndex].percent -= pbpPercent;
      // Also adjust votes to maintain consistency
      constituency.parties[independentsIndex].votes -= pbpVotes;
    }
  }
  
  // Round percentages to one decimal place for consistency
  constituency.parties.forEach(party => {
    party.percent = Math.round(party.percent * 10) / 10;
  });
});

// Write the updated data back to the file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

console.log('Updated all constituencies to include Aontú and People Before Profit parties.');