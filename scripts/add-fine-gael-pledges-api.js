/**
 * Script to add Fine Gael pledges scorecard via API
 */

const pledges = [
  {
    partyId: 1,
    title: "Cap day-to-day spending growth at 5% per year",
    description: "Cap day-to-day spending growth at 5% per year to allow expenditure growth while maintaining fiscal discipline.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Transfer 0.8% of GDP into sovereign-wealth & climate/infrastructure funds each year",
    description: "Establish and fund sovereign wealth and infrastructure funds with 0.8% of GDP annually.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Cut income tax by raising lower- & higher-rate entry points",
    description: "Reduce income tax burden by increasing the thresholds for lower and higher tax rate bands.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Reduce VAT on food businesses from 13% to 11%",
    description: "Lower the VAT rate for food businesses to support the hospitality sector.",
    category: "Economy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Boost first-time-buyer tax rebate",
    description: "Increase tax rebates available to first-time homebuyers to support home ownership.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Extend shared-equity scheme to all homes",
    description: "Expand the shared equity scheme beyond new builds to include all types of homes.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Maintain rent-pressure zones (RPZs)",
    description: "Keep rent pressure zones in place to protect tenants from excessive rent increases.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Increase renter tax credit",
    description: "Raise the tax credit available to renters to help with housing costs.",
    category: "Housing",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Legally binding asylum-processing timeframes",
    description: "Establish legally binding timeframes for processing asylum applications.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Strengthen border security & dedicated High Court division",
    description: "Enhance border security measures and create a dedicated High Court division for immigration cases.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Restrict movement of asylum applicants",
    description: "Implement restrictions on the movement of asylum applicants during processing.",
    category: "Immigration",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Deploy €14 billion Apple-tax windfall to housing, grid, water, transport",
    description: "Use the Apple tax windfall for infrastructure investments in housing, electricity grid, water systems, and transport.",
    category: "Infrastructure",
    electionYear: 2024,
    targetDate: "2026-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  },
  {
    partyId: 1,
    title: "Deepen 'Shared Island' North–South cooperation",
    description: "Strengthen cooperation between Ireland and Northern Ireland through the Shared Island initiative.",
    category: "Foreign Policy",
    electionYear: 2024,
    targetDate: "2025-12-31",
    sourceUrl: "https://www.finegael.ie/manifesto"
  }
];

console.log('Fine Gael Pledges for Manual Entry:');
console.log('=====================================');

pledges.forEach((pledge, index) => {
  console.log(`\n${index + 1}. ${pledge.title}`);
  console.log(`Party: Fine Gael (ID: ${pledge.partyId})`);
  console.log(`Category: ${pledge.category}`);
  console.log(`Description: ${pledge.description}`);
  console.log(`Target Date: ${pledge.targetDate}`);
  console.log(`Source: ${pledge.sourceUrl}`);
});

console.log(`\n\nTotal pledges to add: ${pledges.length}`);
console.log('\nUse the admin interface to add these pledges manually.');