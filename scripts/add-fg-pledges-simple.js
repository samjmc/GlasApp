/**
 * Script to add Fine Gael pledges with weighted scoring system
 */

import { db } from '../server/db.js';
import { pledges, userPledgeVotes } from '../shared/schema.js';

const fineGaelPledges = [
  {
    title: "Cap day-to-day spending growth at 5% p.a.",
    description: "Implement fiscal discipline by capping annual growth in day-to-day government spending at 5% to ensure sustainable public finances.",
    partyId: 2,
    category: "Public Finances",
    electionYear: 2024,
    status: "active",
    scoreType: "fulfillment",
    score: "20.00",
    evidence: "Budget 2024 maintained spending discipline. Multi-annual expenditure framework established.",
    sourceUrl: "https://www.finegael.ie/manifesto/public-finances"
  },
  {
    title: "Transfer 0.8% GDP into sovereign-wealth & infrastructure funds annually",
    description: "Establish and fund sovereign wealth and infrastructure funds with 0.8% of GDP annually to build long-term financial resilience.",
    partyId: 2,
    category: "Public Finances",
    electionYear: 2024,
    status: "completed",
    scoreType: "fulfillment",
    score: "100.00",
    evidence: "€14 billion Apple tax windfall secured. Future Ireland Fund established with governance structures.",
    sourceUrl: "https://www.finegael.ie/manifesto/sovereign-wealth"
  },
  {
    title: "Cut income tax by raising lower- & higher-rate thresholds",
    description: "Reduce the tax burden on workers by increasing both lower and higher rate income tax thresholds.",
    partyId: 2,
    category: "Taxation",
    electionYear: 2024,
    status: "ongoing",
    scoreType: "fulfillment",
    score: "50.00",
    evidence: "Budget 2024 increased standard rate threshold. Higher rate threshold adjustment implemented.",
    sourceUrl: "https://www.finegael.ie/manifesto/taxation"
  },
  {
    title: "Reduce VAT on food businesses from 13% to 11%",
    description: "Support the hospitality and food service sector by reducing VAT rate from 13% to 11%.",
    partyId: 2,
    category: "Taxation",
    electionYear: 2024,
    status: "active",
    scoreType: "fulfillment",
    score: "0.00",
    evidence: "Under consideration. EU state aid implications being reviewed.",
    sourceUrl: "https://www.finegael.ie/manifesto/business-support"
  },
  {
    title: "Boost first-time-buyer tax rebate",
    description: "Enhance financial support for first-time home buyers through increased tax rebate schemes.",
    partyId: 2,
    category: "Housing",
    electionYear: 2024,
    status: "active",
    scoreType: "fulfillment",
    score: "0.00",
    evidence: "Policy development ongoing. Effective rebate mechanism being designed.",
    sourceUrl: "https://www.finegael.ie/manifesto/housing"
  },
  {
    title: "Extend shared-equity scheme to all home purchasers",
    description: "Expand the shared equity loan scheme beyond first-time buyers to include all home purchasers.",
    partyId: 2,
    category: "Housing",
    electionYear: 2024,
    status: "completed",
    scoreType: "fulfillment",
    score: "100.00",
    evidence: "Legislation passed in 2024. Scheme operational since Q2 2024. Strong uptake achieved.",
    sourceUrl: "https://www.finegael.ie/manifesto/housing-equity"
  },
  {
    title: "Maintain rent-pressure zones (RPZs)",
    description: "Continue and strengthen rent pressure zone regulations to protect tenants from excessive rent increases.",
    partyId: 2,
    category: "Housing",
    electionYear: 2024,
    status: "completed",
    scoreType: "fulfillment",
    score: "100.00",
    evidence: "RPZ designations maintained across all major urban areas. Enforcement mechanisms strengthened.",
    sourceUrl: "https://www.finegael.ie/manifesto/rental-market"
  },
  {
    title: "Increase renter tax credit",
    description: "Enhance financial support for renters through increased tax credit allowances.",
    partyId: 2,
    category: "Housing",
    electionYear: 2024,
    status: "completed",
    scoreType: "fulfillment",
    score: "100.00",
    evidence: "Credit increased from €500 to €750 annually in Budget 2024. Digital claiming system launched.",
    sourceUrl: "https://www.finegael.ie/manifesto/renter-support"
  },
  {
    title: "Legally binding asylum-processing timeframes",
    description: "Establish legally binding timeframes for processing asylum applications to improve system efficiency.",
    partyId: 2,
    category: "Immigration & Asylum",
    electionYear: 2024,
    status: "active",
    scoreType: "fulfillment",
    score: "0.00",
    evidence: "Complex legal framework under development. Resource allocation planning ongoing.",
    sourceUrl: "https://www.finegael.ie/manifesto/immigration"
  },
  {
    title: "Strengthen border security & create High Court division",
    description: "Enhance border security measures and establish specialized High Court division for immigration cases.",
    partyId: 2,
    category: "Immigration & Asylum",
    electionYear: 2024,
    status: "ongoing",
    scoreType: "fulfillment",
    score: "20.00",
    evidence: "Border security budget increased. High Court division proposal under review.",
    sourceUrl: "https://www.finegael.ie/manifesto/border-security"
  },
  {
    title: "Restrict movement of asylum applicants in state accommodation",
    description: "Implement movement restrictions for asylum seekers in state-provided accommodation.",
    partyId: 2,
    category: "Immigration & Asylum",
    electionYear: 2024,
    status: "ongoing",
    scoreType: "fulfillment",
    score: "20.00",
    evidence: "Policy framework under development. Legal review of proposed restrictions ongoing.",
    sourceUrl: "https://www.finegael.ie/manifesto/asylum-policy"
  },
  {
    title: "Deploy €14 billion windfall to housing, grid, water, transport",
    description: "Strategic deployment of Apple tax windfall across critical infrastructure: housing, electricity grid, water systems, and transport.",
    partyId: 2,
    category: "Apple-Tax Windfall",
    electionYear: 2024,
    status: "ongoing",
    scoreType: "fulfillment",
    score: "20.00",
    evidence: "€14 billion windfall secured. Infrastructure investment framework established. Initial project allocations approved.",
    sourceUrl: "https://www.finegael.ie/manifesto/infrastructure-investment"
  },
  {
    title: "Deepen 'Shared Island' North–South cooperation",
    description: "Strengthen cooperation and collaboration between Ireland and Northern Ireland across multiple policy areas.",
    partyId: 2,
    category: "Shared Island",
    electionYear: 2024,
    status: "ongoing",
    scoreType: "fulfillment",
    score: "50.00",
    evidence: "Shared Island Fund expanded. Cross-border infrastructure projects advanced. Enhanced educational cooperation agreements.",
    sourceUrl: "https://www.finegael.ie/manifesto/shared-island"
  }
];

const pledgeWeights = {
  "Cap day-to-day spending growth at 5% p.a.": 10.0,
  "Transfer 0.8% GDP into sovereign-wealth & infrastructure funds annually": 15.0,
  "Cut income tax by raising lower- & higher-rate thresholds": 10.0,
  "Reduce VAT on food businesses from 13% to 11%": 5.0,
  "Boost first-time-buyer tax rebate": 5.0,
  "Extend shared-equity scheme to all home purchasers": 5.0,
  "Maintain rent-pressure zones (RPZs)": 5.0,
  "Increase renter tax credit": 5.0,
  "Legally binding asylum-processing timeframes": 5.0,
  "Strengthen border security & create High Court division": 5.0,
  "Restrict movement of asylum applicants in state accommodation": 5.0,
  "Deploy €14 billion windfall to housing, grid, water, transport": 15.0,
  "Deepen 'Shared Island' North–South cooperation": 10.0
};

async function addFineGaelPledges() {
  console.log('Adding Fine Gael weighted pledges...');
  
  try {
    // Insert pledges
    const insertedPledges = await db.insert(pledges).values(fineGaelPledges).returning();
    console.log(`Inserted ${insertedPledges.length} Fine Gael pledges`);

    // Add weighted importance votes
    const voteData = [];
    for (const pledge of insertedPledges) {
      const weight = pledgeWeights[pledge.title];
      if (weight) {
        // Convert weight to importance votes (weight * 10)
        const importanceVotes = Math.round(weight * 10);
        
        for (let i = 0; i < importanceVotes; i++) {
          voteData.push({
            userId: "system",
            pledgeId: pledge.id,
            category: pledge.category,
            importanceScore: 5
          });
        }
      }
    }

    if (voteData.length > 0) {
      await db.insert(userPledgeVotes).values(voteData);
      console.log(`Added ${voteData.length} weighted importance votes`);
    }

    // Calculate summary
    const totalWeight = Object.values(pledgeWeights).reduce((a, b) => a + b, 0);
    const completedWeight = insertedPledges.reduce((sum, pledge) => {
      const weight = pledgeWeights[pledge.title] || 0;
      const completion = parseFloat(pledge.score) / 100;
      return sum + (weight * completion);
    }, 0);
    
    console.log(`\nFine Gael Overall Completion: ${(completedWeight / totalWeight * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

addFineGaelPledges()
  .then(() => {
    console.log('Fine Gael pledges added successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });