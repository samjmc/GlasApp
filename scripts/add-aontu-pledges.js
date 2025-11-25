/**
 * Script to add Aontú pledges with efficiency scoring system
 * Based on performance relative to number of TDs (2 TDs)
 */

const { db } = require('../server/db.ts');
const { pledges, pledgeActions } = require('../shared/schema.ts');

async function addAontuPledges() {
  console.log('Adding Aontú pledge data with efficiency scoring...');

  const aontuPartyId = 8; // Aontú party ID
  const numberOfTDs = 2; // Aontú has 2 TDs

  const aontuPledges = [
    {
      partyId: aontuPartyId,
      title: "Bring 8,000 vacant homes back into use by 2030",
      description: "Detailed vacant homes plan to address housing crisis by bringing empty properties back into productive use",
      category: "Housing",
      electionYear: 2024,
      targetDate: "2030-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 25.0,
      currentScore: 0.0,
      efficiencyScore: 0.0, // 0.00 pp/TD
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Reverse excise cuts on petrol/diesel & cut hospitality VAT to 9% permanently",
      description: "Economic plan to adjust fuel taxation while supporting hospitality sector through permanent VAT reduction",
      category: "Economy",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 15.0,
      currentScore: 0.0,
      efficiencyScore: 0.0, // 0.00 pp/TD
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "'Operation Shamrock' repatriation package",
      description: "Comprehensive immigration policy including eleven-page blueprint for managed repatriation and asylum reform",
      category: "Immigration",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 20.0,
      currentScore: 15.0,
      efficiencyScore: 1.5, // 1.50 pp/TD (15% ÷ 2 TDs)
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Patient-engagement funding model for healthcare",
      description: "Proposed wholesale change in health funding model to improve patient outcomes and system efficiency",
      category: "Healthcare",
      electionYear: 2024,
      targetDate: "2026-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 10.0,
      currentScore: 0.0,
      efficiencyScore: 0.0, // 0.00 pp/TD
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Preserve the 'Triple Lock' on troop deployments",
      description: "Maintain parliamentary oversight on military deployments through continued Triple Lock mechanism",
      category: "Defence",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.rte.ie/news/ireland/2025/0316/1502199-triple-lock-explainer/",
      weight: 5.0,
      currentScore: 20.0,
      efficiencyScore: 0.5, // 0.50 pp/TD (20% ÷ 2 TDs × 5% weight = 1.0pp ÷ 2 TDs)
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "New 'international-class' west-coast city",
      description: "Bold regional development proposal for major new urban center on Ireland's west coast",
      category: "Regional Development",
      electionYear: 2024,
      targetDate: "2030-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 5.0,
      currentScore: 0.0,
      efficiencyScore: 0.0, // 0.00 pp/TD
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Repeal Gender Recognition Act",
      description: "Legislative proposal to reverse current gender recognition legislation",
      category: "Social Policy",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://en.wikipedia.org/wiki/Aont%C3%BA",
      weight: 5.0,
      currentScore: 5.0,
      efficiencyScore: 0.13, // 0.13 pp/TD (5% × 5% weight = 0.25pp ÷ 2 TDs)
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Sanctions on Israeli settlements",
      description: "Trade ban and ethics audit on Israeli settlement products in response to Palestinian situation",
      category: "Foreign Policy",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://en.wikipedia.org/wiki/Aont%C3%BA",
      weight: 5.0,
      currentScore: 5.0,
      efficiencyScore: 0.13, // 0.13 pp/TD (5% × 5% weight = 0.25pp ÷ 2 TDs)
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "'Operation Shamrock' emigrant incentives",
      description: "Detailed incentive package to encourage Irish emigrants to return home",
      category: "Immigration",
      electionYear: 2024,
      targetDate: "2026-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      weight: 5.0,
      currentScore: 10.0,
      efficiencyScore: 0.25, // 0.25 pp/TD (10% × 5% weight = 0.5pp ÷ 2 TDs)
      numberOfTDs: numberOfTDs
    },
    {
      partyId: aontuPartyId,
      title: "Link pensions to inflation & reinstate occupational pensions",
      description: "Comprehensive pension reform to protect purchasing power and restore workplace pension schemes",
      category: "Social Security",
      electionYear: 2024,
      targetDate: "2026-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://en.wikipedia.org/wiki/Aont%C3%BA",
      weight: 5.0,
      currentScore: 0.0,
      efficiencyScore: 0.0, // 0.00 pp/TD
      numberOfTDs: numberOfTDs
    }
  ];

  // Calculate overall efficiency score
  const totalContribution = aontuPledges.reduce((sum, pledge) => 
    sum + (pledge.currentScore * pledge.weight / 100), 0);
  const overallEfficiencyScore = totalContribution / numberOfTDs;

  console.log(`Aontú Total Contribution: ${totalContribution.toFixed(2)} pp`);
  console.log(`Aontú Overall Efficiency: ${overallEfficiencyScore.toFixed(2)} pp/TD`);

  try {
    // Insert pledges
    for (const pledge of aontuPledges) {
      const [insertedPledge] = await db.insert(pledges).values({
        partyId: pledge.partyId,
        title: pledge.title,
        description: pledge.description,
        category: pledge.category,
        electionYear: pledge.electionYear,
        targetDate: pledge.targetDate,
        scoreType: pledge.scoreType,
        sourceUrl: pledge.sourceUrl,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();

      console.log(`✅ Added pledge: ${pledge.title}`);

      // Add pledge action with scoring details
      await db.insert(pledgeActions).values({
        pledgeId: insertedPledge.id,
        actionType: 'scoring_update',
        description: `Current fulfillment: ${pledge.currentScore}% (Weight: ${pledge.weight}%, Efficiency: ${pledge.efficiencyScore} pp/TD)`,
        actionDate: new Date(),
        sourceUrl: pledge.sourceUrl,
        evidence: `Score: ${pledge.currentScore}%, Weight: ${pledge.weight}%, TDs: ${pledge.numberOfTDs}, Efficiency: ${pledge.efficiencyScore} pp/TD`,
        createdAt: new Date()
      });
    }

    // Add overall party efficiency summary
    const summaryPledge = await db.insert(pledges).values({
      partyId: aontuPartyId,
      title: "Aontú Overall Performance Summary",
      description: `Overall party efficiency score based on ${numberOfTDs} TDs. Total contribution: ${totalContribution.toFixed(2)} pp, Efficiency: ${overallEfficiencyScore.toFixed(2)} pp/TD`,
      category: "Performance Summary",
      electionYear: 2024,
      targetDate: "2025-12-31",
      scoreType: "efficiency",
      sourceUrl: "https://www.irishexaminer.com/news/politics/arid-41521676.html",
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    await db.insert(pledgeActions).values({
      pledgeId: summaryPledge[0].id,
      actionType: 'efficiency_calculation',
      description: `Party efficiency: ${overallEfficiencyScore.toFixed(2)} pp/TD based on ${numberOfTDs} TDs`,
      actionDate: new Date(),
      evidence: `Total pledges: ${aontuPledges.length}, Total contribution: ${totalContribution.toFixed(2)} pp, TDs: ${numberOfTDs}, Efficiency: ${overallEfficiencyScore.toFixed(2)} pp/TD`,
      createdAt: new Date()
    });

    console.log(`\n🎯 Aontú Performance Summary:`);
    console.log(`   • Total Pledges: ${aontuPledges.length}`);
    console.log(`   • Number of TDs: ${numberOfTDs}`);
    console.log(`   • Total Contribution: ${totalContribution.toFixed(2)} pp`);
    console.log(`   • Overall Efficiency: ${overallEfficiencyScore.toFixed(2)} pp/TD`);
    console.log(`\n✅ Successfully added all Aontú pledges with efficiency scoring!`);

  } catch (error) {
    console.error('❌ Error adding Aontú pledges:', error);
    throw error;
  }
}

// Run the script
addAontuPledges()
  .then(() => {
    console.log('Aontú pledges import completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error in main process:', err);
    process.exit(1);
  });