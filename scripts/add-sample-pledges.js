/**
 * Script to add sample pledge data for the current Irish government
 * Based on Programme for Government 2020-2025 commitments
 */

import { db } from '../server/db.js';
import { pledges, pledgeActions } from '../shared/schema.js';

async function addSamplePledges() {
  console.log('Adding sample pledge data...');

  // Sample pledges from current Irish government programme
  const samplePledges = [
    // Fine Gael pledges
    {
      partyId: 1, // Fine Gael
      title: "Deliver 33,000 new homes annually by 2025",
      description: "Government commitment to significantly increase housing supply through state-led delivery, including social and affordable housing.",
      category: "Housing",
      electionYear: 2020,
      targetDate: "2025-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },
    {
      partyId: 1, // Fine Gael
      title: "Reduce hospital waiting lists by 30%",
      description: "Commitment to significantly reduce waiting times for hospital procedures and outpatient appointments through increased capacity and efficiency measures.",
      category: "Healthcare",
      electionYear: 2020,
      targetDate: "2024-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },
    {
      partyId: 1, // Fine Gael
      title: "Achieve 7% annual reduction in emissions",
      description: "Government commitment to meet EU climate targets through the Climate Action Plan, including renewable energy expansion and carbon taxation.",
      category: "Environment",
      electionYear: 2020,
      targetDate: "2030-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },

    // Fianna Fáil pledges
    {
      partyId: 2, // Fianna Fáil
      title: "Introduce new pension auto-enrolment system",
      description: "Establish automatic pension enrollment for workers to improve retirement security and pension coverage across the workforce.",
      category: "Social Welfare",
      electionYear: 2020,
      targetDate: "2024-09-30",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },
    {
      partyId: 2, // Fianna Fáil
      title: "Deliver National Broadband Plan to 1.1 million premises",
      description: "Complete rollout of high-speed broadband to rural and underserved areas through the National Broadband Plan infrastructure project.",
      category: "Technology",
      electionYear: 2020,
      targetDate: "2026-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },

    // Sinn Féin pledges (Opposition)
    {
      partyId: 3, // Sinn Féin
      title: "Establish public healthcare system free at point of use",
      description: "Sinn Féin proposal to replace the current two-tier health system with a universal public health service similar to the NHS model.",
      category: "Healthcare",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.sinnfein.ie/contents/54570"
    },
    {
      partyId: 3, // Sinn Féin
      title: "Deliver 100,000 public homes over five years",
      description: "Major public housing construction programme to address housing crisis through direct state building of social and affordable homes.",
      category: "Housing",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.sinnfein.ie/contents/54570"
    },
    {
      partyId: 3, // Sinn Féin
      title: "Reunification referendum within 5 years",
      description: "Commitment to work towards holding a border poll on Irish reunification within a five-year timeframe.",
      category: "Foreign Affairs",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.sinnfein.ie/contents/54570"
    },

    // Green Party pledges (Coalition partner)
    {
      partyId: 4, // Green Party
      title: "Retrofit 500,000 homes by 2030",
      description: "Massive home energy efficiency programme to reduce emissions and energy costs through insulation and heating system upgrades.",
      category: "Environment",
      electionYear: 2020,
      targetDate: "2030-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },
    {
      partyId: 4, // Green Party
      title: "Ban on new fossil fuel exploration licenses",
      description: "Prohibition on issuing new licenses for oil and gas exploration offshore Ireland as part of climate action commitments.",
      category: "Environment",
      electionYear: 2020,
      targetDate: "2021-12-31",
      scoreType: "fulfillment",
      sourceUrl: "https://www.gov.ie/en/publication/7e05d-programme-for-government-our-shared-future/"
    },

    // Labour Party pledges (Opposition)
    {
      partyId: 5, // Labour Party
      title: "Establish National Care Service",
      description: "Create a comprehensive public care service for elderly and disabled people, similar to the HSE model for healthcare provision.",
      category: "Social Welfare",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.labour.ie/download/labour_manifesto_2020.pdf"
    },
    {
      partyId: 5, // Labour Party
      title: "Introduce 4-day working week pilot programme",
      description: "Trial programme for shorter working week to improve work-life balance and productivity across public and private sectors.",
      category: "Economy",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.labour.ie/download/labour_manifesto_2020.pdf"
    },

    // Social Democrats pledges (Opposition)
    {
      partyId: 6, // Social Democrats
      title: "Introduce right to housing constitutional amendment",
      description: "Constitutional change to enshrine housing as a fundamental right, enabling stronger state intervention in housing market.",
      category: "Housing",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.socialdemocrats.ie/our-plan/"
    },
    {
      partyId: 6, // Social Democrats
      title: "Establish independent anti-corruption agency",
      description: "Create new statutory body with powers to investigate corruption in public office and political institutions.",
      category: "Justice",
      electionYear: 2020,
      scoreType: "advocacy",
      sourceUrl: "https://www.socialdemocrats.ie/our-plan/"
    }
  ];

  // Sample actions for some pledges
  const sampleActions = [
    // Actions for housing delivery pledge
    {
      pledgeTitle: "Deliver 33,000 new homes annually by 2025",
      actions: [
        {
          actionType: "policy_implemented",
          description: "Housing for All strategy launched with €4 billion annual investment commitment",
          actionDate: "2021-09-02",
          impactScore: 8.5,
          sourceUrl: "https://www.gov.ie/en/publication/ef5ec-housing-for-all-a-new-housing-plan-for-ireland/"
        },
        {
          actionType: "budget_allocated",
          description: "€2.8 billion allocated for housing in Budget 2024, largest ever housing budget",
          actionDate: "2023-10-10",
          impactScore: 7.5,
          sourceUrl: "https://www.gov.ie/en/speech/budget-2024-housing/"
        },
        {
          actionType: "legislation_passed",
          description: "Planning and Development Act 2021 passed to fast-track housing delivery",
          actionDate: "2021-12-23",
          impactScore: 6.5,
          sourceUrl: "https://www.oireachtas.ie/en/bills/bill/2021/75/"
        }
      ]
    },
    // Actions for climate targets
    {
      pledgeTitle: "Achieve 7% annual reduction in emissions",
      actions: [
        {
          actionType: "legislation_passed",
          description: "Climate Action and Low Carbon Development Act 2021 enacted with legally binding targets",
          actionDate: "2021-07-23",
          impactScore: 9.0,
          sourceUrl: "https://www.oireachtas.ie/en/bills/bill/2020/39/"
        },
        {
          actionType: "policy_implemented",
          description: "Carbon budgets programme launched with sectoral emissions ceilings",
          actionDate: "2022-04-14",
          impactScore: 7.0,
          sourceUrl: "https://www.gov.ie/en/publication/9bcf2-carbon-budgets/"
        }
      ]
    },
    // Opposition advocacy actions
    {
      pledgeTitle: "Establish public healthcare system free at point of use",
      actions: [
        {
          actionType: "private_members_bill",
          description: "Sláintecare Implementation Bill introduced to Dáil by Sinn Féin",
          actionDate: "2023-03-15",
          impactScore: 6.0,
          sourceUrl: "https://www.oireachtas.ie/en/bills/bill/2023/15/"
        },
        {
          actionType: "parliamentary_question",
          description: "Series of parliamentary questions on health service waiting lists and capacity",
          actionDate: "2023-11-22",
          impactScore: 4.5,
          sourceUrl: "https://www.oireachtas.ie/en/debates/question/"
        },
        {
          actionType: "public_campaign",
          description: "National campaign launch for universal healthcare with public rallies",
          actionDate: "2023-09-10",
          impactScore: 5.5,
          sourceUrl: "https://www.sinnfein.ie/news/universal-healthcare-campaign"
        }
      ]
    }
  ];

  try {
    // Insert pledges
    const insertedPledges = [];
    for (const pledge of samplePledges) {
      const [insertedPledge] = await db
        .insert(pledges)
        .values({
          ...pledge,
          targetDate: pledge.targetDate ? new Date(pledge.targetDate) : null
        })
        .returning();
      
      insertedPledges.push({
        ...insertedPledge,
        title: pledge.title
      });
      
      console.log(`✓ Added pledge: ${pledge.title}`);
    }

    // Insert actions
    for (const actionGroup of sampleActions) {
      const pledge = insertedPledges.find(p => p.title === actionGroup.pledgeTitle);
      if (pledge) {
        for (const action of actionGroup.actions) {
          await db
            .insert(pledgeActions)
            .values({
              pledgeId: pledge.id,
              actionType: action.actionType,
              description: action.description,
              actionDate: new Date(action.actionDate),
              impactScore: action.impactScore.toString(),
              sourceUrl: action.sourceUrl
            });
          
          console.log(`✓ Added action for ${pledge.title}: ${action.description.substring(0, 50)}...`);
        }
      }
    }

    console.log('\n🎉 Sample pledge data added successfully!');
    console.log(`📊 Total pledges: ${samplePledges.length}`);
    console.log(`📈 Total actions: ${sampleActions.reduce((acc, group) => acc + group.actions.length, 0)}`);
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
    throw error;
  }
}

// Run the script
addSamplePledges()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });