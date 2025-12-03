/**
 * Test Script: News Article Scoring Team
 * 
 * Tests the multi-agent scoring system on a multi-politician article
 */

import 'dotenv/config';
import { NewsArticleScoringTeam } from '../services/multiAgentTDScoring.js';

// Test article: Martin and Harris under pressure after presidential election
const testArticle = {
  id: 18,
  title: "Trouble ahead? Why Connolly's victory ramps up the pressure on both Martin and Harris",
  content: `HOW ARE MICHEÁL Martin and Simon Harris feeling today?

Nervous, probably.

The landslide win for Ireland's new president Catherine Connolly is a warning shot for Fianna Fáil and Fine Gael.

Connolly received a massive mandate from the public, commanding 63% of the vote, something the two leaders cannot ignore.

Both parties fought terrible campaigns and that cannot be without consequence for the pair.

Fianna Fáil notably had the worst presidential election of the two, with Jim Gavin's campaign imploding before it really got off the ground.

The decision to run Gavin in the first place and the whole process around it is now subject to an internal party review which is due to conclude in mid-November.

Once Gavin left the stage, it undoubtedly gave Martin some breathing time to strategise how he is going to handle the fallout.

The number of unhappy Fianna Fáilers is mounting, with some now talking about a change at the top.

Carlow-Kilkenny TD John McGuinness is one of them and while he has long been a critic of the Fianna Fáil leadership, much of what he had to say on RTÉ's This Week programme today is resonating with others in the party now.

Fianna Fail needs a new leader "in the not too distant future", he told the radio show today.

McGuinness said the party's campaign "turned into a shambles" and has resulted in the party standing at 17% in the polls, the same percentage it had in the disastrous year of 2011.

Calling it "a shocking embarrassment" for members of the party, McGuinness said the election has underlined the need for the party to "reinvent itself" for the future.

Leadership past its sell-by-date?

He said Fianna Fáil's policies are past their sell-by-date and the party has stopped responding to the needs of those it claims to represent.

The party should also not be afraid to challenge Europe and the policies that are impacting on our national policy, he said, stating that Catherine Connolly stood on that platform.

"I voted for Connolly and I believe she will be a good president," said McGuinness.

Asked if Fianna Fáil needs a new leader, McGuinness replied: "In due course, yes."

It has been suggested that such a change might come about after Ireland's EU presidency in December next year, but McGuinness said he doesn't think the party can wait until then.

He called for an open discussion "within next ten days" on what needs to happen in the future.

The type of leadership that brought the party back to 17% in the polls needs to be discussed, he said, stating that there needs to be a conversation about future leadership that will return the party to greater success.

"Not to do that would be sticking our heads in the sand," he argued.

This view is widely held in the parliamentary party, said McGuinness, although he acknowledged that there are differing views on how to approach it.

McGuinness' view is also held by MEP Billy Kelleher who called it a disastrous election for the party.

Fianna Fáil TD John Lahart told RTÉ News this evening that he agrees with McGuinness that there must be a discussion about the leadership.

"It is a conversation that the party needs to have. The events of the last few weeks, the result yesterday, and the outcome of the result have brought that conversation forward," Lahart said.

McGuinness and Lahart have previously raised questions around Martin's leadership. Three years ago, both politicians spoke out publicly about Martin, his leadership and the direction of the party while the party leader was in Japan.

At the time, Martin dubbed mutterings of a heave against him as speculation.

A number of Fianna Fáil politicians are understood to be having such conversations. Over the weekend, there was chatter that around 12 Fianna Fáil TDs might push for a no confidence motion in Martin at some point.

However a Fianna Fáil minister dismissed the suggestion, telling The Journal this weekend that it was the "usual suspects" and asserting that they don't have the numbers to challenge the party leader.

Fianna Fáil sources tell The Journal this evening that there might be more to the rumblings than there was three years ago, but for any momentum to pick up a challenger to Martin's leadership would want to speak up soon.

Ireland's EU presidency next year

Martin's leadership will come in for sharp focus in the weeks before Christmas, but as mentioned, many within the party don't believe a change of leadership should take place ahead of or during Ireland holding the EU presidency next year.

While Martin is steadfast in his assertions that he will lead the party into the next general election and that he's going nowhere, the conversation around his leadership is growing louder.

The next few weeks and months could prove crucial for him.

But what about Harris?

While the election might not have been as disastrous for Fine Gael as it was for Fianna Fáil, there is still likely to be fallout.

MEP Seán Kelly told The Journal that there are a lot of people within the party unhappy with how it selected its candidate, stating that it was "big, big mistake" not to hold a vote in the party and for hustings not to be held.

Kelly had been hoping to run himself but called off his campaign after it became clear to him that he would not receive the necessary 20 votes from the parliamentary party to trigger an internal contest.

Harris defended his approach to the process this weekend – stating at Dublin Castle that he never publicly endorsed one candidate over another, only backing Humphreys 100% when she won the nomination. Some in the party say Harris rushed into picking a candidate when Mairead McGuinness withdrew from the nomination in August due to illness.

The party has come close several times to winning the presidency, but has never managed to get a candidate over the line.

Harris was hoping this election might change that and might even give a boost to his party, one that might counter the narrative that Fine Gael is pretty dismal at running effective political campaigns. Unfortunately, it only reinforced that narrative.

So, whose leadership is more at risk?

Martin's will come under the most pressure in the coming days. Harris isn't home-free though. Lots of questions remain, and party members will be seeking answers.`,
  source: "The Journal"
};

// Politicians to score from this article
const politicians = [
  {
    name: "Micheál Martin",
    party: "Fianna Fáil",
    constituency: "Cork South-Central",
    isGovernment: true,
    role: "Taoiseach"
  },
  {
    name: "Simon Harris",
    party: "Fine Gael", 
    constituency: "Wicklow",
    isGovernment: true,
    role: "Tánaiste"
  }
];

async function runTest() {
  console.log('\n' + '█'.repeat(70));
  console.log('█  NEWS ARTICLE SCORING TEAM - MULTI-POLITICIAN TEST');
  console.log('█'.repeat(70));
  console.log(`\n📰 Article: "${testArticle.title}"`);
  console.log(`📅 Source: ${testArticle.source}`);
  console.log(`👥 Politicians: ${politicians.map(p => p.name).join(', ')}`);
  
  const results: any[] = [];
  
  for (const politician of politicians) {
    console.log('\n' + '═'.repeat(70));
    console.log(`\n🎯 SCORING: ${politician.name} (${politician.party})`);
    console.log('═'.repeat(70));
    
    // Check escalation
    const { shouldEscalate, reason } = NewsArticleScoringTeam.shouldEscalate(
      testArticle,
      politician,
      undefined  // No initial analysis
    );
    
    console.log(`\n   Escalation Check: ${shouldEscalate ? '✅ YES' : '❌ NO'}`);
    console.log(`   Reason: ${reason}`);
    
    const startTime = Date.now();
    
    try {
      const result = await NewsArticleScoringTeam.runTeamScoring(
        testArticle,
        politician,
        reason || 'Multi-politician test'
      );
      
      results.push({
        politician: politician.name,
        party: politician.party,
        ...result.consensusScores,
        agreementLevel: result.arbitratorReport.agreementLevel,
        agentsDeployed: result.managerDecision.agentsDeployed.length,
        processingTime: ((Date.now() - startTime) / 1000).toFixed(1),
        ideologyAnalysis: result.ideologyAnalysis
      });
      
      // Brief summary
      console.log(`\n   📊 RESULT for ${politician.name}:`);
      console.log(`      Overall Impact: ${result.consensusScores.overallImpact}`);
      console.log(`      Integrity: ${result.consensusScores.integrityScore ?? 'N/A'}`);
      console.log(`      Effectiveness: ${result.consensusScores.effectivenessScore ?? 'N/A'}`);
      console.log(`      Agreement: ${result.arbitratorReport.agreementLevel}`);
      
    } catch (error) {
      console.error(`\n   ❌ FAILED for ${politician.name}:`, error);
      results.push({
        politician: politician.name,
        party: politician.party,
        error: true
      });
    }
  }
  
  // Comparison table
  console.log('\n' + '█'.repeat(70));
  console.log('█  COMPARISON: SAME ARTICLE, DIFFERENT POLITICIANS');
  console.log('█'.repeat(70));
  
  console.log('\n┌─────────────────┬────────┬───────────┬───────────────┬───────────┬───────────┐');
  console.log('│ Politician      │ Impact │ Integrity │ Effectiveness │ Agreement │ Time      │');
  console.log('├─────────────────┼────────┼───────────┼───────────────┼───────────┼───────────┤');
  
  for (const r of results) {
    if (r.error) {
      console.log(`│ ${r.politician.padEnd(15)} │ ERROR  │           │               │           │           │`);
    } else {
      const impact = String(r.overallImpact).padStart(6);
      const integrity = r.integrityScore !== null ? String(r.integrityScore).padStart(9) : '      N/A';
      const effectiveness = r.effectivenessScore !== null ? String(r.effectivenessScore).padStart(13) : '          N/A';
      const agreement = r.agreementLevel.padEnd(9);
      const time = `${r.processingTime}s`.padStart(9);
      console.log(`│ ${r.politician.padEnd(15)} │ ${impact} │ ${integrity} │ ${effectiveness} │ ${agreement} │ ${time} │`);
    }
  }
  
  console.log('└─────────────────┴────────┴───────────┴───────────────┴───────────┴───────────┘');
  
  // Ideology Analysis
  console.log('\n' + '─'.repeat(70));
  console.log('🧭 IDEOLOGY ANALYSIS');
  console.log('─'.repeat(70));
  
  for (const r of results) {
    if (r.error || !r.ideologyAnalysis) continue;
    
    console.log(`\n${r.politician} (${r.party}):`);
    
    if (r.ideologyAnalysis.policyStance) {
      console.log(`   Policy: ${r.ideologyAnalysis.policyStance.policyTopic}`);
      console.log(`   Stance: ${r.ideologyAnalysis.policyStance.stance} (strength: ${r.ideologyAnalysis.policyStance.strength}/5)`);
      console.log(`   Evidence: "${r.ideologyAnalysis.policyStance.evidence.substring(0, 100)}..."`);
    } else {
      console.log(`   No clear policy stance detected`);
    }
    
    console.log(`   Direction: ${r.ideologyAnalysis.policyDirection || 'N/A'}`);
    console.log(`   Is Ideological: ${r.ideologyAnalysis.isIdeologicalPolicy ? 'Yes' : 'No'}`);
    
    // Show ideology shifts
    const shifts = Object.entries(r.ideologyAnalysis.ideologyDelta)
      .filter(([_, v]) => Math.abs(v as number) >= 0.05)
      .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number));
    
    if (shifts.length > 0) {
      console.log(`   Ideology Signals:`);
      for (const [dim, val] of shifts) {
        const bar = (val as number) > 0 ? '→'.repeat(Math.round(Math.abs(val as number) * 10)) : '←'.repeat(Math.round(Math.abs(val as number) * 10));
        const label = (val as number) > 0 ? 'right/conservative' : 'left/progressive';
        console.log(`      ${dim.padEnd(12)}: ${(val as number) > 0 ? '+' : ''}${(val as number).toFixed(2)} ${bar} (${label})`);
      }
    } else {
      console.log(`   Ideology Signals: None detected`);
    }
  }
  
  // Analysis
  if (results.length === 2 && !results[0].error && !results[1].error) {
    const [martin, harris] = results;
    console.log('\n📈 OVERALL ANALYSIS:');
    
    const impactDiff = martin.overallImpact - harris.overallImpact;
    if (impactDiff < 0) {
      console.log(`   • Martin scored ${Math.abs(impactDiff)} points WORSE than Harris`);
    } else if (impactDiff > 0) {
      console.log(`   • Martin scored ${impactDiff} points BETTER than Harris`);
    } else {
      console.log(`   • Both scored the same impact`);
    }
    
    console.log(`   • Article describes Martin's situation as more dire (FF at 17%, leadership challenge)`);
    console.log(`   • Harris has criticism but less existential threat`);
  }
  
  console.log('\n' + '█'.repeat(70));
  console.log('█  TEST COMPLETE');
  console.log('█'.repeat(70) + '\n');
}

runTest();
