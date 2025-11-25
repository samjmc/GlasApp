import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";
import { parties } from "../shared/schema";
import { eq } from "drizzle-orm";

// Structure for party dimensional data
interface PartyDimensions {
  name: string;
  dimensions: {
    economic: number;
    social: number;
    cultural: number;
    globalism: number;
    environmental: number;
    authority: number;
    welfare: number;
    technocratic: number;
  };
  rationales: {
    economic: string;
    social: string;
    cultural: string;
    globalism: string;
    environmental: string;
    authority: string;
    welfare: string;
    technocratic: string;
  };
}

// Party dimensions data from the provided CSV file
const partyDimensionsData: PartyDimensions[] = [
  {
    name: "Fianna Fáil",
    dimensions: {
      economic: -0.4,
      social: 0.3,
      cultural: 0.6,
      globalism: -0.3,
      environmental: -0.2,
      authority: 0.8,
      welfare: -0.6,
      technocratic: 0.9 // Using Governance score for technocratic dimension
    },
    rationales: {
      economic: "Slightly left of center on economics, favoring moderate government intervention in the economy.",
      social: "Mildly traditional on social issues, largely reflecting the mainstream Irish position.",
      cultural: "Moderately traditional, emphasizing Irish national identity and cultural heritage.",
      globalism: "Slightly internationalist, pro-EU but with emphasis on protecting national interests.",
      environmental: "Moderately green, supporting environmental policies that don't overly burden the economy.",
      authority: "Somewhat authoritarian, favoring established government institutions and moderate law and order policies.",
      welfare: "Somewhat communitarian, supporting modest welfare programs and social safety nets.",
      technocratic: "Mostly technocratic, favoring governance by experienced politicians and policy experts."
    }
  },
  {
    name: "Fine Gael",
    dimensions: {
      economic: 0.3,
      social: 0.2,
      cultural: 0.5,
      globalism: -0.1,
      environmental: 0.1,
      authority: 0.6,
      welfare: 0.1,
      technocratic: 0.8
    },
    rationales: {
      economic: "Center-right on economic policy, favoring business-friendly policies and fiscal responsibility.",
      social: "Slightly traditional on social issues, though has supported progressive reforms in recent years.",
      cultural: "Moderately traditional, emphasizing Irish heritage with a pragmatic approach.",
      globalism: "Balanced approach to globalism, strongly pro-EU while protecting national interests.",
      environmental: "Moderate on environmental issues, balancing economic and environmental concerns.",
      authority: "Moderately authoritarian, supporting established institutions and law and order.",
      welfare: "Slightly individualist, favoring personal responsibility with basic safety nets.",
      technocratic: "Strongly technocratic, emphasizing expert-led governance and policy-making."
    }
  },
  {
    name: "Sinn Féin",
    dimensions: {
      economic: -1.2,
      social: -0.4,
      cultural: 0.2,
      globalism: 0.6,
      environmental: -0.6,
      authority: 1.0,
      welfare: -1.4,
      technocratic: 0.4
    },
    rationales: {
      economic: "Significantly left-leaning, supporting substantial state intervention in the economy.",
      social: "Moderately progressive on social issues, supporting equality and rights expansion.",
      cultural: "Slightly traditional, emphasizing Irish identity while embracing diversity.",
      globalism: "Moderately nationalist, emphasizing Irish sovereignty and reunification.",
      environmental: "Fairly green, supporting environmental protections and climate action.",
      authority: "Quite authoritarian in party structure and approach to governance.",
      welfare: "Strongly communitarian, advocating robust welfare state and social provisions.",
      technocratic: "Balanced between populist appeals and technocratic policy making."
    }
  },
  {
    name: "Aontú",
    dimensions: {
      economic: -0.3,
      social: 1.2,
      cultural: 1.4,
      globalism: 1.3,
      environmental: -0.2,
      authority: 1.5,
      welfare: -0.5,
      technocratic: 1.0
    },
    rationales: {
      economic: "Mildly left on economic issues — supports public services, rural development, and some welfare expansion, but not radically redistributive.",
      social: "Strongly socially conservative — opposes abortion, gender ideology in schools, etc.",
      cultural: "Traditionalist — emphasizes Irish heritage, Catholic values, national identity.",
      globalism: "Nationalist — skeptical of EU overreach, very pro-sovereignty and against 'globalist elites.'",
      environmental: "Mixed — supports environmental stewardship but opposes what they call 'green extremism' (e.g., carbon tax).",
      authority: "Authoritarian-leaning — favors law & order, state control in moral and social areas.",
      welfare: "Mildly communitarian — supports rural welfare, family support policies, but framed through a pro-natalist and nationalist lens.",
      technocratic: "More populist than technocratic — favors 'voice of the people,' often critical of elites and experts, while also wanting reform of institutions."
    }
  },
  {
    name: "Green Party",
    dimensions: {
      economic: -1.0,
      social: -1.2,
      cultural: -1.0,
      globalism: -1.0,
      environmental: -1.8,
      authority: -0.5,
      welfare: -1.3,
      technocratic: -0.6
    },
    rationales: {
      economic: "Firmly left on economics, supporting significant government intervention for environmental goals.",
      social: "Strongly progressive on social issues, supporting equality and rights for marginalized groups.",
      cultural: "Progressive on cultural issues, emphasizing diversity and global perspectives.",
      globalism: "Strongly internationalist, supporting global cooperation on environmental issues.",
      environmental: "Very strongly environmentalist, prioritizing sustainability above most other concerns.",
      authority: "Moderately libertarian, generally skeptical of excessive state control.",
      welfare: "Strongly communitarian, supporting robust social safety nets and public services.",
      technocratic: "Somewhat populist, emphasizing grassroots democracy while valuing expert input on environmental issues."
    }
  },
  {
    name: "People Before Profit–Solidarity",
    dimensions: {
      economic: -1.5,
      social: -1.5,
      cultural: -1.4,
      globalism: -1.2,
      environmental: -1.5,
      authority: -1.3,
      welfare: -1.6,
      technocratic: -0.7
    },
    rationales: {
      economic: "Very strongly left-wing, advocating socialist economic policies and wealth redistribution.",
      social: "Very progressive on social issues, supporting radical equality and rights for all marginalized groups.",
      cultural: "Strongly progressive culturally, advocating for diversity and critical of traditional structures.",
      globalism: "Strongly internationalist with a focus on global solidarity among working people.",
      environmental: "Strongly environmentalist, supporting radical climate action tied to economic justice.",
      authority: "Strongly libertarian in many areas, critical of state power while supporting community control.",
      welfare: "Very strongly communitarian, advocating universal public services and expanded welfare state.",
      technocratic: "Largely populist, emphasizing mass movements and people power over expert-led governance."
    }
  },
  {
    name: "Labour Party",
    dimensions: {
      economic: -1.0,
      social: -0.8,
      cultural: -0.5,
      globalism: -0.8,
      environmental: -1.0,
      authority: -0.4,
      welfare: -1.2,
      technocratic: -0.5
    },
    rationales: {
      economic: "Firmly left on economics, supporting worker rights and progressive taxation.",
      social: "Firmly progressive on social issues, supporting equality and rights expansions.",
      cultural: "Moderately progressive culturally, balancing tradition with diversity and inclusion.",
      globalism: "Firmly internationalist, supporting EU integration and global cooperation.",
      environmental: "Firmly environmentalist, supporting strong climate action and environmental protections.",
      authority: "Moderately libertarian, generally favoring individual freedoms with appropriate regulations.",
      welfare: "Strongly communitarian, advocating robust welfare state and worker protections.",
      technocratic: "Balanced between expert-led policy making and democratic input."
    }
  },
  {
    name: "Independent Ireland",
    dimensions: {
      economic: 0.1,
      social: 0.6,
      cultural: 1.2,
      globalism: 0.5,
      environmental: 0.1,
      authority: 1.0,
      welfare: 0.1,
      technocratic: 0.7
    },
    rationales: {
      economic: "Centrist on economics with slight right lean, favoring market with limited regulation.",
      social: "Moderately traditional on social issues, emphasizing traditional values and family.",
      cultural: "Strongly traditional, emphasizing Irish heritage and national identity.",
      globalism: "Moderately nationalist, skeptical of some international institutions and immigration.",
      environmental: "Centrist on environmental issues, balancing economic concerns with sustainability.",
      authority: "Strongly authoritarian, emphasizing law and order and strong governance.",
      welfare: "Centrist on welfare, supporting basic safety nets with personal responsibility.",
      technocratic: "Moderately populist, emphasizing the voice of ordinary people over elites."
    }
  },
  {
    name: "Social Democrats",
    dimensions: {
      economic: -1.1,
      social: -1.0,
      cultural: -0.8,
      globalism: -0.9,
      environmental: -1.2,
      authority: -0.6,
      welfare: -1.4,
      technocratic: -0.4
    },
    rationales: {
      economic: "Strongly left-leaning, supporting significant state intervention in the economy.",
      social: "Strongly progressive on social issues, advocating equality and expanded rights.",
      cultural: "Firmly progressive culturally, embracing diversity while respecting Irish heritage.",
      globalism: "Firmly internationalist, supporting EU integration and international cooperation.",
      environmental: "Strongly environmentalist, prioritizing sustainability and climate action.",
      authority: "Moderately libertarian, generally favoring civil liberties with appropriate regulation.",
      welfare: "Very communitarian, advocating Nordic-style welfare state and public services.",
      technocratic: "Moderately technocratic, balancing expert knowledge with democratic input."
    }
  },
  {
    name: "The Irish People",
    dimensions: {
      economic: 0.2,
      social: 1.4,
      cultural: 1.6,
      globalism: 1.8,
      environmental: 0.3,
      authority: 1.3,
      welfare: 0.2,
      technocratic: 1.1
    },
    rationales: {
      economic: "Slightly right-of-center economically, favoring market solutions with limited regulation.",
      social: "Very traditional on social issues, strongly opposing progressive social changes.",
      cultural: "Very strongly traditional, emphasizing Irish ethnic identity and heritage.",
      globalism: "Very strongly nationalist, opposing globalization and supporting strict immigration controls.",
      environmental: "Slightly prioritizes economic development over environmental concerns.",
      authority: "Strongly authoritarian, emphasizing law and order and traditional values enforcement.",
      welfare: "Slightly individualist, favoring personal responsibility with limited safety nets.",
      technocratic: "Strongly populist, emphasizing common sense over expert knowledge."
    }
  },
  {
    name: "Irish Freedom Party",
    dimensions: {
      economic: 0.5,
      social: 1.4,
      cultural: 1.8,
      globalism: 2.0,
      environmental: 0.5,
      authority: 1.2,
      welfare: 0.2,
      technocratic: 1.3
    },
    rationales: {
      economic: "Moderately right-wing economically, supporting free markets with minimal regulation.",
      social: "Very traditional on social issues, strongly opposing progressive social changes.",
      cultural: "Very strongly traditional, emphasizing Irish ethnic identity and Christian heritage.",
      globalism: "Extremely nationalist, opposing EU membership and supporting strict immigration control.",
      environmental: "Moderately prioritizes economic development over environmental concerns.",
      authority: "Strongly authoritarian, emphasizing law and order and traditional authority.",
      welfare: "Slightly individualist, favoring personal responsibility with minimal safety nets.",
      technocratic: "Very populist, skeptical of experts and elites, emphasizing common sense solutions."
    }
  },
  {
    name: "National Party",
    dimensions: {
      economic: 0.7,
      social: 1.6,
      cultural: 2.0,
      globalism: 2.0,
      environmental: 0.6,
      authority: 1.8,
      welfare: 0.3,
      technocratic: 1.5
    },
    rationales: {
      economic: "Firmly right-wing economically, supporting free markets with minimal government intervention.",
      social: "Extremely traditional on social issues, opposing nearly all progressive social changes.",
      cultural: "Extremely traditional and nativist, emphasizing ethnic Irish identity and culture.",
      globalism: "Extremely nationalist, strongly opposing immigration and international institutions.",
      environmental: "Moderately prioritizes economic development over environmental concerns.",
      authority: "Very strongly authoritarian, supporting strict law and order and traditional authority.",
      welfare: "Moderately individualist, emphasizing personal responsibility over collective welfare.",
      technocratic: "Very strongly populist, deeply skeptical of experts and elites."
    }
  }
];

async function updatePartyDimensions() {
  console.log("Updating party dimensions...");
  
  try {
    for (const partyData of partyDimensionsData) {
      // Check if party exists
      const existingParty = await db.select().from(parties).where(eq(parties.name, partyData.name));
      
      if (existingParty.length === 0) {
        console.log(`Party ${partyData.name} not found. Please add the party to the database first.`);
        continue;
      }
      
      // Update party dimensions
      await db.update(parties)
        .set({
          economicScore: partyData.dimensions.economic.toString(),
          socialScore: partyData.dimensions.social.toString(),
          culturalScore: partyData.dimensions.cultural.toString(),
          globalismScore: partyData.dimensions.globalism.toString(),
          environmentalScore: partyData.dimensions.environmental.toString(),
          authorityScore: partyData.dimensions.authority.toString(),
          welfareScore: partyData.dimensions.welfare.toString(),
          technocraticScore: partyData.dimensions.technocratic.toString(),
          // Store rationales as JSON string
          dimensionRationales: JSON.stringify(partyData.rationales)
        })
        .where(eq(parties.name, partyData.name));
      
      console.log(`Updated dimensions for ${partyData.name}`);
    }
    
    console.log("Party dimensions update completed!");
  } catch (error) {
    console.error("Error updating party dimensions:", error);
  } finally {
    await pool.end();
  }
}

// Execute the function
updatePartyDimensions().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});