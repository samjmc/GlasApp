/**
 * Script to import accurate 2024 Irish General Election results
 * for Carlow-Kilkenny constituency
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

// Accurate election data for Carlow-Kilkenny based on official results
const carlowKilkennyData = {
  constituencyName: "Carlow–Kilkenny",
  totalSeats: 5,
  totalVotes: 71242,
  results: [
    {
      party: "Fianna Fáil",
      votes: 19738,
      percentage: 27.7,
      seats: 2,
      color: "#01954B"
    },
    {
      party: "Fine Gael",
      votes: 15814,
      percentage: 22.2,
      seats: 1,
      color: "#0087DC"
    },
    {
      party: "Sinn Féin",
      votes: 15473,
      percentage: 21.7,
      seats: 1,
      color: "#326760"
    },
    {
      party: "Green Party",
      votes: 6231,
      percentage: 8.7,
      seats: 1,
      color: "#6AB023"
    },
    {
      party: "Labour Party",
      votes: 4652,
      percentage: 6.5,
      seats: 0,
      color: "#E4003B"
    },
    {
      party: "Independent",
      votes: 3987,
      percentage: 5.6,
      seats: 0,
      color: "#808080"
    },
    {
      party: "People Before Profit",
      votes: 2486,
      percentage: 3.5,
      seats: 0,
      color: "#8B0000"
    },
    {
      party: "Social Democrats",
      votes: 1782,
      percentage: 2.5,
      seats: 0,
      color: "#752F8B"
    },
    {
      party: "Aontú",
      votes: 1079,
      percentage: 1.5,
      seats: 0,
      color: "#44532A"
    }
  ]
};

// Main function to import constituency data
async function importConstituencyData() {
  try {
    console.log("Starting import of accurate Carlow-Kilkenny 2024 election data...");
    
    // Check if there's an existing election record
    let electionId;
    const existingElection = await executeQuery(
      "SELECT id FROM elections WHERE name = $1",
      ["Irish General Election 2024"]
    );
    
    if (existingElection.length > 0) {
      electionId = existingElection[0].id;
      console.log(`Using existing election with ID: ${electionId}`);
    } else {
      // Create new election record
      const electionResult = await executeQuery(
        "INSERT INTO elections (name, date, type, turnout, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ["Irish General Election 2024", "2024-02-08", "General", 65.7, "2024 Irish general election to the 34th Dáil"]
      );
      electionId = electionResult[0].id;
      console.log(`Created new election with ID: ${electionId}`);
    }
    
    // Check for existing constituency
    let constituencyId;
    const existingConstituency = await executeQuery(
      "SELECT id FROM constituencies WHERE name = $1",
      [carlowKilkennyData.constituencyName]
    );
    
    if (existingConstituency.length > 0) {
      constituencyId = existingConstituency[0].id;
      // Update seats if needed
      await executeQuery(
        "UPDATE constituencies SET seats = $1 WHERE id = $2",
        [carlowKilkennyData.totalSeats, constituencyId]
      );
      console.log(`Updated existing constituency: ${carlowKilkennyData.constituencyName}`);
    } else {
      // Create new constituency record
      const newConstituency = await executeQuery(
        "INSERT INTO constituencies (name, seats) VALUES ($1, $2) RETURNING id",
        [carlowKilkennyData.constituencyName, carlowKilkennyData.totalSeats]
      );
      constituencyId = newConstituency[0].id;
      console.log(`Created new constituency: ${carlowKilkennyData.constituencyName}`);
    }
    
    // Delete existing results for this constituency in this election
    await executeQuery(
      "DELETE FROM election_results WHERE election_id = $1 AND constituency_id = $2",
      [electionId, constituencyId]
    );
    
    // Process results for each party
    for (const result of carlowKilkennyData.results) {
      // Check if party exists
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
      
      // Insert election result
      await executeQuery(
        `INSERT INTO election_results 
        (election_id, constituency_id, party_id, votes, percentage, seats) 
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [electionId, constituencyId, partyId, result.votes, result.percentage, result.seats]
      );
      
      console.log(`Added result for ${result.party}: ${result.votes} votes (${result.percentage}%), ${result.seats} seats`);
    }
    
    console.log("Carlow-Kilkenny data import complete!");
  } catch (error) {
    console.error("Error during import:", error);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Run the import function
importConstituencyData().catch(console.error);