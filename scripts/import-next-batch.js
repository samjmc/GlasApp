/**
 * Script to import the next batch of constituencies with accurate 2024 Irish General Election results
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
    constituencyName: "Dublin Central",
    totalSeats: 4,
    quota: 6551,
    totalVotes: 32754,
    results: [
      { party: "Sinn Féin", percentage: 23.3, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 16.8, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 14.3, seats: 1, color: "#808080" },
      { party: "Social Democrats", percentage: 13.3, seats: 1, color: "#752F8B" },
      { party: "Labour Party", percentage: 7.5, seats: 0, color: "#E4003B" },
      { party: "Fianna Fáil", percentage: 7.2, seats: 0, color: "#01954B" },
      { party: "Green Party", percentage: 6.0, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 4.5, seats: 0, color: "#8B0000" },
      { party: "Other", percentage: 4.9, seats: 0, color: "#CCCCCC" },
      { party: "Aontú", percentage: 2.2, seats: 0, color: "#44532A" }
    ]
  },
  {
    constituencyName: "Dublin South-Central",
    totalSeats: 4,
    quota: 7469,
    totalVotes: 37344,
    results: [
      { party: "Sinn Féin", percentage: 31.2, seats: 2, color: "#326760" },
      { party: "Fianna Fáil", percentage: 10.7, seats: 1, color: "#01954B" },
      { party: "Social Democrats", percentage: 9.0, seats: 0, color: "#752F8B" },
      { party: "Fine Gael", percentage: 8.2, seats: 0, color: "#0087DC" },
      { party: "Labour Party", percentage: 6.6, seats: 0, color: "#E4003B" },
      { party: "Independent Ireland", percentage: 2.3, seats: 0, color: "#F5F5DC" },
      { party: "People Before Profit", percentage: 8.9, seats: 1, color: "#8B0000" },
      { party: "Green Party", percentage: 6.1, seats: 0, color: "#6AB023" },
      { party: "Aontú", percentage: 3.9, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 11.0, seats: 0, color: "#CCCCCC" },
      { party: "Independent", percentage: 2.2, seats: 0, color: "#808080" }
    ]
  },
  {
    constituencyName: "Dublin South-West",
    totalSeats: 5,
    quota: 11138,
    totalVotes: 66823,
    results: [
      { party: "Sinn Féin", percentage: 20.8, seats: 1, color: "#326760" },
      { party: "Fianna Fáil", percentage: 19.5, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 19.1, seats: 1, color: "#0087DC" },
      { party: "Labour Party", percentage: 8.7, seats: 1, color: "#E4003B" },
      { party: "People Before Profit", percentage: 7.6, seats: 0, color: "#8B0000" },
      { party: "Social Democrats", percentage: 5.9, seats: 0, color: "#752F8B" },
      { party: "Aontú", percentage: 3.9, seats: 0, color: "#44532A" },
      { party: "Green Party", percentage: 2.9, seats: 0, color: "#6AB023" },
      { party: "Other", percentage: 2.2, seats: 0, color: "#CCCCCC" },
      { party: "Independent", percentage: 9.5, seats: 1, color: "#808080" }
    ]
  },
  {
    constituencyName: "Dublin West",
    totalSeats: 5,
    quota: 7373,
    totalVotes: 44236,
    results: [
      { party: "Fianna Fáil", percentage: 22.3, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 21.0, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 15.4, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 8.1, seats: 1, color: "#808080" },
      { party: "Green Party", percentage: 6.6, seats: 1, color: "#6AB023" },
      { party: "People Before Profit", percentage: 8.0, seats: 0, color: "#8B0000" },
      { party: "Labour Party", percentage: 5.5, seats: 0, color: "#E4003B" },
      { party: "Social Democrats", percentage: 4.9, seats: 0, color: "#752F8B" },
      { party: "Aontú", percentage: 5.5, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 2.6, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Dún Laoghaire",
    totalSeats: 4,
    quota: 11134,
    totalVotes: 55669,
    results: [
      { party: "Fine Gael", percentage: 36.0, seats: 2, color: "#0087DC" },
      { party: "Fianna Fáil", percentage: 15.9, seats: 1, color: "#01954B" },
      { party: "People Before Profit", percentage: 12.2, seats: 1, color: "#8B0000" },
      { party: "Sinn Féin", percentage: 9.0, seats: 0, color: "#326760" },
      { party: "Green Party", percentage: 7.7, seats: 0, color: "#6AB023" },
      { party: "Labour Party", percentage: 5.7, seats: 0, color: "#E4003B" },
      { party: "Social Democrats", percentage: 7.5, seats: 0, color: "#752F8B" },
      { party: "Aontú", percentage: 4.3, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.2, seats: 0, color: "#CCCCCC" },
      { party: "Independent", percentage: 0.6, seats: 0, color: "#808080" }
    ]
  },
  {
    constituencyName: "Galway East",
    totalSeats: 4,
    quota: 10843,
    totalVotes: 54214,
    results: [
      { party: "Fianna Fáil", percentage: 26.2, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 21.7, seats: 1, color: "#0087DC" },
      { party: "Independent", percentage: 20.3, seats: 1, color: "#808080" },
      { party: "Sinn Féin", percentage: 13.8, seats: 1, color: "#326760" },
      { party: "People Before Profit", percentage: 2.3, seats: 0, color: "#8B0000" },
      { party: "Green Party", percentage: 2.3, seats: 0, color: "#6AB023" },
      { party: "Aontú", percentage: 2.9, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.1, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Galway West",
    totalSeats: 5,
    quota: 10047,
    totalVotes: 60277,
    results: [
      { party: "Independent", percentage: 26.4, seats: 1, color: "#808080" },
      { party: "Fine Gael", percentage: 18.8, seats: 1, color: "#0087DC" },
      { party: "Fianna Fáil", percentage: 16.8, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 13.5, seats: 1, color: "#326760" },
      { party: "Independent Ireland", percentage: 9.5, seats: 1, color: "#F5F5DC" },
      { party: "Social Democrats", percentage: 3.6, seats: 0, color: "#752F8B" },
      { party: "Labour Party", percentage: 3.3, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 3.1, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.5, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 2.0, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 1.5, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Kerry",
    totalSeats: 4,
    quota: 13083,
    totalVotes: 78495,
    results: [
      { party: "Independent", percentage: 37.2, seats: 2, color: "#808080" },
      { party: "Fianna Fáil", percentage: 26.2, seats: 1, color: "#01954B" },
      { party: "Sinn Féin", percentage: 16.3, seats: 1, color: "#326760" },
      { party: "Fine Gael", percentage: 10.1, seats: 0, color: "#0087DC" },
      { party: "Labour Party", percentage: 2.3, seats: 0, color: "#E4003B" },
      { party: "Independent Ireland", percentage: 1.3, seats: 0, color: "#F5F5DC" },
      { party: "Green Party", percentage: 2.5, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 1.3, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 1.8, seats: 0, color: "#44532A" },
      { party: "Other", percentage: 0.9, seats: 0, color: "#CCCCCC" }
    ]
  },
  {
    constituencyName: "Kildare North",
    totalSeats: 4,
    quota: 11661,
    totalVotes: 58305,
    results: [
      { party: "Fianna Fáil", percentage: 25.6, seats: 1, color: "#01954B" },
      { party: "Fine Gael", percentage: 23.3, seats: 1, color: "#0087DC" },
      { party: "Social Democrats", percentage: 13.3, seats: 1, color: "#752F8B" },
      { party: "Sinn Féin", percentage: 14.1, seats: 1, color: "#326760" },
      { party: "Labour Party", percentage: 6.6, seats: 0, color: "#E4003B" },
      { party: "Green Party", percentage: 7.6, seats: 0, color: "#6AB023" },
      { party: "People Before Profit", percentage: 2.9, seats: 0, color: "#8B0000" },
      { party: "Aontú", percentage: 2.4, seats: 0, color: "#44532A" },
      { party: "Independent", percentage: 4.2, seats: 0, color: "#808080" }
    ]
  },
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
  }
];

// Main function to import constituency data
async function importNextBatch() {
  try {
    console.log("Starting import of next batch of constituency data...");
    
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
         JOIN election_results er ON c.id = er.constituency_id
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
    
    console.log("Finished importing next batch of constituency data!");
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
importNextBatch().catch(console.error);