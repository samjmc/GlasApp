/**
 * Test Script: Ideology Scoring on Policy Article
 * 
 * Tests the Ideology Analyst on an article with clear policy positions
 */

import 'dotenv/config';
import { NewsArticleScoringTeam } from '../services/multiAgentTDScoring.js';

// IPAS rent policy article - multiple politicians with clear stances
const testArticle = {
  id: 27,
  title: "Charging rent to working IPAS residents 'appropriate'",
  content: `Minister for Justice Jim O'Callaghan has said he considers the proposals to charge rent to people living in IPAS centres who are working "appropriate".

Ministers will meet to discuss signing off on contributions of between €15 and €238 per week, depending on earnings.

Mr O'Callaghan said they are the proposals he was asked to consider and bring forward with Minister of State for Migration Colm Brophy before the Cabinet sub-committee on migration this evening.

"Ultimately they will be a matter for the Government but they are proposals we are recommending and we do believe they are appropriate," Mr O'Callaghan said.

Asked if he is concerned about the number of Ukrainians coming to Ireland recently and his plans to address this, the minister acknowledged the significant increase in the number of arrivals into the country since September.

He said another proposal being brought before the Cabinet sub-committee was that the amount of time that State accommodation is provided to Ukrainian people be reduced from 90 days.

More than 100,000 Ukrainians have come to Ireland since 2022, with around 80,000 here today.

Ministers are considering reducing the entitlement for new arrivals from Ukraine to 30 days of State accommodation.

Mr O'Callaghan said that compared to other countries in Europe, Ireland was more generous in terms of the accommodation offered to international protection applicants and those seeking temporary protection from Ukraine.

"When you look at Ireland in comparison to other EU countries, what we are offering in terms of accommodation is much more generous than other EU countries," he said.

Sinn Féin Justice spokesperson Matt Carthy said proposals to charge those in IPAS accommodation rent if they are working, was a reannouncement by the Government.

"It's 14 months since the Government made this exact same proposal previously. I think that's symbolic of a 'do nothing' Government who are big on making statements but actually very weak in terms of taking decisive action and tackling the dysfunction within the IPAS system," he said.

He said the dysfunction came from the length of time to process applications, the enforcement of decisions "and the obscene profiteering that is taking place within the IPAS system."

He said it was "absolutely logical" that anyone in receipt of state-supported accommodation "would pay according to their means".

Social Democrats TD Sinéad Gibney said it was "quite shocking" that following the attack on an IPAS centre in Drogheda on Friday, that "the first item the Government is willing to discuss, in this whole area is payment from IPAS applicants."

She said there were now much bigger concerns around the security of people in International Protection.

Ms Gibney said that in her experience, people in Direct Provision and in the International Protection system were willing and eager to contribute to society and pay taxes.

However, she said asking them for money was problematic in the context of the ongoing accommodation crisis, where many people could not access private rental accommodation as an alternative.

"That money could be better directed towards savings for actually trying to live independently once that asylum has been granted to people," she said.

"There is a housing crisis that is affecting everybody, that affects certain groups within society a lot more acutely than others."

She said the Government would not make a lot of money from charging 15 to 200 plus euro each week.

"I think it sits in the context of a number of measures which this Government is championing within the international protection system which are regressive.

"They're all measures which speak to making it firmer and there's very little the government is doing to make the system fairer."`,
  source: "RTE News"
};

// Politicians with different stances
const politicians = [
  {
    name: "Jim O'Callaghan",
    party: "Fianna Fáil",
    constituency: "Dublin Bay South",
    isGovernment: true,
    role: "Minister for Justice"
  },
  {
    name: "Matt Carthy",
    party: "Sinn Féin",
    constituency: "Cavan-Monaghan",
    isGovernment: false,
    role: "Justice spokesperson"
  },
  {
    name: "Sinéad Gibney",
    party: "Social Democrats",
    constituency: "Dublin Bay North",
    isGovernment: false,
    role: "TD"
  }
];

async function runTest() {
  console.log('\n' + '█'.repeat(70));
  console.log('█  IDEOLOGY SCORING TEST - IPAS POLICY ARTICLE');
  console.log('█'.repeat(70));
  console.log(`\n📰 "${testArticle.title}"`);
  console.log(`\nThis article should show CLEAR ideology signals as politicians take`);
  console.log(`different positions on immigration/welfare policy.\n`);
  
  const results: any[] = [];
  
  for (const politician of politicians) {
    console.log('─'.repeat(70));
    console.log(`🎯 ${politician.name} (${politician.party})`);
    console.log('─'.repeat(70));
    
    try {
      const result = await NewsArticleScoringTeam.runTeamScoring(
        testArticle,
        politician,
        'Policy article - ideology test'
      );
      
      results.push({
        politician: politician.name,
        party: politician.party,
        impact: result.consensusScores.overallImpact,
        ideology: result.ideologyAnalysis
      });
      
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
    }
  }
  
  // Summary comparison
  console.log('\n' + '█'.repeat(70));
  console.log('█  IDEOLOGY COMPARISON');
  console.log('█'.repeat(70));
  
  for (const r of results) {
    console.log(`\n┌─ ${r.politician} (${r.party})`);
    console.log(`│  Impact: ${r.impact}`);
    
    if (r.ideology?.policyStance) {
      console.log(`│  Policy: ${r.ideology.policyStance.policyTopic}`);
      console.log(`│  Stance: ${r.ideology.policyStance.stance.toUpperCase()} (strength ${r.ideology.policyStance.strength}/5)`);
      console.log(`│  Direction: ${r.ideology.policyDirection}`);
    }
    
    console.log(`│`);
    console.log(`│  IDEOLOGY SHIFTS:`);
    
    const dims = ['economic', 'social', 'cultural', 'authority', 'welfare', 'globalism'];
    for (const dim of dims) {
      const val = r.ideology?.ideologyDelta?.[dim] || 0;
      if (Math.abs(val) >= 0.05) {
        const bar = val > 0 
          ? '▓'.repeat(Math.round(val * 20)) 
          : '░'.repeat(Math.round(Math.abs(val) * 20));
        const direction = val > 0 ? '→ right' : '← left';
        console.log(`│    ${dim.padEnd(12)}: ${val > 0 ? '+' : ''}${val.toFixed(2)} ${bar} ${direction}`);
      }
    }
    console.log(`└─`);
  }
  
  console.log('\n' + '█'.repeat(70));
  console.log('█  TEST COMPLETE');
  console.log('█'.repeat(70) + '\n');
}

runTest();

