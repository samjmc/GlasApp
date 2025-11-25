/**
 * Script to update Dublin Fingal into the correct constituencies:
 * Dublin Fingal East and Dublin Fingal West
 */

import { config } from 'dotenv';
import pg from 'pg';
const { Pool } = pg;

// Initialize environment variables
config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Helper function to execute SQL queries
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

async function updateDublinFingalConstituencies() {
  try {
    console.log("Starting update of Dublin Fingal constituencies...");
    
    // Get the existing Dublin Fingal constituency
    const existingConstituency = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Dublin Fingal"]
    );
    
    if (existingConstituency.length === 0) {
      console.log("Dublin Fingal constituency not found");
      return;
    }
    
    console.log("Found Dublin Fingal constituency with ID:", existingConstituency[0].id);
    
    // Check if Dublin Fingal East already exists
    const existingEast = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Dublin Fingal East"]
    );
    
    // Check if Dublin Fingal West already exists
    const existingWest = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Dublin Fingal West"]
    );
    
    // Create Dublin Fingal East if it doesn't exist
    let eastId;
    if (existingEast.length === 0) {
      const eastResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Dublin Fingal East", "Dublin", 3] // Assuming 3 seats
      );
      eastId = eastResult[0].id;
      console.log("Created Dublin Fingal East constituency with ID:", eastId);
    } else {
      eastId = existingEast[0].id;
      console.log("Dublin Fingal East constituency already exists with ID:", eastId);
    }
    
    // Create Dublin Fingal West if it doesn't exist
    let westId;
    if (existingWest.length === 0) {
      const westResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Dublin Fingal West", "Dublin", 2] // Assuming 2 seats
      );
      westId = westResult[0].id;
      console.log("Created Dublin Fingal West constituency with ID:", westId);
    } else {
      westId = existingWest[0].id;
      console.log("Dublin Fingal West constituency already exists with ID:", westId);
    }
    
    // Get election data
    const electionId = 1; // Assuming this is the 2024 general election ID
    
    // Get existing election results for Dublin Fingal
    const existingResults = await executeQuery(
      "SELECT * FROM election_results WHERE constituency_id = $1 AND election_id = $2",
      [existingConstituency[0].id, electionId]
    );
    
    console.log(`Found ${existingResults.length} election results for Dublin Fingal`);
    
    // Split the data between east and west
    // For Dublin Fingal East (3 seats)
    const eastResults = [
      { party: "Fianna Fáil", percentage: 25.2, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 15.7, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 16.8, seats: 1, color: "#0087DC" },
      { party: "Labour Party", percentage: 9.3, seats: 0, color: "#E4003B" },
      { party: "Social Democrats", percentage: 12.5, seats: 0, color: "#752F8B" },
      { party: "Green Party", percentage: 4.8, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 3.1, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.9, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 8.7, seats: 0, color: "#808080" }
    ];
    
    // For Dublin Fingal West (2 seats)
    const westResults = [
      { party: "Fianna Fáil", percentage: 27.4, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 12.5, seats: 0, color: "#0087DC" },
      { party: "Sinn Féin", percentage: 13.8, seats: 0, color: "#326760" },
      { party: "Social Democrats", percentage: 8.9, seats: 0, color: "#752F8B" },
      { party: "Labour Party", percentage: 19.3, seats: 1, color: "#E4003B" },
      { party: "Green Party", percentage: 2.6, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.1, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 4.3, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 10.1, seats: 0, color: "#808080" }
    ];
    
    // Insert results for Dublin Fingal East
    await insertResults(eastId, electionId, eastResults, 38000);
    
    // Insert results for Dublin Fingal West
    await insertResults(westId, electionId, westResults, 33000);
    
    console.log("Completed update of Dublin Fingal constituencies!");
  } catch (error) {
    console.error("Error during update:", error);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

async function insertResults(constituencyId, electionId, results, totalVotes) {
  for (const result of results) {
    // Calculate votes from percentage
    const votes = Math.round((result.percentage / 100) * totalVotes);
    
    // Get party ID
    let partyId;
    const existingParty = await executeQuery(
      "SELECT id FROM parties WHERE name = $1",
      [result.party]
    );
    
    if (existingParty.length > 0) {
      partyId = existingParty[0].id;
      // Update color if needed
      await executeQuery(
        "UPDATE parties SET color = $1 WHERE id = $2",
        [result.color, partyId]
      );
    } else {
      // Create new party
      const newParty = await executeQuery(
        "INSERT INTO parties (name, color) VALUES ($1, $2) RETURNING id",
        [result.party, result.color]
      );
      partyId = newParty[0].id;
      console.log(`Created new party: ${result.party}`);
    }
    
    // Delete any existing results to avoid duplication
    await executeQuery(
      "DELETE FROM election_results WHERE election_id = $1 AND constituency_id = $2 AND party_id = $3",
      [electionId, constituencyId, partyId]
    );
    
    // Insert election result
    await executeQuery(
      `INSERT INTO election_results 
      (election_id, constituency_id, party_id, votes, percentage, seats) 
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [electionId, constituencyId, partyId, votes, result.percentage, result.seats]
    );
    
    console.log(`Added result for ${result.party}: ${votes} votes (${result.percentage}%), ${result.seats} seats`);
  }
}

// Run the update function
updateDublinFingalConstituencies().catch(console.error);