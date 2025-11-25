/**
 * Script to import the final batch of constituencies with accurate 2024 Irish General Election results
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

// Parse percentages from the provided table data
const constituencyData = [
  {
    constituencyName: "Kildare South",
    totalSeats: 4,
    quota: 12107,
    totalVotes: 60532,
    results: [
      { party: "Fianna Fáil", percentage: 25.6, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 19.2, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 18.9, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 15.0, seats: 1, color: "#808080" },
      { party: "Social Democrats", percentage: 2.8, seats: 0, color: "#752F8B" },
      { party: "Labour Party", percentage: 5.4, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 3.0, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 6.0, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.0, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.1, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Laois–Offaly",
    totalSeats: 5,
    quota: 12064,
    totalVotes: 72379,
    results: [
      { party: "Fianna Fáil", percentage: 27.1, seats: 2, color: "#01954B" },
      { party: "Sinn Féin", percentage: 15.3, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 18.4, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 26.7, seats: 1, color: "#808080" },
      { party: "Labour Party", percentage: 1.3, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 3.0, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.8, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.8, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 2.5, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Limerick City",
    totalSeats: 4,
    quota: 11559,
    totalVotes: 57794,
    results: [
      { party: "Fianna Fáil", percentage: 24.7, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 17.9, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 26.0, seats: 1, color: "#0087DC" },
      { party: "Labour Party", percentage: 10.3, seats: 1, color: "#E4003B" },
      { party: "Social Democrats", percentage: 4.0, seats: 0, color: "#752F8B" },
      { party: "Green Party", percentage: 5.5, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 4.3, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.5, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 2.4, seats: 0, color: "#808080" },
      { party: "Other", percentage: 1.4, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Limerick County",
    totalSeats: 3,
    quota: 11982,
    totalVotes: 47926,
    results: [
      { party: "Fianna Fáil", percentage: 29.3, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 28.6, seats: 1, color: "#0087DC" },
      { party: "Sinn Féin", percentage: 14.5, seats: 0, color: "#326760" },
      { party: "Independent", percentage: 16.2, seats: 1, color: "#808080" },
      { party: "Green Party", percentage: 4.5, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 3.0, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.9, seats: 0, color: "#44532A" }
    ]
  },
  {
    constituencyName: "Longford–Westmeath",
    totalSeats: 4,
    quota: 11673,
    totalVotes: 58362,
    results: [
      { party: "Fianna Fáil", percentage: 25.3, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 22.8, seats: 1, color: "#0087DC" },
      { party: "Sinn Féin", percentage: 15.2, seats: 1, color: "#326760" },
      { party: "Independent", percentage: 12.9, seats: 1, color: "#808080" },
      { party: "Labour Party", percentage: 5.3, seats: 0, color: "#E4003B" },
      { party: "Independent Ireland", percentage: 4.9, seats: 0, color: "#F5F5DC" },
      { party: "Green Party", percentage: 3.8, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 3.7, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 4.3, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.3, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Louth",
    totalSeats: 5,
    quota: 11585,
    totalVotes: 69509,
    results: [
      { party: "Sinn Féin", percentage: 27.8, seats: 2, color: "#326760" },
      { party: "Fianna Fáil", percentage: 21.6, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 16.3, seats: 1, color: "#0087DC" },
      { party: "Labour Party", percentage: 11.4, seats: 1, color: "#E4003B" },
      { party: "Independent Ireland", percentage: 1.8, seats: 0, color: "#F5F5DC" },
      { party: "Social Democrats", percentage: 2.5, seats: 0, color: "#752F8B" },
      { party: "Green Party", percentage: 4.7, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 2.9, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 5.1, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 5.9, seats: 0, color: "#808080" }
    ]
  },
  {
    constituencyName: "Mayo",
    totalSeats: 4,
    quota: 13250,
    totalVotes: 66246,
    results: [
      { party: "Fine Gael", percentage: 40.5, seats: 2, color: "#0087DC" },
      { party: "Fianna Fáil", percentage: 21.8, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 14.7, seats: 1, color: "#326760" },
      { party: "Independent Ireland", percentage: 9.7, seats: 0, color: "#F5F5DC" },
      { party: "Independent", percentage: 3.7, seats: 0, color: "#808080" },
      { party: "Green Party", percentage: 2.4, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 2.1, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 3.1, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.9, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Meath East",
    totalSeats: 3,
    quota: 11665,
    totalVotes: 46658,
    results: [
      { party: "Fine Gael", percentage: 37.2, seats: 1, color: "#0087DC" },
      { party: "Fianna Fáil", percentage: 22.9, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 18.7, seats: 1, color: "#326760" },
      { party: "Social Democrats", percentage: 4.7, seats: 0, color: "#752F8B" },
      { party: "Labour Party", percentage: 3.1, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 3.6, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 2.0, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 6.2, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 1.6, seats: 0, color: "#808080" }
    ]
  },
  {
    constituencyName: "Meath West",
    totalSeats: 3,
    quota: 10896,
    totalVotes: 43583,
    results: [
      { party: "Sinn Féin", percentage: 29.7, seats: 1, color: "#326760" },
      { party: "Fianna Fáil", percentage: 24.2, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 20.0, seats: 1, color: "#0087DC" },
      { party: "Independent Ireland", percentage: 7.5, seats: 0, color: "#F5F5DC" },
      { party: "People Before Profit", percentage: 2.9, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 9.0, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.6, seats: 0, color: "#CCCCCC" },
      { party: "Independent", percentage: 5.1, seats: 0, color: "#808080" }
    ]
  },
  {
    constituencyName: "Roscommon–Galway",
    totalSeats: 3,
    quota: 11669,
    totalVotes: 46674,
    results: [
      { party: "Independent", percentage: 32.7, seats: 1, color: "#808080" },
      { party: "Fianna Fáil", percentage: 19.4, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 15.5, seats: 0, color: "#0087DC" },
      { party: "Sinn Féin", percentage: 15.0, seats: 1, color: "#326760" },
      { party: "Independent Ireland", percentage: 7.1, seats: 0, color: "#F5F5DC" },
      { party: "Green Party", percentage: 3.1, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 2.9, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 4.3, seats: 0, color: "#44532A" }
    ]
  }
];

// Main function to import constituency data
async function importFinalBatch() {
  try {
    console.log("Starting import of final batch of constituency data...");
    
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
      // Create new election record if somehow it doesn't exist
      const electionResult = await executeQuery(
        "INSERT INTO elections (name, date, type, turnout, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        ["Irish General Election 2024", "2024-02-08", "General", 65.7, "2024 Irish general election to the 34th Dáil"]
      );
      electionId = electionResult[0].id;
      console.log(`Created new election with ID: ${electionId}`);
    }
    
    // Process each constituency
    for (const constituency of constituencyData) {
      // Check if we already have data for this constituency
      const existingResults = await executeQuery(
        `SELECT c.name, COUNT(er.id) AS result_count 
         FROM constituencies c
         LEFT JOIN election_results er ON c.id = er.constituency_id
         WHERE c.name = $1
         GROUP BY c.name`,
        [constituency.constituencyName]
      );
      
      // Skip if we already have results
      if (existingResults.length > 0 && existingResults[0].result_count > 0) {
        console.log(`Skipping ${constituency.constituencyName} - already has ${existingResults[0].result_count} results`);
        continue;
      }
      
      await processConstituency(constituency, electionId);
    }
    
    console.log("Finished importing final batch of constituency data!");
  } catch (error) {
    console.error("Error during import:", error);
  } finally {
    // Close the database pool
    await pool.end();
  }
}

// Process a single constituency
async function processConstituency(constituencyData, electionId) {
  try {
    // Check for existing constituency or create new one
    let constituencyId;
    const existingConstituency = await executeQuery(
      "SELECT id FROM constituencies WHERE name = $1",
      [constituencyData.constituencyName]
    );
    
    if (existingConstituency.length > 0) {
      constituencyId = existingConstituency[0].id;
      // Update seats if needed
      await executeQuery(
        "UPDATE constituencies SET seats = $1 WHERE id = $2",
        [constituencyData.totalSeats, constituencyId]
      );
      console.log(`Updated existing constituency: ${constituencyData.constituencyName}`);
    } else {
      // Create new constituency record
      const newConstituency = await executeQuery(
        "INSERT INTO constituencies (name, seats) VALUES ($1, $2) RETURNING id",
        [constituencyData.constituencyName, constituencyData.totalSeats]
      );
      constituencyId = newConstituency[0].id;
      console.log(`Created new constituency: ${constituencyData.constituencyName}`);
    }
    
    // Calculate approximate votes based on percentages for each party
    const totalVotes = constituencyData.totalVotes;
    
    // Process results for each party
    for (const result of constituencyData.results) {
      // Calculate votes from percentage
      const votes = Math.round((result.percentage / 100) * totalVotes);
      
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
      
      console.log(`Added result for ${result.party} in ${constituencyData.constituencyName}: ${votes} votes (${result.percentage}%), ${result.seats} seats`);
    }
    
    console.log(`Completed import for ${constituencyData.constituencyName}`);
  } catch (error) {
    console.error(`Error processing ${constituencyData.constituencyName}:`, error);
  }
}

// Run the import function
importFinalBatch().catch(console.error);