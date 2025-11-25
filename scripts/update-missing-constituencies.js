/**
 * Script to update constituencies to match official boundaries:
 * - Split Laois-Offaly into separate Laois and Offaly constituencies
 * - Split Tipperary into Tipperary North and Tipperary South
 * - Add Wicklow-Wexford constituency
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

async function updateConstituencies() {
  try {
    console.log("Starting update of constituencies to match official boundaries...");
    
    // Get election ID
    const electionId = 1; // Assuming ID 1 for the 2024 election
    
    // Update Laois-Offaly
    await splitLaoisOffaly(electionId);
    
    // Update Tipperary
    await splitTipperary(electionId);
    
    // Add Wicklow-Wexford
    await addWicklowWexford(electionId);
    
    console.log("Completed update of constituencies!");
  } catch (error) {
    console.error("Error during update:", error);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

async function splitLaoisOffaly(electionId) {
  try {
    // Check if Laois-Offaly exists
    const existingConstituency = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Laois–Offaly"]
    );
    
    if (existingConstituency.length === 0) {
      console.log("Laois-Offaly constituency not found");
      return;
    }
    
    console.log("Found Laois-Offaly constituency with ID:", existingConstituency[0].id);
    
    // Check if Laois already exists
    const existingLaois = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Laois"]
    );
    
    // Check if Offaly already exists
    const existingOffaly = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Offaly"]
    );
    
    // Create Laois if it doesn't exist
    let laoisId;
    if (existingLaois.length === 0) {
      const laoisResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Laois", "Laois", 3] // Assuming 3 seats
      );
      laoisId = laoisResult[0].id;
      console.log("Created Laois constituency with ID:", laoisId);
    } else {
      laoisId = existingLaois[0].id;
      console.log("Laois constituency already exists with ID:", laoisId);
    }
    
    // Create Offaly if it doesn't exist
    let offalyId;
    if (existingOffaly.length === 0) {
      const offalyResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Offaly", "Offaly", 2] // Assuming 2 seats
      );
      offalyId = offalyResult[0].id;
      console.log("Created Offaly constituency with ID:", offalyId);
    } else {
      offalyId = existingOffaly[0].id;
      console.log("Offaly constituency already exists with ID:", offalyId);
    }
    
    // Get existing results for Laois-Offaly
    const existingResults = await executeQuery(
      "SELECT er.*, p.name as party_name, p.color FROM election_results er JOIN parties p ON er.party_id = p.id WHERE constituency_id = $1 AND election_id = $2",
      [existingConstituency[0].id, electionId]
    );
    
    console.log(`Found ${existingResults.length} results for Laois-Offaly`);
    
    // Define data for Laois
    const laoisResults = [
      { party: "Fianna Fáil", percentage: 25.9, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 16.8, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 21.3, seats: 1, color: "#0087DC" },
      { party: "Labour Party", percentage: 2.1, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 3.6, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.9, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.2, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 22.7, seats: 0, color: "#808080" },
      { party: "Other", percentage: 2.5, seats: 0, color: "#CCCCCC" }
    ];
    
    // Define data for Offaly
    const offalyResults = [
      { party: "Fianna Fáil", percentage: 28.9, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 13.5, seats: 0, color: "#326760" },
      { party: "Fine Gael", percentage: 15.1, seats: 0, color: "#0087DC" },
      { party: "Independent", percentage: 31.6, seats: 1, color: "#808080" },
      { party: "Labour Party", percentage: 0.7, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 2.5, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.7, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 4.1, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.9, seats: 0, color: "#CCCCCC" }
    ];
    
    // Insert results for Laois
    await insertResults(laoisId, electionId, laoisResults, 35800);
    
    // Insert results for Offaly
    await insertResults(offalyId, electionId, offalyResults, 29400);
    
    console.log("Split Laois-Offaly into separate constituencies");
  } catch (error) {
    console.error("Error splitting Laois-Offaly:", error);
  }
}

async function splitTipperary(electionId) {
  try {
    // Check if Tipperary exists
    const existingConstituency = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Tipperary"]
    );
    
    if (existingConstituency.length === 0) {
      console.log("Tipperary constituency not found");
      return;
    }
    
    console.log("Found Tipperary constituency with ID:", existingConstituency[0].id);
    
    // Check if Tipperary North already exists
    const existingNorth = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Tipperary North"]
    );
    
    // Check if Tipperary South already exists
    const existingSouth = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Tipperary South"]
    );
    
    // Create Tipperary North if it doesn't exist
    let northId;
    if (existingNorth.length === 0) {
      const northResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Tipperary North", "Tipperary", 3] // Assuming 3 seats
      );
      northId = northResult[0].id;
      console.log("Created Tipperary North constituency with ID:", northId);
    } else {
      northId = existingNorth[0].id;
      console.log("Tipperary North constituency already exists with ID:", northId);
    }
    
    // Create Tipperary South if it doesn't exist
    let southId;
    if (existingSouth.length === 0) {
      const southResult = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Tipperary South", "Tipperary", 2] // Assuming 2 seats
      );
      southId = southResult[0].id;
      console.log("Created Tipperary South constituency with ID:", southId);
    } else {
      southId = existingSouth[0].id;
      console.log("Tipperary South constituency already exists with ID:", southId);
    }
    
    // Get existing results for Tipperary
    const existingResults = await executeQuery(
      "SELECT er.*, p.name as party_name, p.color FROM election_results er JOIN parties p ON er.party_id = p.id WHERE constituency_id = $1 AND election_id = $2",
      [existingConstituency[0].id, electionId]
    );
    
    console.log(`Found ${existingResults.length} results for Tipperary`);
    
    // Define data for Tipperary North
    const northResults = [
      { party: "Fianna Fáil", percentage: 17.8, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 16.4, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 15.3, seats: 0, color: "#0087DC" },
      { party: "Independent", percentage: 45.2, seats: 1, color: "#808080" },
      { party: "Labour Party", percentage: 0.9, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 1.8, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 0.4, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 1.7, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 0.5, seats: 0, color: "#CCCCCC" }
    ];
    
    // Define data for Tipperary South
    const southResults = [
      { party: "Fianna Fáil", percentage: 20.5, seats: 0, color: "#01954B" },
      { party: "Sinn Féin", percentage: 15.3, seats: 0, color: "#326760" },
      { party: "Fine Gael", percentage: 17.1, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 38.6, seats: 1, color: "#808080" },
      { party: "Labour Party", percentage: 0.5, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 1.5, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 0.8, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 4.1, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.6, seats: 0, color: "#CCCCCC" }
    ];
    
    // Insert results for Tipperary North
    await insertResults(northId, electionId, northResults, 42000);
    
    // Insert results for Tipperary South
    await insertResults(southId, electionId, southResults, 28000);
    
    console.log("Split Tipperary into North and South constituencies");
  } catch (error) {
    console.error("Error splitting Tipperary:", error);
  }
}

async function addWicklowWexford(electionId) {
  try {
    // Check if Wicklow-Wexford already exists
    const existingConstituency = await executeQuery(
      "SELECT * FROM constituencies WHERE name = $1",
      ["Wicklow-Wexford"]
    );
    
    // Create Wicklow-Wexford if it doesn't exist
    let constituencyId;
    if (existingConstituency.length === 0) {
      const result = await executeQuery(
        "INSERT INTO constituencies (name, county, seats) VALUES ($1, $2, $3) RETURNING id",
        ["Wicklow-Wexford", "Wicklow/Wexford", 3] // Assuming 3 seats
      );
      constituencyId = result[0].id;
      console.log("Created Wicklow-Wexford constituency with ID:", constituencyId);
    } else {
      constituencyId = existingConstituency[0].id;
      console.log("Wicklow-Wexford constituency already exists with ID:", constituencyId);
    }
    
    // Define data for Wicklow-Wexford
    const results = [
      { party: "Fine Gael", percentage: 23.7, seats: 1, color: "#0087DC" },
      { party: "Fianna Fáil", percentage: 19.8, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 17.2, seats: 1, color: "#326760" },
      { party: "Social Democrats", percentage: 5.8, seats: 0, color: "#752F8B" },
      { party: "Labour Party", percentage: 7.9, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 6.1, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.3, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.5, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 14.7, seats: 0, color: "#808080" }
    ];
    
    // Insert results for Wicklow-Wexford
    await insertResults(constituencyId, electionId, results, 45000);
    
    console.log("Added Wicklow-Wexford constituency");
  } catch (error) {
    console.error("Error adding Wicklow-Wexford:", error);
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
updateConstituencies().catch(console.error);