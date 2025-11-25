import { PoliticalFigure, PoliticalParty, QuizQuestion } from "./schema";

// Updated Quiz questions with categorized topics
export const questions: QuizQuestion[] = [
  {
    id: 1,
    text: "🟩 Cultural Change: How should societies treat long-standing cultural traditions?",
    answers: [
      {
        text: "Strongly preserve them",
        description: "Traditional values and customs should be maintained without significant changes.",
        economic: 3,
        social: 8
      },
      {
        text: "Preserve, but allow adaptation",
        description: "Cultural traditions are important but can evolve gradually over time.",
        economic: 2,
        social: 4
      },
      {
        text: "Open to natural change",
        description: "Traditions should naturally evolve with society without intervention.",
        economic: -2,
        social: -4
      },
      {
        text: "Actively evolve or replace them",
        description: "Society should actively reform or replace outdated cultural traditions.",
        economic: -3,
        social: -8
      }
    ]
  },
  {
    id: 2,
    text: "🟩 National Identity: How important is it to maintain a unified national or cultural identity?",
    answers: [
      {
        text: "Very important to preserve",
        description: "A strong, unified national identity is essential for social cohesion.",
        economic: 2,
        social: 9
      },
      {
        text: "Important with flexibility",
        description: "National identity matters but should accommodate diversity.",
        economic: 1,
        social: 5
      },
      {
        text: "Somewhat important, but fluid",
        description: "National identity should evolve naturally with demographic changes.",
        economic: -1,
        social: -5
      },
      {
        text: "Not important in a globalized world",
        description: "National identity is less relevant as we become more globally connected.",
        economic: -2,
        social: -9
      }
    ]
  },
  {
    id: 3,
    text: "🟩 Education & History: What should be the focus of national education about history?",
    answers: [
      {
        text: "Emphasize pride and continuity",
        description: "Education should foster national pride and cultural continuity.",
        economic: 2,
        social: 7
      },
      {
        text: "Highlight both achievements and flaws",
        description: "A balanced approach recognizing accomplishments and mistakes.",
        economic: 0,
        social: 3
      },
      {
        text: "Focus on critical reassessment",
        description: "History education should critically examine past narratives.",
        economic: 0,
        social: -3
      },
      {
        text: "Challenge dominant historical narratives",
        description: "History education should actively deconstruct traditional perspectives.",
        economic: -2,
        social: -7
      }
    ]
  },
  {
    id: 4,
    text: "🟦 Government Role in Economy: What role should the government play in managing the economy?",
    answers: [
      {
        text: "Minimal regulation and interference",
        description: "Free markets function best with minimal government involvement.",
        economic: 9,
        social: -2
      },
      {
        text: "Limited regulation, mostly market-led",
        description: "Markets should lead with some oversight to prevent abuse.",
        economic: 5,
        social: -1
      },
      {
        text: "Balanced government-market involvement",
        description: "Government and markets should work as partners in economic management.",
        economic: -5,
        social: 1
      },
      {
        text: "Strong government leadership and planning",
        description: "Government should actively guide economic development and priorities.",
        economic: -9,
        social: 2
      }
    ]
  },
  {
    id: 5,
    text: "🟦 Wealth & Inequality: How should society address economic inequality?",
    answers: [
      {
        text: "Let markets run their course",
        description: "Economic inequalities reflect natural differences and market forces.",
        economic: 8,
        social: -3
      },
      {
        text: "Encourage private solutions (philanthropy, innovation)",
        description: "Private sector and charitable approaches are preferable to government intervention.",
        economic: 4,
        social: -1
      },
      {
        text: "Moderate redistribution through policy",
        description: "Some government policies should address extreme inequality.",
        economic: -4,
        social: 1
      },
      {
        text: "Significant redistribution through taxes and services",
        description: "Government should actively redistribute wealth to create a more equal society.",
        economic: -8,
        social: 3
      }
    ]
  },
  {
    id: 6,
    text: "🟦 Labor & Ownership: Who should control major industries or services (e.g. healthcare, energy)?",
    answers: [
      {
        text: "Private companies",
        description: "Private ownership provides the most efficient and innovative services.",
        economic: 9,
        social: -2
      },
      {
        text: "Mainly private, with some public oversight",
        description: "Private sector should lead with government regulation.",
        economic: 5,
        social: 0
      },
      {
        text: "Mixed ownership (state and private)",
        description: "A balance of public and private ownership works best for essential services.",
        economic: -5,
        social: 0
      },
      {
        text: "Public ownership or cooperative control",
        description: "Essential services should be publicly owned or democratically controlled.",
        economic: -9,
        social: 2
      }
    ]
  },
  {
    id: 7,
    text: "🟨 Freedom vs Security: In times of crisis, how should government balance freedom and public safety?",
    answers: [
      {
        text: "Strongly prioritize individual freedom",
        description: "Individual rights should rarely be compromised, even during crises.",
        economic: 2,
        social: -9
      },
      {
        text: "Slightly favor freedom",
        description: "Individual freedoms are important but some temporary limits may be necessary.",
        economic: 1,
        social: -4
      },
      {
        text: "Slightly favor collective safety",
        description: "Public safety concerns may justify some restrictions on individual freedoms.",
        economic: -1,
        social: 4
      },
      {
        text: "Strongly prioritize collective safety",
        description: "In crises, protecting the public justifies significant restrictions on freedoms.",
        economic: -2,
        social: 9
      }
    ]
  },
  {
    id: 8,
    text: "🟨 Law & Order: How should governments respond to rising crime or unrest?",
    answers: [
      {
        text: "Tough penalties and strict enforcement",
        description: "Strong punishments and increased police presence deter crime effectively.",
        economic: 2,
        social: 9
      },
      {
        text: "Strengthen enforcement, but address root causes",
        description: "Combine stronger enforcement with programs addressing underlying issues.",
        economic: 1,
        social: 4
      },
      {
        text: "Emphasize rehabilitation and community solutions",
        description: "Focus on rehabilitation and community-based approaches over punishment.",
        economic: -1,
        social: -4
      },
      {
        text: "Focus primarily on addressing root causes",
        description: "Address social and economic factors that contribute to crime and unrest.",
        economic: -2,
        social: -9
      }
    ]
  },
  {
    id: 9,
    text: "🟨 Censorship & Speech: When should speech be limited in society?",
    answers: [
      {
        text: "Almost never, even if offensive",
        description: "Free speech is paramount, even when the content is offensive or controversial.",
        economic: 2,
        social: -8
      },
      {
        text: "Rarely, unless it directly causes harm",
        description: "Speech should be limited only when it directly leads to harm.",
        economic: 1,
        social: -4
      },
      {
        text: "Often, to protect public harmony",
        description: "Limits on harmful speech are necessary to maintain social harmony.",
        economic: -1,
        social: 4
      },
      {
        text: "Proactively, to prevent misinformation or extremism",
        description: "Society should proactively limit potentially harmful speech.",
        economic: -2,
        social: 8
      }
    ]
  },
  {
    id: 10,
    text: "🟥 Individual vs Collective: Should personal rights ever be limited for the good of the community?",
    answers: [
      {
        text: "Never",
        description: "Individual rights should not be compromised for collective benefits.",
        economic: 3,
        social: -9
      },
      {
        text: "Only in exceptional circumstances",
        description: "Individual rights generally come first but might be limited in rare cases.",
        economic: 2,
        social: -4
      },
      {
        text: "When the collective benefit is clear",
        description: "Community needs may sometimes justify limiting individual rights.",
        economic: -2,
        social: 4
      },
      {
        text: "Often, to maintain fairness or balance",
        description: "The community's welfare often outweighs individual preferences.",
        economic: -3,
        social: 9
      }
    ]
  },
  {
    id: 11,
    text: "🟥 Family & Society: What role should family structures play in shaping society?",
    answers: [
      {
        text: "Uphold traditional family norms",
        description: "Traditional family structures are central to social stability.",
        economic: 2,
        social: 8
      },
      {
        text: "Support family values but adapt to change",
        description: "Family remains important but definitions should evolve with society.",
        economic: 1,
        social: 3
      },
      {
        text: "All family forms should be equally valued",
        description: "No family structure should be privileged over others.",
        economic: -1,
        social: -3
      },
      {
        text: "De-emphasize family as the social unit",
        description: "Society should focus less on family units and more on individuals or communities.",
        economic: -2,
        social: -8
      }
    ]
  },
  {
    id: 12,
    text: "🟪 Immigration: How should a country approach immigration?",
    answers: [
      {
        text: "Strictly limit to preserve culture/economy",
        description: "Immigration should be highly restricted to protect national identity and resources.",
        economic: 4,
        social: 9
      },
      {
        text: "Selective with strong integration policies",
        description: "Controlled immigration with emphasis on integration into host culture.",
        economic: 2,
        social: 4
      },
      {
        text: "Generally open with oversight",
        description: "Welcoming approach with reasonable checks and management.",
        economic: -2,
        social: -4
      },
      {
        text: "Open borders are ideal",
        description: "People should be free to move between countries with minimal restrictions.",
        economic: -4,
        social: -9
      }
    ]
  },
  {
    id: 13,
    text: "🟪 Global vs Local: Who should have the most influence over laws and policies?",
    answers: [
      {
        text: "Local or national governments only",
        description: "Decision-making should remain at the local or national level.",
        economic: 5,
        social: 5
      },
      {
        text: "National governments, with some international cooperation",
        description: "Nations should lead but coordinate on shared challenges.",
        economic: 3,
        social: 2
      },
      {
        text: "Global cooperation is important for big issues",
        description: "International bodies should have significant influence on global challenges.",
        economic: -3,
        social: -2
      },
      {
        text: "Global institutions should lead more",
        description: "Global institutions should have greater authority to address shared problems.",
        economic: -5,
        social: -5
      }
    ]
  },
  {
    id: 14,
    text: "🟫 Environmental Policy: How should societies respond to climate and ecological challenges?",
    answers: [
      {
        text: "Let markets and innovation solve them",
        description: "Private sector innovation will address environmental issues without regulation.",
        economic: 8,
        social: -2
      },
      {
        text: "Use modest regulation and incentives",
        description: "Light regulation and market incentives to encourage environmental protection.",
        economic: 4,
        social: 0
      },
      {
        text: "Government-led transitions are needed",
        description: "Strong government action is necessary to address environmental challenges.",
        economic: -4,
        social: 0
      },
      {
        text: "Major lifestyle and system overhauls are required",
        description: "Fundamental changes to economic systems and lifestyles are needed.",
        economic: -8,
        social: 2
      }
    ]
  },
  {
    id: 15,
    text: "🟫 Technology & AI: How should we approach rapid advances in technology and AI?",
    answers: [
      {
        text: "Cautiously, protecting existing values",
        description: "Technological development should be carefully managed to preserve social values.",
        economic: 0,
        social: 7
      },
      {
        text: "With oversight and ethical debate",
        description: "Allow advancement but with ethical guidelines and regulation.",
        economic: 0,
        social: 3
      },
      {
        text: "Embrace innovation with flexible safeguards",
        description: "Generally support innovation with adaptable safety measures.",
        economic: 0,
        social: -3
      },
      {
        text: "Push boundaries to solve global problems",
        description: "Technological progress should be embraced to address humanity's challenges.",
        economic: 0,
        social: -7
      }
    ]
  },
  {
    id: 16,
    text: "⚪ Moral Frameworks: Where should our moral values come from?",
    answers: [
      {
        text: "Traditional or religious sources",
        description: "Established religious or traditional sources provide the best moral guidance.",
        economic: 3,
        social: 9
      },
      {
        text: "Cultural norms with slight adaptation",
        description: "Cultural values should guide morality but can evolve gradually.",
        economic: 1,
        social: 4
      },
      {
        text: "Reasoned ethics and individual conscience",
        description: "Individuals should develop ethics through reason and personal reflection.",
        economic: -1,
        social: -4
      },
      {
        text: "Evolving societal consensus",
        description: "Morality should develop through ongoing societal discussion and evolution.",
        economic: -3,
        social: -9
      }
    ]
  },
  {
    id: 17,
    text: "🟠 Direct vs Representative Democracy: How should political decisions be made?",
    answers: [
      {
        text: "By elected representatives only",
        description: "Elected officials should make decisions without direct public input.",
        economic: 0,
        social: 7
      },
      {
        text: "Occasionally consult the public directly",
        description: "Representatives should lead but consult the public on major issues.",
        economic: 0,
        social: 3
      },
      {
        text: "Regular public input and referendums",
        description: "Citizens should frequently have direct input on significant policies.",
        economic: 0,
        social: -3
      },
      {
        text: "Major decisions should always go to a vote",
        description: "Direct democracy should be the primary method for important decisions.",
        economic: 0,
        social: -7
      }
    ]
  },
  {
    id: 18,
    text: "🟠 Elite vs Grassroots Influence: Who should shape political priorities most?",
    answers: [
      {
        text: "Experienced leaders and experts",
        description: "Those with expertise and leadership experience should guide policy.",
        economic: 2,
        social: 8
      },
      {
        text: "A mix of elites and citizens",
        description: "Leadership by qualified individuals with significant public input.",
        economic: 1,
        social: 3
      },
      {
        text: "Active citizen participation",
        description: "Citizens should actively participate in shaping policy priorities.",
        economic: -1,
        social: -3
      },
      {
        text: "Movements and grassroots campaigns",
        description: "Bottom-up organizing and social movements should drive political change.",
        economic: -2,
        social: -8
      }
    ]
  },
  {
    id: 19,
    text: "🟣 Privacy & Surveillance: Should governments be allowed to monitor digital activity to prevent harm?",
    answers: [
      {
        text: "Never — privacy is sacred",
        description: "Privacy rights should not be compromised for security concerns.",
        economic: 1,
        social: -9
      },
      {
        text: "Only with strong checks",
        description: "Limited surveillance may be acceptable with strong oversight and safeguards.",
        economic: 0,
        social: -4
      },
      {
        text: "In moderate cases to ensure safety",
        description: "Reasonable surveillance is justified to protect public safety.",
        economic: 0,
        social: 4
      },
      {
        text: "Yes, if it prevents crime or unrest",
        description: "Security concerns often justify surveillance of digital activities.",
        economic: -1,
        social: 9
      }
    ]
  },
  {
    id: 20,
    text: "🟣 AI & Automation: How should society respond to AI and job automation?",
    answers: [
      {
        text: "Let the market adjust freely",
        description: "Economic forces will create new opportunities as others disappear.",
        economic: 8,
        social: -4
      },
      {
        text: "Offer some retraining and support",
        description: "Provide moderate assistance while allowing market adjustments.",
        economic: 4,
        social: -1
      },
      {
        text: "Proactively prepare and regulate",
        description: "Government should actively prepare for and manage the transition.",
        economic: -4,
        social: 1
      },
      {
        text: "Rethink work and income models entirely",
        description: "Fundamental reforms like UBI may be needed as automation increases.",
        economic: -8,
        social: 4
      }
    ]
  }
];