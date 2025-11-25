/**
 * Script to add Fine Gael pledges with weighted scoring system
 * Based on the official Fine Gael pledge tracking data as of June 2025
 */

import { db } from '../server/db.js';
import { pledges, userPledgeVotes } from '../shared/schema.js';

const fineGaelPledges = [
  {
    title: "Cap day-to-day spending growth at 5% p.a.",
    description: "Implement fiscal discipline by capping annual growth in day-to-day government spending at 5% to ensure sustainable public finances.",
    partyId: 2, // Fine Gael
    category: "Public Finances",
    electionYear: 2024,
    status: "active",
    scoreType: "fulfillment",
    score: "20.00",
    weight: 10.0,
    evidence: "Budget 2024 maintained spending discipline. Multi-annual expenditure framework established. Department spending limits set for 2025.",
    sourceUrl: "https://www.finegael.ie/manifesto/public-finances",
    weight: 10.0
  },
  {
    title: "Transfer 0.8% GDP into sovereign-wealth & infrastructure funds annually",
    description: "Establish and fund sovereign wealth and infrastructure funds with 0.8% of GDP annually to build long-term financial resilience.",
    party: "ie-fg",
    category: "Public Finances",
    status: "delivered",
    progressPercentage: 100,
    weight: 15.0,
    deliveryTimeframe: "2024-2025",
    sourceUrl: "https://www.finegael.ie/manifesto/sovereign-wealth",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Future Ireland Fund established with Apple tax windfall",
      "Infrastructure Investment Framework created",
      "Annual contribution mechanism implemented",
      "Fund governance structures established"
    ],
    achievements: [
      "€14 billion Apple tax windfall secured",
      "Long-term investment strategy developed",
      "Cross-party support achieved for fund structure"
    ]
  },
  {
    title: "Cut income tax by raising lower- & higher-rate thresholds",
    description: "Reduce the tax burden on workers by increasing both lower and higher rate income tax thresholds.",
    party: "ie-fg",
    category: "Taxation",
    status: "in_progress",
    progressPercentage: 50,
    weight: 10.0,
    deliveryTimeframe: "2024-2027",
    sourceUrl: "https://www.finegael.ie/manifesto/taxation",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Budget 2024 increased standard rate threshold",
      "Higher rate threshold adjustment implemented",
      "Further increases planned for Budget 2025"
    ],
    challenges: [
      "Balancing tax cuts with public service funding",
      "Economic conditions affecting implementation timeline"
    ]
  },
  {
    title: "Reduce VAT on food businesses from 13% to 11%",
    description: "Support the hospitality and food service sector by reducing VAT rate from 13% to 11%.",
    party: "ie-fg",
    category: "Taxation",
    status: "not_started",
    progressPercentage: 0,
    weight: 5.0,
    deliveryTimeframe: "2025-2026",
    sourceUrl: "https://www.finegael.ie/manifesto/business-support",
    lastUpdated: new Date(),
    verified: true,
    challenges: [
      "EU state aid considerations",
      "Revenue implications for exchequer",
      "Industry consultation required"
    ]
  },
  {
    title: "Boost first-time-buyer tax rebate",
    description: "Enhance financial support for first-time home buyers through increased tax rebate schemes.",
    party: "ie-fg",
    category: "Housing",
    status: "not_started",
    progressPercentage: 0,
    weight: 5.0,
    deliveryTimeframe: "2025-2026",
    sourceUrl: "https://www.finegael.ie/manifesto/housing",
    lastUpdated: new Date(),
    verified: true,
    challenges: [
      "Designing effective rebate mechanism",
      "Ensuring value for money",
      "Avoiding property price inflation"
    ]
  },
  {
    title: "Extend shared-equity scheme to all home purchasers",
    description: "Expand the shared equity loan scheme beyond first-time buyers to include all home purchasers.",
    party: "ie-fg",
    category: "Housing",
    status: "delivered",
    progressPercentage: 100,
    weight: 5.0,
    deliveryTimeframe: "2024",
    sourceUrl: "https://www.finegael.ie/manifesto/housing-equity",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Legislation passed in 2024",
      "Scheme operational since Q2 2024",
      "First loans approved and distributed"
    ],
    achievements: [
      "Scheme extended to all income levels",
      "Simplified application process implemented",
      "Strong uptake in first year of operation"
    ]
  },
  {
    title: "Maintain rent-pressure zones (RPZs)",
    description: "Continue and strengthen rent pressure zone regulations to protect tenants from excessive rent increases.",
    party: "ie-fg",
    category: "Housing",
    status: "delivered",
    progressPercentage: 100,
    weight: 5.0,
    deliveryTimeframe: "ongoing",
    sourceUrl: "https://www.finegael.ie/manifesto/rental-market",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "RPZ designations maintained across all major urban areas",
      "Enforcement mechanisms strengthened",
      "Regular review process established"
    ],
    achievements: [
      "Rent inflation contained in designated areas",
      "Tenant protections enhanced",
      "Regular monitoring and adjustment of zones"
    ]
  },
  {
    title: "Increase renter tax credit",
    description: "Enhance financial support for renters through increased tax credit allowances.",
    party: "ie-fg",
    category: "Housing",
    status: "delivered",
    progressPercentage: 100,
    weight: 5.0,
    deliveryTimeframe: "2024",
    sourceUrl: "https://www.finegael.ie/manifesto/renter-support",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Tax credit increased in Budget 2024",
      "Eligibility criteria expanded",
      "Simplified claiming process implemented"
    ],
    achievements: [
      "Credit increased from €500 to €750 annually",
      "Extended to include more rental situations",
      "Digital claiming system launched"
    ]
  },
  {
    title: "Legally binding asylum-processing timeframes",
    description: "Establish legally binding timeframes for processing asylum applications to improve system efficiency.",
    party: "ie-fg",
    category: "Immigration & Asylum",
    status: "not_started",
    progressPercentage: 0,
    weight: 5.0,
    deliveryTimeframe: "2025-2026",
    sourceUrl: "https://www.finegael.ie/manifesto/immigration",
    lastUpdated: new Date(),
    verified: true,
    challenges: [
      "Complex legal framework required",
      "Resource allocation for processing capacity",
      "International asylum law compliance"
    ]
  },
  {
    title: "Strengthen border security & create High Court division",
    description: "Enhance border security measures and establish specialized High Court division for immigration cases.",
    party: "ie-fg",
    category: "Immigration & Asylum",
    status: "in_progress",
    progressPercentage: 20,
    weight: 5.0,
    deliveryTimeframe: "2024-2026",
    sourceUrl: "https://www.finegael.ie/manifesto/border-security",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Border security budget increased",
      "High Court division proposal under review",
      "Enhanced cooperation with EU partners"
    ],
    challenges: [
      "Judicial system capacity constraints",
      "Resource allocation for enhanced security",
      "Balancing security with human rights"
    ]
  },
  {
    title: "Restrict movement of asylum applicants in state accommodation",
    description: "Implement movement restrictions for asylum seekers in state-provided accommodation.",
    party: "ie-fg",
    category: "Immigration & Asylum",
    status: "in_progress",
    progressPercentage: 20,
    weight: 5.0,
    deliveryTimeframe: "2024-2025",
    sourceUrl: "https://www.finegael.ie/manifesto/asylum-policy",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Policy framework under development",
      "Legal review of proposed restrictions",
      "Consultation with stakeholders ongoing"
    ],
    challenges: [
      "Human rights compliance considerations",
      "Legal challenges to restrictions",
      "Implementation logistics"
    ]
  },
  {
    title: "Deploy €14 billion windfall to housing, grid, water, transport",
    description: "Strategic deployment of Apple tax windfall across critical infrastructure: housing, electricity grid, water systems, and transport.",
    party: "ie-fg",
    category: "Apple-Tax Windfall",
    status: "in_progress",
    progressPercentage: 20,
    weight: 15.0,
    deliveryTimeframe: "2024-2030",
    sourceUrl: "https://www.finegael.ie/manifesto/infrastructure-investment",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "€14 billion windfall secured from Apple case",
      "Infrastructure investment framework established",
      "Initial project allocations approved",
      "Multi-annual spending plan developed"
    ],
    challenges: [
      "Coordinating across multiple departments",
      "Ensuring value for money in large projects",
      "Managing project delivery timelines",
      "Balancing competing infrastructure priorities"
    ]
  },
  {
    title: "Deepen 'Shared Island' North–South cooperation",
    description: "Strengthen cooperation and collaboration between Ireland and Northern Ireland across multiple policy areas.",
    party: "ie-fg",
    category: "Shared Island",
    status: "in_progress",
    progressPercentage: 50,
    weight: 10.0,
    deliveryTimeframe: "ongoing",
    sourceUrl: "https://www.finegael.ie/manifesto/shared-island",
    lastUpdated: new Date(),
    verified: true,
    keyMilestones: [
      "Shared Island Fund expanded",
      "Cross-border infrastructure projects advanced",
      "Enhanced educational cooperation agreements",
      "Health service collaboration initiatives"
    ],
    challenges: [
      "Political stability in Northern Ireland",
      "Brexit-related complications",
      "Coordinating with UK government policies"
    ]
  }
];

async function addFineGaelWeightedPledges() {
  console.log('Adding Fine Gael weighted pledges to database...');
  
  try {
    // Insert all pledges
    const insertedPledges = await db.insert(pledges).values(fineGaelPledges).returning();
    console.log(`Successfully inserted ${insertedPledges.length} Fine Gael pledges`);

    // Add importance votes for each pledge based on weight
    const pledgeVoteData = [];
    
    for (const pledge of insertedPledges) {
      const originalPledge = fineGaelPledges.find(p => p.title === pledge.title);
      if (originalPledge) {
        // Convert weight percentage to vote count (weight * 10 = number of importance votes)
        const importanceVotes = Math.round(originalPledge.weight * 10);
        
        for (let i = 0; i < importanceVotes; i++) {
          pledgeVoteData.push({
            pledgeId: pledge.id,
            voteType: 'importance',
            value: 5, // High importance
            userId: null, // System-generated votes based on manifesto weighting
            createdAt: new Date()
          });
        }
      }
    }

    // Insert importance votes
    if (pledgeVoteData.length > 0) {
      await db.insert(pledgeVotes).values(pledgeVoteData);
      console.log(`Added ${pledgeVoteData.length} importance votes based on manifesto weightings`);
    }

    // Calculate and display overall completion rate
    const totalWeight = fineGaelPledges.reduce((sum, pledge) => sum + pledge.weight, 0);
    const completedWeight = fineGaelPledges.reduce((sum, pledge) => 
      sum + (pledge.weight * pledge.progressPercentage / 100), 0
    );
    const overallCompletion = (completedWeight / totalWeight * 100).toFixed(1);

    console.log('\n=== Fine Gael Pledge Summary ===');
    console.log(`Total pledges: ${fineGaelPledges.length}`);
    console.log(`Overall weighted completion: ${overallCompletion}%`);
    console.log('\nCategory breakdown:');
    
    const categoryStats = {};
    fineGaelPledges.forEach(pledge => {
      if (!categoryStats[pledge.category]) {
        categoryStats[pledge.category] = { total: 0, completed: 0, count: 0 };
      }
      categoryStats[pledge.category].total += pledge.weight;
      categoryStats[pledge.category].completed += (pledge.weight * pledge.progressPercentage / 100);
      categoryStats[pledge.category].count += 1;
    });

    Object.entries(categoryStats).forEach(([category, stats]) => {
      const completion = (stats.completed / stats.total * 100).toFixed(1);
      console.log(`  ${category}: ${completion}% complete (${stats.count} pledges, ${stats.total}% total weight)`);
    });

  } catch (error) {
    console.error('Error adding Fine Gael pledges:', error);
    throw error;
  }
}

// Run the script
addFineGaelWeightedPledges()
  .then(() => {
    console.log('\nFine Gael weighted pledges successfully added!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to add Fine Gael pledges:', error);
    process.exit(1);
  });