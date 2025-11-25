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
];export const politicalFigures: PoliticalFigure[] = [
  // Left-libertarian figures (economic left, social libertarian)
  {
    id: "noam-chomsky",
    name: "Noam Chomsky",
    economic: -8.5,
    social: -7.5,
    description: "American linguist and political activist known for his critiques of capitalism and advocacy for libertarian socialism.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/18/19/07/happy-1836445_1280.jpg"
  },
  {
    id: "aoc",
    name: "Alexandria Ocasio-Cortez",
    economic: -7.0,
    social: -6.0,
    description: "U.S. Representative advocating for progressive policies like Green New Deal and Medicare for All.",
    imageUrl: "https://cdn.pixabay.com/photo/2018/01/15/07/51/woman-3083383_1280.jpg"
  },
  {
    id: "sub-marcos",
    name: "Subcomandante Marcos",
    economic: -9.0,
    social: -8.0,
    description: "Mexican revolutionary and spokesperson for the Zapatista movement advocating for indigenous rights and autonomy.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/09/32/man-1868696_1280.jpg"
  },
  {
    id: "emma-goldman",
    name: "Emma Goldman",
    economic: -9.5,
    social: -9.0,
    description: "Anarchist political activist and writer who played a pivotal role in the development of anarchist political philosophy.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/01/08/18/24/person-593570_1280.jpg"
  },
  {
    id: "kropotkin",
    name: "Peter Kropotkin",
    economic: -9.0,
    social: -8.5,
    description: "Russian anarchist and philosopher who advocated for a communist society based on mutual aid and voluntary cooperation.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/03/04/12/59/beard-658652_1280.jpg"
  },

  // Left-authoritarian figures (economic left, social authoritarian)
  {
    id: "stalin",
    name: "Joseph Stalin",
    economic: -9.0,
    social: 9.5,
    description: "Soviet leader who implemented state socialism through collectivization and central planning with authoritarian control.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/03/21/20/01/beard-1271459_1280.jpg"
  },
  {
    id: "mao",
    name: "Mao Zedong",
    economic: -8.5,
    social: 9.0,
    description: "Chinese communist revolutionary who led the People's Republic of China with policies centered on state control.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/27/00/40/people-2685006_1280.jpg"
  },
  {
    id: "castro",
    name: "Fidel Castro",
    economic: -7.5,
    social: 7.0,
    description: "Cuban revolutionary leader who established a socialist state with centralized economic planning and restrictions on political opposition.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/01/08/16/beard-2563383_1280.jpg"
  },
  {
    id: "chavez",
    name: "Hugo Chávez",
    economic: -6.0,
    social: 5.0,
    description: "Venezuelan politician who implemented socialist policies while centralizing state power and control over media.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/21/13/20/suit-1845574_1280.jpg"
  },
  {
    id: "lukashenko",
    name: "Alexander Lukashenko",
    economic: -5.0,
    social: 8.0,
    description: "Belarusian politician serving as president since 1994, maintaining state control of the economy alongside authoritarian governance.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/11/45/man-1869333_1280.jpg"
  },

  // Center-left figures
  {
    id: "bernie-sanders",
    name: "Bernie Sanders",
    economic: -6.0,
    social: -3.5,
    description: "U.S. Senator advocating for democratic socialism, universal healthcare, and reducing wealth inequality.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/05/46/adult-1867665_1280.jpg"
  },
  {
    id: "jeremy-corbyn",
    name: "Jeremy Corbyn",
    economic: -6.5,
    social: -4.0,
    description: "Former UK Labour Party leader advocating for socialist policies, public ownership, and anti-war positions.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/01/01/33/bearded-2562568_1280.jpg"
  },
  {
    id: "jacinda-ardern",
    name: "Jacinda Ardern",
    economic: -4.0,
    social: -4.5,
    description: "Former New Zealand Prime Minister known for progressive policies focused on social welfare and climate action.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/07/02/10/29/woman-828888_1280.jpg"
  },
  {
    id: "justin-trudeau",
    name: "Justin Trudeau",
    economic: -3.0,
    social: -4.0,
    description: "Canadian Prime Minister known for progressive social policies while maintaining a mixed economic approach.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/09/38/adult-1868750_1280.jpg"
  },
  {
    id: "lula-da-silva",
    name: "Luiz Inácio Lula da Silva",
    economic: -5.0,
    social: -2.0,
    description: "Brazilian politician who implemented social programs to reduce poverty while working within market-oriented frameworks.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/03/03/18/56/man-657869_1280.jpg"
  },

  // Centrists
  {
    id: "barack-obama",
    name: "Barack Obama",
    economic: -0.5,
    social: 0.5,
    description: "Former U.S. President with center-left economic policies and moderate social positions.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/09/43/man-1868885_1280.jpg"
  },
  {
    id: "angela-merkel",
    name: "Angela Merkel",
    economic: 1.5,
    social: 0.5,
    description: "Former German Chancellor known for centrist policies and pragmatic approach to governance.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/06/15/13/woman-2593366_1280.jpg"
  },
  {
    id: "emmanuel-macron",
    name: "Emmanuel Macron",
    economic: 2.0,
    social: -1.0,
    description: "French President advocating for liberal economic policies with socially progressive positions.",
    imageUrl: "https://cdn.pixabay.com/photo/2018/01/17/04/14/man-3087828_1280.jpg"
  },
  {
    id: "joe-biden",
    name: "Joe Biden",
    economic: 0.0,
    social: 1.0,
    description: "U.S. President with moderate policies balancing traditional Democratic values with pragmatic governance.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/03/11/14/28/president-1250337_1280.jpg"
  },
  {
    id: "tony-blair",
    name: "Tony Blair",
    economic: 0.5,
    social: 2.0,
    description: "Former UK Prime Minister who promoted 'Third Way' politics, blending market economics with social reform.",
    imageUrl: "https://cdn.pixabay.com/photo/2013/03/06/16/13/business-man-91301_1280.jpg"
  },

  // Center-right figures
  {
    id: "angela-merkel-2",
    name: "Angela Merkel (Later Years)",
    economic: 3.0,
    social: 2.0,
    description: "Former German Chancellor whose policies evolved to include more conservative economic approaches.",
    imageUrl: "https://cdn.pixabay.com/photo/2022/02/07/02/30/businessman-7000243_1280.jpg"
  },
  {
    id: "david-cameron",
    name: "David Cameron",
    economic: 4.0,
    social: 0.0,
    description: "Former UK Prime Minister who advocated for fiscal conservatism alongside socially liberal policies.",
    imageUrl: "https://cdn.pixabay.com/photo/2018/01/17/07/06/executive-3087817_1280.jpg"
  },
  {
    id: "shinzo-abe",
    name: "Shinzo Abe",
    economic: 4.5,
    social: 4.0,
    description: "Former Japanese Prime Minister known for economic reforms and traditional values in social policy.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/11/02/14/26/model-2911330_1280.jpg"
  },
  {
    id: "nicolas-sarkozy",
    name: "Nicolas Sarkozy",
    economic: 5.0,
    social: 3.5,
    description: "Former French President advocating for free-market reforms and stricter law enforcement policies.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/01/00/38/man-2562325_1280.jpg"
  },
  {
    id: "george-hw-bush",
    name: "George H.W. Bush",
    economic: 5.5,
    social: 2.5,
    description: "Former U.S. President known for moderate conservatism and pragmatic foreign policy.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/12/54/man-1869741_1280.jpg"
  },

  // Right-authoritarian figures
  {
    id: "vladimir-putin",
    name: "Vladimir Putin",
    economic: 4.0,
    social: 8.0,
    description: "Russian President known for state capitalism combined with strong nationalist policies and social conservatism.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/18/19/15/man-1836311_1280.jpg"
  },
  {
    id: "viktor-orban",
    name: "Viktor Orbán",
    economic: 3.0,
    social: 7.0,
    description: "Hungarian Prime Minister implementing 'illiberal democracy' with nationalist policies and state intervention in economy.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/01/12/10/44/man-597178_1280.jpg"
  },
  {
    id: "recep-erdogan",
    name: "Recep Tayyip Erdoğan",
    economic: 2.5,
    social: 7.5,
    description: "Turkish President combining Islamic conservatism with strong state control and nationalist rhetoric.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/11/02/14/27/model-2911332_1280.jpg"
  },
  {
    id: "rodrigo-duterte",
    name: "Rodrigo Duterte",
    economic: 1.0,
    social: 8.5,
    description: "Former Philippine President known for populist policies and controversial law enforcement approaches.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/12/18/31/male-2634974_1280.jpg"
  },
  {
    id: "jair-bolsonaro",
    name: "Jair Bolsonaro",
    economic: 6.0,
    social: 7.0,
    description: "Former Brazilian President advocating for free-market economics alongside socially conservative and nationalist policies.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/06/46/adult-1867889_1280.jpg"
  },

  // Right-libertarian figures
  {
    id: "rand-paul",
    name: "Rand Paul",
    economic: 7.5,
    social: -6.0,
    description: "U.S. Senator advocating for limited government intervention in both economic and social spheres.",
    imageUrl: "https://cdn.pixabay.com/photo/2014/11/19/10/52/man-537136_1280.jpg"
  },
  {
    id: "milton-friedman",
    name: "Milton Friedman",
    economic: 8.5,
    social: -7.0,
    description: "Economist who advocated for free markets, minimal government intervention, and individual liberty.",
    imageUrl: "https://cdn.pixabay.com/photo/2014/11/30/14/11/cat-551554_1280.jpg"
  },
  {
    id: "robert-nozick",
    name: "Robert Nozick",
    economic: 9.0,
    social: -8.0,
    description: "Political philosopher who defended libertarian principles and minimal state intervention.",
    imageUrl: "https://cdn.pixabay.com/photo/2019/11/07/05/19/model-4607499_1280.jpg"
  },
  {
    id: "friedrich-hayek",
    name: "Friedrich Hayek",
    economic: 8.0,
    social: -5.0,
    description: "Economist and philosopher who defended classical liberalism and criticized central economic planning.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/08/01/01/33/bearded-2562568_1280.jpg"
  },
  {
    id: "ayn-rand",
    name: "Ayn Rand",
    economic: 9.5,
    social: -6.5,
    description: "Philosopher and novelist who developed Objectivism, emphasizing individualism, capitalism, and reason.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/13/38/alone-1869997_1280.jpg"
  },

  // Right-wing conservatives
  {
    id: "ronald-reagan",
    name: "Ronald Reagan",
    economic: 7.5,
    social: 6.0,
    description: "Former U.S. President who championed free markets, tax cuts, and traditional values.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/04/19/ocean-1867285_1280.jpg"
  },
  {
    id: "margaret-thatcher",
    name: "Margaret Thatcher",
    economic: 8.0,
    social: 5.5,
    description: "Former UK Prime Minister known for free-market policies, privatization, and conservative social values.",
    imageUrl: "https://cdn.pixabay.com/photo/2015/07/09/00/29/woman-837156_1280.jpg"
  },
  {
    id: "donald-trump",
    name: "Donald Trump",
    economic: 6.0,
    social: 6.5,
    description: "Former U.S. President advocating for economic nationalism, tax cuts, and conservative social policies.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/11/24/man-1869316_1280.jpg"
  },
  {
    id: "jordan-peterson",
    name: "Jordan Peterson",
    economic: 4.5,
    social: 3.0,
    description: "Canadian psychologist and author known for advocating personal responsibility and traditional values.",
    imageUrl: "https://cdn.pixabay.com/photo/2018/04/27/03/50/portrait-3353699_1280.jpg"
  },
  {
    id: "boris-johnson",
    name: "Boris Johnson",
    economic: 6.5,
    social: 4.0,
    description: "Former UK Prime Minister advocating for Brexit, economic liberalism with some populist tendencies.",
    imageUrl: "https://cdn.pixabay.com/photo/2017/11/02/14/36/model-2911363_1280.jpg"
  },

  // Irish political figures
  {
    id: "michael-collins",
    name: "Michael Collins",
    economic: -3.0,
    social: 2.5,
    description: "Irish revolutionary leader who advocated for Irish independence and pragmatic nationalism.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/21/15/53/man-1846061_1280.jpg"
  },
  {
    id: "mary-robinson",
    name: "Mary Robinson",
    economic: -3.5,
    social: -4.5,
    description: "Former President of Ireland and UN High Commissioner for Human Rights advocating for social justice and equality.",
    imageUrl: "https://cdn.pixabay.com/photo/2018/02/16/14/38/portrait-3157821_1280.jpg"
  },
  {
    id: "eamon-de-valera",
    name: "Éamon de Valera",
    economic: -2.0,
    social: 5.0,
    description: "Irish political leader who promoted economic self-sufficiency and Catholic social teaching.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/29/09/29/man-1868632_1280.jpg"
  },
  {
    id: "bertie-ahern",
    name: "Bertie Ahern",
    economic: 0.5,
    social: 1.0,
    description: "Former Taoiseach (Prime Minister) of Ireland known for his pragmatic economic policies during the Celtic Tiger era.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/21/11/37/adult-1844814_1280.jpg"
  },
  {
    id: "leo-varadkar",
    name: "Leo Varadkar",
    economic: 3.0,
    social: -2.0,
    description: "Irish Fine Gael politician known for socially liberal views combined with center-right economic policies.",
    imageUrl: "https://cdn.pixabay.com/photo/2016/11/21/16/53/adult-1846436_1280.jpg"
  }
];

// Political parties by country
export const politicalParties: PoliticalParty[] = [
  // Ireland
  {
    id: "ie-green",
    name: "Green Party",
    country: "ireland",
    economic: -4.0,
    social: -5.2,
    description: "Irish political party focused on environmental protection, social justice, and grassroots democracy. Key policies: 7% annual carbon emissions reduction, increased cycling infrastructure, renewable energy transition, and just transition for workers in carbon-intensive industries.",
    color: "#00C000"
  },
  {
    id: "ie-sd",
    name: "Social Democrats",
    country: "ireland",
    economic: -3.5,
    social: -4.0,
    description: "Center-left party advocating for progressive taxation, public healthcare, and housing reform. Key policies: Vienna Model public housing, universal single-tier healthcare (Sláintecare), affordable public childcare, and investment in public transport.",
    color: "#752F8B"
  },
  {
    id: "ie-labour",
    name: "Labour Party",
    country: "ireland",
    economic: -5.0,
    social: -2.0,
    description: "Democratic socialist party focusing on workers' rights, public services, and economic equality. Key policies: Living wage implementation (€12.30/hour), 80,000 social housing units, universal public childcare, and stronger collective bargaining rights.",
    color: "#CC0000"
  },
  {
    id: "ie-ff",
    name: "Fianna Fáil",
    country: "ireland",
    economic: 0.5,
    social: 2.0,
    description: "Centrist party with republican heritage, balancing market economics with state intervention. Key policies: Building 50,000 social housing units, reducing hospital waiting lists, economic stability with moderate government intervention, and rural regeneration.",
    color: "#008800"
  },
  {
    id: "ie-fg",
    name: "Fine Gael",
    country: "ireland",
    economic: 3.0,
    social: 1.0,
    description: "Center-right party combining fiscal conservatism with social liberalism. Key policies: Tax stability, National Broadband Plan implementation, first-time buyer housing supports, and reduced business regulation.",
    color: "#0099FF"
  },
  {
    id: "ie-aontu",
    name: "Aontú",
    country: "ireland",
    economic: -2.0,
    social: 5.0,
    description: "Socially conservative and economically center-left party combining traditional values with economic populism. Key policies: Review of abortion legislation, protection of community hospitals, opposition to vulture funds in housing market, and Irish unity.",
    color: "#D9681D"
  },
  {
    id: "ie-pbp",
    name: "People Before Profit",
    country: "ireland",
    economic: -8.0,
    social: -5.0,
    description: "Socialist party with strong anti-capitalist policies and socially progressive stance. Key policies: Wealth tax on millionaires, eviction bans and rent controls, public ownership of energy infrastructure, and free public transport.",
    color: "#8C1414"
  },
  {
    id: "ie-sf",
    name: "Sinn Féin",
    country: "ireland",
    economic: -5.0,
    social: -2.0,
    description: "Left-wing republican party with strong focus on Irish unity and wealth redistribution. Key policies: 100,000 public homes on public land, wealth tax on assets over €1 million, all-Ireland universal healthcare system, and border poll on Irish unification.",
    color: "#326760"
  },
  
  // UK
  {
    id: "uk-labour",
    name: "Labour Party",
    country: "uk",
    economic: -4.0,
    social: -1.0,
    description: "Center-left party focused on social justice, workers' rights and public services.",
    color: "#E4003B"
  },
  {
    id: "uk-conservative",
    name: "Conservative Party",
    country: "uk",
    economic: 5.0,
    social: 4.0,
    description: "Center-right party advocating free markets, traditional values, and national sovereignty.",
    color: "#0087DC"
  },
  {
    id: "uk-libdem",
    name: "Liberal Democrats",
    country: "uk",
    economic: -2.0,
    social: -6.0,
    description: "Centrist to center-left party emphasizing civil liberties, social justice, and internationalism.",
    color: "#FAA61A"
  },
  {
    id: "uk-green",
    name: "Green Party",
    country: "uk",
    economic: -5.0,
    social: -6.0,
    description: "Left-wing party focused on environmental policies, social justice, and pacifism.",
    color: "#6AB023"
  },
  
  // US
  {
    id: "us-democrat",
    name: "Democratic Party",
    country: "us",
    economic: -2.5,
    social: -2.0,
    description: "Center-left party supporting progressive taxation, social programs, and civil liberties.",
    color: "#3333FF"
  },
  {
    id: "us-republican",
    name: "Republican Party",
    country: "us",
    economic: 6.0,
    social: 5.0,
    description: "Center-right to right-wing party advocating free markets, traditional values, and limited government.",
    color: "#E81B23"
  },
  {
    id: "us-libertarian",
    name: "Libertarian Party",
    country: "us",
    economic: 8.0,
    social: -7.0,
    description: "Right-wing economically, socially liberal party favoring minimal government in all spheres.",
    color: "#FED105"
  },
  {
    id: "us-green",
    name: "Green Party",
    country: "us",
    economic: -6.0,
    social: -6.0,
    description: "Left-wing party focused on environmentalism, social justice, and grassroots democracy.",
    color: "#17AA5C"
  },
  
  // France
  {
    id: "fr-lr",
    name: "Les Républicains",
    country: "france",
    economic: 4.5,
    social: 5.0,
    description: "Center-right party supporting free markets, traditional values, and national identity.",
    color: "#0066CC"
  },
  {
    id: "fr-ps",
    name: "Parti Socialiste",
    country: "france",
    economic: -3.5,
    social: -1.0,
    description: "Center-left party advocating social democracy, worker protections, and public services.",
    color: "#FF3366"
  },
  {
    id: "fr-lrem",
    name: "La République En Marche",
    country: "france",
    economic: 2.0,
    social: -2.0,
    description: "Centrist party combining economic liberalism with progressive social policies.",
    color: "#FFEB00"
  },
  {
    id: "fr-lfi",
    name: "La France Insoumise",
    country: "france",
    economic: -7.0,
    social: -4.0,
    description: "Left-wing populist party opposing austerity and advocating wealth redistribution.",
    color: "#C9462C"
  },
  
  // Germany
  {
    id: "de-cdu",
    name: "CDU/CSU",
    country: "germany",
    economic: 4.0,
    social: 3.0,
    description: "Center-right Christian democratic party emphasizing social market economy, traditional values, and European integration.",
    color: "#000000"
  },
  {
    id: "de-spd",
    name: "Social Democratic Party",
    country: "germany",
    economic: -3.0,
    social: -1.5,
    description: "Center-left party advocating for social justice, workers' rights, and strong welfare systems.",
    color: "#EB001F"
  },
  {
    id: "de-greens",
    name: "Alliance 90/The Greens",
    country: "germany",
    economic: -4.0,
    social: -4.5,
    description: "Left-wing environmentalist party focusing on climate action, social justice, and progressive values.",
    color: "#46962b"
  },
  {
    id: "de-fdp",
    name: "Free Democratic Party",
    country: "germany",
    economic: 6.0,
    social: -4.0,
    description: "Classical liberal party supporting free markets, civil liberties, and minimal government intervention.",
    color: "#FFED00"
  },
  {
    id: "de-afd",
    name: "Alternative for Germany",
    country: "germany",
    economic: 3.5,
    social: 7.0,
    description: "Right-wing populist party advocating for stricter immigration policies and Euroscepticism.",
    color: "#009ee0"
  },
  
  // Canada
  {
    id: "ca-liberal",
    name: "Liberal Party",
    country: "canada",
    economic: -2.0,
    social: -3.0,
    description: "Centrist to center-left party balancing social progressivism with economic pragmatism.",
    color: "#D71920"
  },
  {
    id: "ca-conservative",
    name: "Conservative Party",
    country: "canada",
    economic: 5.0,
    social: 3.5,
    description: "Center-right party supporting free markets, fiscal conservatism, and traditional values.",
    color: "#0C499C"
  },
  {
    id: "ca-ndp",
    name: "New Democratic Party",
    country: "canada",
    economic: -5.5,
    social: -4.5,
    description: "Social democratic party advocating for stronger public services, environmental protection, and workers' rights.",
    color: "#F37021"
  },
  {
    id: "ca-green",
    name: "Green Party",
    country: "canada",
    economic: -4.0,
    social: -5.0,
    description: "Environmentalist party focusing on sustainability, social justice, and participatory democracy.",
    color: "#3D9B35"
  },
  {
    id: "ca-bloc",
    name: "Bloc Québécois",
    country: "canada",
    economic: -3.0,
    social: 1.0,
    description: "Quebec nationalist party supporting Quebec sovereignty while advocating center-left social policies.",
    color: "#33B2CC"
  },
  
  // Australia
  {
    id: "au-labor",
    name: "Australian Labor Party",
    country: "australia",
    economic: -3.5,
    social: -2.0,
    description: "Center-left party advocating for workers' rights, public services, and social equality.",
    color: "#E13940"
  },
  {
    id: "au-liberal",
    name: "Liberal Party",
    country: "australia",
    economic: 4.5,
    social: 3.0,
    description: "Center-right party supporting free markets, individual liberty, and traditional institutions.",
    color: "#0047AB"
  },
  {
    id: "au-nationals",
    name: "National Party",
    country: "australia",
    economic: 3.5,
    social: 4.5,
    description: "Rural-focused conservative party representing agricultural interests and rural communities.",
    color: "#006644"
  },
  {
    id: "au-greens",
    name: "Australian Greens",
    country: "australia",
    economic: -5.0,
    social: -6.0,
    description: "Left-wing environmentalist party focused on climate action, social justice, and participatory democracy.",
    color: "#10C25B"
  },
  
  // Spain
  {
    id: "es-psoe",
    name: "Spanish Socialist Workers' Party",
    country: "spain",
    economic: -4.0,
    social: -3.0,
    description: "Center-left social democratic party advocating for public services, equality, and progressive reforms.",
    color: "#E30613"
  },
  {
    id: "es-pp",
    name: "People's Party",
    country: "spain",
    economic: 4.5,
    social: 4.0,
    description: "Center-right conservative party supporting economic liberalism, traditional values, and national unity.",
    color: "#0055A7"
  },
  {
    id: "es-vox",
    name: "Vox",
    country: "spain",
    economic: 6.0,
    social: 7.5,
    description: "Right-wing to far-right party advocating for Spanish nationalism, traditional values, and anti-immigration policies.",
    color: "#5AC035"
  },
  {
    id: "es-podemos",
    name: "Podemos",
    country: "spain",
    economic: -7.0,
    social: -5.0,
    description: "Left-wing populist party advocating for anti-austerity policies, direct democracy, and wealth redistribution.",
    color: "#612D62"
  },
  
  // Italy
  {
    id: "it-pd",
    name: "Democratic Party",
    country: "italy",
    economic: -3.5,
    social: -2.0,
    description: "Center-left party supporting social democracy, progressive values, and European integration.",
    color: "#FF0000"
  },
  {
    id: "it-lega",
    name: "Lega",
    country: "italy",
    economic: 3.0,
    social: 6.5,
    description: "Right-wing populist party advocating for stricter immigration policies, Euroscepticism, and Italian nationalism.",
    color: "#008000"
  },
  {
    id: "it-fdi",
    name: "Brothers of Italy",
    country: "italy",
    economic: 5.0,
    social: 7.0,
    description: "Right-wing to far-right party emphasizing traditional values, national sovereignty, and law and order.",
    color: "#0066CC"
  },
  {
    id: "it-m5s",
    name: "Five Star Movement",
    country: "italy",
    economic: -2.0,
    social: -1.0,
    description: "Populist party with a mixed platform of environmentalism, anti-establishment positions, and direct democracy.",
    color: "#FFCC00"
  },
  
  // Japan
  {
    id: "jp-ldp",
    name: "Liberal Democratic Party",
    country: "japan",
    economic: 5.0,
    social: 5.5,
    description: "Center-right conservative party supporting free market economics, traditional values, and strong national defense.",
    color: "#B22222"
  },
  {
    id: "jp-cdp",
    name: "Constitutional Democratic Party",
    country: "japan",
    economic: -3.0,
    social: -2.5,
    description: "Center-left party advocating for social welfare, pacifism, and constitutional principles.",
    color: "#4169E1"
  },
  {
    id: "jp-komeito",
    name: "Komeito",
    country: "japan",
    economic: 2.0,
    social: 3.0,
    description: "Centrist Buddhist-inspired party emphasizing welfare policies and pacifist foreign policy.",
    color: "#32CD32"
  },
  {
    id: "jp-jcp",
    name: "Japanese Communist Party",
    country: "japan",
    economic: -8.0,
    social: -4.0,
    description: "Left-wing party advocating for socialism, workers' rights, and opposition to militarism.",
    color: "#FF0000"
  }
];

// Ideology definitions based on compass positions
export const getIdeology = (economic: number, social: number): { name: string; description: string } => {
  // Helper to check if position is within a rectangular area
  const isInRegion = (eMin: number, eMax: number, sMin: number, sMax: number) => 
    economic >= eMin && economic <= eMax && social >= sMin && social <= sMax;
  
  // Quadrant definitions (with gradations)
  
  // Authoritarian Right
  if (isInRegion(6, 10, 6, 10)) {
    return {
      name: "Authoritarian Capitalist",
      description: "You strongly support free markets and traditional authority. You believe in minimal economic intervention by the state, while supporting strong social controls and traditional hierarchies. You likely favor tough law enforcement, strong national identity, and free enterprise."
    };
  }
  if (isInRegion(3, 7, 3, 7)) {
    return {
      name: "Conservative",
      description: "You favor free markets and traditional values. You believe in maintaining social order while allowing economic freedom. You likely support policies that protect traditional institutions, promote national security, and encourage business growth with limited regulation."
    };
  }
  
  // Authoritarian Left
  if (isInRegion(-10, -6, 6, 10)) {
    return {
      name: "Authoritarian Socialist",
      description: "You support strong state control of both the economy and society. You believe central planning and collective needs should take priority over individual freedoms. You likely favor policies that redistribute wealth, enforce social norms, and maintain strong national cohesion."
    };
  }
  if (isInRegion(-7, -3, 3, 7)) {
    return {
      name: "Social Democrat",
      description: "You support significant economic regulation while maintaining some social controls. You believe in strong welfare programs and public services within a democratic framework. You likely favor progressive taxation, workers' rights, and moderate social policies."
    };
  }
  
  // Libertarian Right
  if (isInRegion(6, 10, -10, -6)) {
    return {
      name: "Libertarian Capitalist",
      description: "You strongly favor free markets and personal freedoms. You believe government should be minimal in both economic and social spheres. You likely support policies that maximize individual liberty, protect property rights, and minimize taxation and regulation."
    };
  }
  if (isInRegion(3, 7, -7, -3)) {
    return {
      name: "Classical Liberal",
      description: "You support economic freedom and personal liberty. You believe in limited government intervention in both markets and personal choices. You likely favor policies that protect civil liberties, promote free trade, and encourage entrepreneurship."
    };
  }
  
  // Libertarian Left
  if (isInRegion(-10, -6, -10, -6)) {
    return {
      name: "Libertarian Socialist",
      description: "You support economic equality and maximum personal freedom. You believe in collective ownership and self-governance without state authority. You likely favor policies that empower communities, cooperatives, and direct democracy while opposing both corporate and state power."
    };
  }
  if (isInRegion(-7, -3, -7, -3)) {
    return {
      name: "Progressive",
      description: "You support significant economic regulation and social freedom. You believe in strong social safety nets and protection of civil liberties. You likely favor policies that address inequality, protect marginalized groups, and promote environmental sustainability."
    };
  }
  
  // Center positions
  if (isInRegion(-3, 3, -3, 3)) {
    return {
      name: "Centrist",
      description: "You take moderate positions on both economic and social issues. You believe in balancing free markets with some regulation, and personal liberty with community standards. You likely favor pragmatic, case-by-case approaches rather than rigid ideological positions."
    };
  }
  
  // Catch-all for other positions
  return {
    name: "Mixed",
    description: "Your political views combine elements from different ideological traditions. You have a unique perspective that doesn't fit neatly into conventional categories, drawing from multiple approaches to social and economic issues."
  };
};

// Unique combinations based on response patterns
export const uniqueCombinations = {
  "pragmatic-environmentalism": {
    title: "Pragmatic Environmentalism",
    description: "While you support environmental protection, you prefer market-based solutions rather than strict government mandates—a rare combination among those with similar economic views."
  },
  "progressive-traditionalist": {
    title: "Progressive Traditionalist",
    description: "You value personal freedoms while still maintaining respect for certain traditional institutions, creating an interesting balance between progressive and conservative viewpoints."
  },
  "economic-nationalist": {
    title: "Economic Nationalist",
    description: "You combine support for strong welfare programs with nationalist positions on trade and immigration, prioritizing domestic economic interests."
  },
  "technological-pragmatist": {
    title: "Technological Pragmatist",
    description: "You embrace technological innovation while remaining conscious of its social impacts, seeking balance between progress and ethical considerations."
  },
  "communitarian-individualist": {
    title: "Communitarian Individualist",
    description: "You believe in both strong communities and individual rights, seeking to balance collective responsibilities with personal freedoms."
  }
};

// Political topic suggestions based on ideology
export const politicalSuggestions: Record<string, Record<string, string>> = {
  "carbon-taxation": {
    "Libertarian Socialist": "As a libertarian socialist, you might support community-controlled carbon pricing systems that redistribute revenue directly to affected communities, especially those harmed by climate change.",
    "Progressive": "As a progressive, you might support carbon taxation with rebates that return revenue to citizens, particularly those with lower incomes. This approach aligns with your preference for market mechanisms that address environmental concerns while maintaining economic fairness.",
    "Social Democrat": "As a social democrat, you might favor strong carbon taxes with revenues funding green infrastructure and creating jobs. This combines environmental protection with economic development goals.",
    "Conservative": "As a conservative, you might prefer limited carbon pricing systems that protect traditional industries while gradually incentivizing market-based transitions to cleaner energy.",
    "Centrist": "As a centrist, you might support moderate carbon pricing with exemptions for essential industries and gradual implementation to balance environmental goals with economic concerns.",
    "default": "Based on your political position, you might consider supporting carbon pricing that balances environmental goals with economic impacts, perhaps favoring a revenue-neutral approach."
  },
  "education-reform": {
    "Libertarian Socialist": "As a libertarian socialist, you might support democratically-run community schools with student and teacher governance, emphasizing critical thinking over standardized testing.",
    "Progressive": "As a progressive, you might support increased education funding, teacher autonomy, and curriculum that emphasizes diversity and critical thinking skills.",
    "Social Democrat": "As a social democrat, you might favor universal public education with strong funding, smaller class sizes, and comprehensive support services for all students.",
    "Conservative": "As a conservative, you might support school choice initiatives, emphasis on core academic subjects, and education that includes traditional values and civics.",
    "Centrist": "As a centrist, you might favor balanced education reform that improves public schools while allowing some choice options, with emphasis on both workforce preparation and civic education.",
    "default": "Based on your political position, you might consider supporting education reforms that combine excellence with equity, possibly including both public school improvements and some choice mechanisms."
  },
  "healthcare": {
    "Libertarian Socialist": "As a libertarian socialist, you might support community-controlled healthcare cooperatives with universal coverage and democratic decision-making about resource allocation.",
    "Progressive": "As a progressive, you might support single-payer universal healthcare that eliminates profit motives while ensuring comprehensive coverage for all residents.",
    "Social Democrat": "As a social democrat, you might favor a mixed system with strong public healthcare covering essentials and supplementary private options, ensuring universal access.",
    "Conservative": "As a conservative, you might prefer market-based healthcare with targeted assistance for vulnerable populations, emphasizing competition to drive down costs.",
    "Centrist": "As a centrist, you might support a public-private hybrid system that ensures basic coverage for all while maintaining some market elements and choice.",
    "default": "Based on your political position, you might consider supporting healthcare reforms that balance universal access with sustainable costs, perhaps through a mixed public-private approach."
  }
};
