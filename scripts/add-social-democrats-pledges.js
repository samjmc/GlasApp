/**
 * Script to add Social Democrats pledges with efficiency scoring system
 * Based on performance relative to number of TDs (6 TDs)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { pledges } from '../shared/schema.ts';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function addSocialDemocratsPledges() {
  try {
    console.log('Adding Social Democrats pledges...');

    const socialDemocratsPledges = [
      {
        partyId: 6, // Social Democrats
        title: 'Build 50,000 affordable purchase homes & 25,000 cost-rental homes',
        description: 'Red-line in manifesto; plan published Nov 2024 but no government commitment to target increase yet',
        category: 'Housing',
        electionYear: 2024,
        targetDate: new Date('2029-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '15.00',
        evidence: 'Red-line in manifesto; plan published Nov 2024 but no government commitment to target increase yet',
        sourceUrl: 'https://www.socialdemocrats.ie/our-policies/general-election-manifesto-2024/',
        defaultWeight: 20.00
      },
      {
        partyId: 6,
        title: 'Fully implement Sláintecare',
        description: 'SD\'s red-line: Sláintecare review cites SD proposals; limited budget allocated but rollout remains slow',
        category: 'Health',
        electionYear: 2024,
        targetDate: new Date('2029-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '20.00',
        evidence: 'SD\'s red-line: Sláintecare review cites SD proposals; limited budget allocated but rollout remains slow',
        sourceUrl: 'https://www.socialdemocrats.ie/wp-content/uploads/2024/11/HealthSocialCare.pdf',
        defaultWeight: 20.00
      },
      {
        partyId: 6,
        title: 'Climate plan: reach 2030 targets & avoid €8bn fines',
        description: 'Pledged full climate-plan overhaul; Govt\'s revised Climate Action Plan (Dec \'24) reflects some SD funding proposals',
        category: 'Environment',
        electionYear: 2024,
        targetDate: new Date('2030-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '15.00',
        evidence: 'Pledged full climate-plan overhaul; Govt\'s revised Climate Action Plan (Dec \'24) reflects some SD funding proposals',
        sourceUrl: 'https://www.socialdemocrats.ie/soc-dems-launch-climate-action-and-nature-protection-policy/',
        defaultWeight: 15.00
      },
      {
        partyId: 6,
        title: 'Appoint full cabinet Minister for Disability',
        description: 'Red-line in manifesto; Govt named a Minister of State but not full cabinet post',
        category: 'Social Affairs',
        electionYear: 2024,
        targetDate: new Date('2025-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '10.00',
        evidence: 'Red-line in manifesto; Govt named a Minister of State but not full cabinet post',
        sourceUrl: 'https://www.socialdemocrats.ie/our-policies/general-election-manifesto-2024/',
        defaultWeight: 10.00
      },
      {
        partyId: 6,
        title: 'Build high-quality public childcare',
        description: 'Red-line in manifesto; SD roundtables/media push led to new Dept. working group—but no cap or funding yet',
        category: 'Social Affairs',
        electionYear: 2024,
        targetDate: new Date('2029-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '20.00',
        evidence: 'Red-line in manifesto; SD roundtables/media push led to new Dept. working group—but no cap or funding yet',
        sourceUrl: 'https://www.socialdemocrats.ie/our-policies/general-election-manifesto-2024/',
        defaultWeight: 10.00
      },
      {
        partyId: 6,
        title: 'Ban bulk purchase of housing & clampdown on short-term lets',
        description: 'Housing-policy launch Nov \'24; Govt discussion of bulk-buyer levy but no legislation yet',
        category: 'Housing',
        electionYear: 2024,
        targetDate: new Date('2026-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '10.00',
        evidence: 'Housing-policy launch Nov \'24; Govt discussion of bulk-buyer levy but no legislation yet',
        sourceUrl: 'https://www.socialdemocrats.ie/soc-dems-launch-housing-policy/',
        defaultWeight: 5.00
      },
      {
        partyId: 6,
        title: 'Referendum to enshrine "right to a home" in Constitution',
        description: 'Pledged constitutional referendum; no commit or committee debate so far',
        category: 'Housing',
        electionYear: 2024,
        targetDate: new Date('2029-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '0.00',
        evidence: 'Pledged constitutional referendum; no commit or committee debate so far',
        sourceUrl: 'https://www.socialdemocrats.ie/soc-dems-launch-housing-policy/',
        defaultWeight: 5.00
      },
      {
        partyId: 6,
        title: 'Legislate a legal entitlement to healthcare',
        description: 'SD manifesto red-line; no draft bill introduced; Sláintecare targets still non-statutory',
        category: 'Health',
        electionYear: 2024,
        targetDate: new Date('2029-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '0.00',
        evidence: 'SD manifesto red-line; no draft bill introduced; Sláintecare targets still non-statutory',
        sourceUrl: 'https://www.socialdemocrats.ie/wp-content/uploads/2024/11/HealthSocialCare.pdf',
        defaultWeight: 5.00
      },
      {
        partyId: 6,
        title: 'Target +5,000 extra hospital beds by 2030',
        description: 'Health PDF red-line; Dept. has ring-fenced funds for some beds but far short of 5,000',
        category: 'Health',
        electionYear: 2024,
        targetDate: new Date('2030-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '10.00',
        evidence: 'Health PDF red-line; Dept. has ring-fenced funds for some beds but far short of 5,000',
        sourceUrl: 'https://www.socialdemocrats.ie/wp-content/uploads/2024/11/HealthSocialCare.pdf',
        defaultWeight: 5.00
      },
      {
        partyId: 6,
        title: 'Establish National Workforce Task Force (Health & Social Care)',
        description: 'SD proposal accepted in part: Govt set up Health workforce group but lacking statutory teeth',
        category: 'Health',
        electionYear: 2024,
        targetDate: new Date('2026-12-31'),
        status: 'active',
        scoreType: 'fulfillment',
        score: '15.00',
        evidence: 'SD proposal accepted in part: Govt set up Health workforce group but lacking statutory teeth',
        sourceUrl: 'https://www.socialdemocrats.ie/wp-content/uploads/2024/11/HealthSocialCare.pdf',
        defaultWeight: 5.00
      }
    ];

    // Insert all pledges
    for (const pledge of socialDemocratsPledges) {
      await db.insert(pledges).values({
        partyId: pledge.partyId,
        title: pledge.title,
        description: pledge.description,
        category: pledge.category,
        electionYear: pledge.electionYear,
        targetDate: pledge.targetDate,
        status: pledge.status,
        scoreType: pledge.scoreType,
        score: pledge.score,
        evidence: pledge.evidence,
        sourceUrl: pledge.sourceUrl,
        defaultWeight: pledge.defaultWeight,
        lastUpdated: new Date(),
        createdAt: new Date()
      });
    }

    console.log(`✅ Successfully added ${socialDemocratsPledges.length} Social Democrats pledges`);
    
    // Calculate and display efficiency metrics
    const totalContribution = socialDemocratsPledges.reduce((sum, pledge) => {
      const score = parseFloat(pledge.score);
      const weight = pledge.defaultWeight;
      return sum + (score * weight) / 100;
    }, 0);
    
    const numberOfTDs = 6; // Social Democrats have 6 TDs (corrected from table note of 11)
    const efficiencyScore = totalContribution / numberOfTDs;
    
    console.log(`📊 Social Democrats Efficiency Metrics:`);
    console.log(`   • Total Contribution: ${totalContribution.toFixed(2)} pp`);
    console.log(`   • Number of TDs: ${numberOfTDs}`);
    console.log(`   • Efficiency Score: ${efficiencyScore.toFixed(3)} pp/TD`);
    console.log(`   • Expected from table: 1.273 pp/TD (with 11 TDs)`);
    console.log(`   • Actual with 6 TDs: ${(14.00 / 6).toFixed(3)} pp/TD`);

  } catch (error) {
    console.error('❌ Error adding Social Democrats pledges:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
addSocialDemocratsPledges();