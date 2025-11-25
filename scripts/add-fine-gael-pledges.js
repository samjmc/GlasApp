/**
 * Script to add Fine Gael pledges scorecard from user assessment
 */
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Set up database connection
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ws: ws
});

const pledges = [
  {
    partyId: 1, // Fine Gael
    title: "Cap day-to-day spending growth at 5% per year",
    description: "Cap day-to-day spending growth at 5% per year to allow expenditure growth while maintaining fiscal discipline.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "40.00",
    evidence: "Government committed to this in Budget 2025 but no standalone report on day-to-day vs total spending has been published yet. First Budget figures show overall spending growth just under 6% (incl. capital) but breakdowns on the day-to-day envelope alone are not publicly disaggregated. Pending clearer reporting."
  },
  {
    partyId: 1,
    title: "Transfer 0.8% of GDP into sovereign-wealth & climate/infrastructure funds each year",
    description: "Establish and fund sovereign wealth and infrastructure funds with 0.8% of GDP annually.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "completed",
    scoreType: "fulfillment",
    score: "90.00",
    evidence: "Done. The first transfer (0.8% GDP) went into two new funds in late 2024, totalling €8.4 billion into the Future Ireland Fund and €2 billion into the Infrastructure, Climate & Nature Fund. By end-2025 this will reach about €16 billion."
  },
  {
    partyId: 1,
    title: "Cut income tax by raising lower- & higher-rate entry points",
    description: "Reduce income tax burden by increasing the thresholds for lower and higher tax rate bands.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "65.00",
    evidence: "Partial delivery. Budget 2025 raised the higher-rate band by €2,000 (to €44,000 for singles) from 1 Jan 2025, easing pressure at the margin. Lower-rate band changes were minor; the USC surcharge was left unchanged."
  },
  {
    partyId: 1,
    title: "Reduce VAT on food businesses from 13% to 11%",
    description: "Lower the VAT rate for food businesses to support the hospitality sector.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "failed",
    scoreType: "fulfillment",
    score: "0.00",
    evidence: "Not implemented. In September 2023 the rate was in fact increased to 13.5%, and Budget 2025 left it unchanged, despite industry lobbying."
  },
  {
    partyId: 1,
    title: "Boost first-time-buyer tax rebate",
    description: "Increase tax rebates available to first-time homebuyers to support home ownership.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "20.00",
    evidence: "Under review. The existing Help-to-Buy scheme remains in place, but no increase in the 10% deposit tax rebate has been announced for 2025 — it still covers only new-build purchases up to the existing cap."
  },
  {
    partyId: 1,
    title: "Extend shared-equity scheme to all homes",
    description: "Expand the shared equity scheme beyond new builds to include all types of homes.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "completed",
    scoreType: "fulfillment",
    score: "85.00",
    evidence: "Extended. The First Home Scheme was renewed for two more years in May 2025. Q1 2025 saw 15,356 registrations, 6,774 approvals and 3,323 drawdowns to date."
  },
  {
    partyId: 1,
    title: "Maintain rent-pressure zones (RPZs)",
    description: "Keep rent pressure zones in place to protect tenants from excessive rent increases.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "completed",
    scoreType: "fulfillment",
    score: "90.00",
    evidence: "Maintained & expanded. As of June 2025 the government has kept RPZs in place and is planning a national roll-out of rent-caps rather than abolish them."
  },
  {
    partyId: 1,
    title: "Increase renter tax credit",
    description: "Raise the tax credit available to renters to help with housing costs.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "completed",
    scoreType: "fulfillment",
    score: "95.00",
    evidence: "Delivered. For 2025 the Rent Tax Credit was doubled to €1,000 per individual (or €2,000 jointly), back-dated to cover 2024."
  },
  {
    partyId: 1,
    title: "Legally binding asylum-processing timeframes",
    description: "Establish legally binding timeframes for processing asylum applications.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "failed",
    scoreType: "fulfillment",
    score: "10.00",
    evidence: "Not yet enacted. Processing still averages 13 months under the normal track (8 weeks accelerated). No statutory deadlines have been legislated."
  },
  {
    partyId: 1,
    title: "Strengthen border security & dedicated High Court division",
    description: "Enhance border security measures and create a dedicated High Court division for immigration cases.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "30.00",
    evidence: "Proposed. The government has pledged a new immigration High Court stream, but no bill has yet passed; border-security budget lines have been increased, but implementation is ongoing."
  },
  {
    partyId: 1,
    title: "Restrict movement of asylum applicants",
    description: "Implement restrictions on the movement of asylum applicants during processing.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "25.00",
    evidence: "Under consideration. Draft regulations exist to limit direct provision movement, but final rules are still in public consultation."
  },
  {
    partyId: 1,
    title: "Deploy €14 billion Apple-tax windfall to housing, grid, water, transport",
    description: "Use the Apple tax windfall for infrastructure investments in housing, electricity grid, water systems, and transport.",
    category: "Infrastructure",
    electionYear: 2024,
    targetDate: "2026-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "70.00",
    evidence: "In progress. That windfall sits in the two sovereign-wealth/infra funds. Project pipelines (e.g. housing construction draws, grid upgrades) are now being tendered — spend will ramp up through 2025–26."
  },
  {
    partyId: 1,
    title: "Deepen 'Shared Island' North–South cooperation",
    description: "Strengthen cooperation between Ireland and Northern Ireland through the Shared Island initiative.",
    category: "Foreign Policy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto",
    status: "ongoing",
    scoreType: "fulfillment",
    score: "45.00",
    evidence: "Ongoing. The Shared Island fund (launched 2021) continues to back cross-border projects, but no new headline tranche was announced in 2025. Detailed progress reports are quarterly but have not broken out major new initiatives."
  }
];

async function addFineGaelPledges() {
  const client = await pool.connect();
  
  try {
    console.log('Adding Fine Gael pledges scorecard...');
    
    for (const pledge of pledges) {
      const query = `
        INSERT INTO pledges (
          party_id, title, description, category, election_year, 
          target_date, source_url, status, score_type, score, evidence,
          created_at, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `;
      
      const values = [
        pledge.partyId,
        pledge.title,
        pledge.description,
        pledge.category,
        pledge.electionYear,
        pledge.targetDate ? new Date(pledge.targetDate) : null,
        pledge.sourceUrl,
        pledge.status,
        pledge.scoreType,
        pledge.score,
        pledge.evidence
      ];
      
      await client.query(query, values);
      console.log(`✓ Added: ${pledge.title}`);
    }
    
    console.log(`\n✅ Successfully added ${pledges.length} Fine Gael pledges`);
    
  } catch (error) {
    console.error('Error adding pledges:', error);
  } finally {
    client.release();
  }
}

addFineGaelPledges();