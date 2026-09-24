// Educational content and policy data interfaces
export interface EducationalContent {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  points: number;
  content: string;
  type?: string;
  topics?: string[];
}

export interface PartyManifesto {
  id?: string;
  partyId: string;
  partyName?: string;
  electionYear: number;
  title?: string;
  fullText?: string;
  aiSummary: string;
  keyPoints: string[];
  url?: string;
  manifestoUrl?: string;
  summary?: string;
}

// Party manifestos with AI summaries
/** Political party manifestos with AI summaries. */
export const partyManifestos: PartyManifesto[] = [
  {
    id: "manifesto-ff-2024",
    partyId: "ie-ff",
    electionYear: 2024,
    title: "Moving Forward. Together. - Fianna Fáil Manifesto 2024",
    fullText: "", // Full text would be too long to include here
    aiSummary: "Fianna Fáil’s 2024 manifesto, titled 'Moving Forward. Together.', presents a centrist agenda focused on economic stability, social investment, and public service reform. The party proposes tax relief for workers, increased social welfare and pension payments, expanded housing construction, and significant investments in healthcare, education, and infrastructure. Emphasis is placed on fiscal responsibility, utilizing the €14 billion Apple tax windfall to fund key initiatives while maintaining budget surpluses.",
    keyPoints: [
      "Reduce lower USC rate to 1.5% and raise higher income tax threshold to at least €50,000",
        "Increase state pension to €350 per week and core social welfare payments by €60 over five years",
        "Construct 60,000 new homes annually, double renters' tax credit to €2,000, and offer €2,500 rebate for first-time buyers' legal fees",
        "Extend free GP care to all children under 12 and reduce Drug Payment Scheme cap from €80 to €40 monthly",
        "Invest €14 billion Apple tax windfall into housing (€4bn), electricity grid (€2.5bn), water infrastructure (€3bn), transport (€3.6bn), and digital health services"
    ],
    url: "https://7358484.fs1.hubspotusercontent-na1.net/hubfs/7358484/FF%20Manifesto%202024_V4_Screen%5B45%5D.pdf"
  },
  {
    id: "manifesto-fg-2024",
    partyId: "ie-fg",
    electionYear: 2024,
    title: "Securing Your Future - Fine Gael Manifesto 2024",
    fullText: "", 
    aiSummary: "Fine Gael’s 2024 manifesto, titled 'Securing Your Future', presents a centrist, pro-enterprise agenda emphasizing economic stability, tax relief, housing development, and public service enhancements. The party proposes €52 billion in additional spending by 2030, focusing on infrastructure, healthcare, education, and social welfare, while maintaining fiscal responsibility. Key initiatives include tax cuts for workers, increased state pension and social welfare payments, expanded healthcare access, and significant investments in housing and infrastructure.",
    keyPoints: [
      "Implement €7 billion in tax cuts, including raising the higher income tax threshold to €50,000 and increasing the Rent Tax Credit to €1,500 per individual",
        "Increase the state pension to €350 per week and raise core social welfare payments by at least €12",
        "Deliver 60,000 new homes annually, double renters' tax credit to €2,000, and offer €2,500 rebate for first-time buyers' legal fees",
        "Provide free GP care for all children under 18 and expand free hot school meals into secondary schools",
        "Invest €14 billion Apple tax windfall into housing (€4bn), electricity grid (€2.5bn), water infrastructure (€3bn), transport (€3.6bn), and digital health services"
    ],
    url: "https://www.finegael.ie/manifesto/"
  },
  {
    id: "manifesto-sf-2024",
    partyId: "ie-sf",
    electionYear: 2024,
    title: "An Rogha don Athrú – The Choice for Change",
    fullText: "",
    aiSummary: "Sinn Féin’s 2024 manifesto, titled 'An Rogha don Athrú – The Choice for Change', outlines a progressive left-wing agenda prioritizing housing, healthcare, workers’ rights, and Irish unity. It proposes aggressive state intervention to tackle the housing crisis, universal access to healthcare, expanded family supports, and a strategic plan for Irish reunification. The manifesto emphasizes wealth redistribution, public investment, and protecting Ireland’s neutrality.",
    keyPoints: [
      "Promise to deliver 300,000 new homes by 2029, including affordable rental and purchase schemes",
        "Free GP and dental care, with a legislative goal for universal healthcare by 2035",
        "Pledge to abolish USC for average income earners and raise the minimum wage",
        "Introduction of €10/day childcare and expansion of parental leave",
        "Commitment to launch a formal roadmap toward Irish reunification"
    ],
    url: "https://www.sinnfein.ie/contents/65896"
  },
  {
    id: "manifesto-sd-2024",
    partyId: "ie-sd",
    electionYear: 2024,
    title: "For the Future - Social Democrats Manifesto 2024",
    fullText: "",
    aiSummary: "The Social Democrats’ 2024 manifesto, titled 'For the Future', presents a comprehensive centre-left agenda focused on delivering high-quality public services, addressing the housing crisis, and promoting social equality. The party emphasizes building affordable homes, implementing universal healthcare through Sláintecare, investing in public childcare, and appointing a dedicated Minister for Disability. Their fiscal approach prioritizes public investment over tax cuts, aiming to create a fairer and more sustainable Ireland.",
    keyPoints: [
      "Commitment to build 50,000 affordable purchase homes, 25,000 cost-rental homes, and 70,000 social homes over the next government term",
        "Full implementation of Sláintecare to establish a universal, single-tier public health service free at the point of use",
        "Introduction of free public transport for under-18s and a €1 off-peak fare for others to promote sustainable mobility",
        "Appointment of a full cabinet Minister for Disability and implementation of a weekly Cost of Disability payment",
        "Investment of €100 million annually in public childcare, including building creches alongside new schools"
    ],
    url: "https://www.socialdemocrats.ie/our-policies/general-election-manifesto-2024/"
  },
  {
    id: "manifesto-lab-2024",
    partyId: "ie-labour",
    electionYear: 2024,
    title: "For the Future - Labour Party Manifesto 2024",
    fullText: "",
    aiSummary: "The Labour Party’s 2024 manifesto, titled 'Building Better Together', outlines a centre-left vision focused on affordable housing, climate action, universal public services, and social equality. It emphasizes state-led solutions to the housing crisis, a cost-of-living strategy that links wages and welfare to inflation, and a commitment to a fairer, greener Ireland. The manifesto also proposes a new Department of Unification to prepare for Irish reunification.",
    keyPoints: [
      "Build over 50,000 new homes annually, including social and cost-rental housing, and establish a State Construction Company",
        "Introduce automatic annual increases in tax credits, income bands, and social welfare payments to outpace inflation",
        "Raise the minimum wage to 66% of median earnings and abolish sub-minimum youth pay rates",
        "Fully implement Sláintecare to deliver a universal, single-tier public health system free at the point of use",
        "Create a Department of Unification to coordinate planning for Irish reunification through white papers and citizen assemblies"
    ],
    url: "https://labour.ie/manifesto/"
  },
  {
    id: "manifesto-pbp-2024",
    partyId: "ie-pbp",
    electionYear: 2024,
    title: "Another Ireland is Possible - People Before Profit Manifesto 2024",
    fullText: "",
    aiSummary: "People Before Profit’s 2024 manifesto, titled 'Another Ireland is Possible', presents a radical left-wing agenda focused on wealth redistribution, public ownership, and comprehensive social reforms. The party advocates for significant investments in housing, healthcare, and public services, funded by taxing the wealthy and utilizing the Apple tax windfall. Key proposals include establishing a state construction company, implementing a €15 minimum wage, introducing free public transport, and adopting a health-led approach to drug policy.",
    keyPoints: [
      "Abolish the Universal Social Charge (USC) for incomes up to €100,000 and introduce a wealth tax on multi-millionaires to raise €8 billion",
        "Use the Apple tax windfall to establish a state construction company aiming to build 30,000 social and 5,000 affordable homes annually",
        "Implement a €15 minimum wage, ban zero-hour contracts, and mandate union recognition",
        "Provide free public transport nationwide and cap mortgage interest rates at 3%",
        "Decriminalize drug possession for personal use and regulate cannabis through a state-controlled system"
    ],
    url: "https://www.pbp.ie/ge24/manifesto/"
  },
  {
    id: "manifesto-ii-2024",
    partyId: "ie-independent-ireland",
    electionYear: 2024,
    title: "Common Sense Solutions for a Better Ireland - Independent Ireland Manifesto 2024",
    fullText: "",
    aiSummary: "Independent Ireland’s 2024 manifesto, titled 'Common Sense Solutions for a Better Ireland', outlines a right-leaning platform focused on rural development, fiscal reform, and national sovereignty. The party emphasizes reducing government waste, implementing tax relief measures, and maintaining Ireland's neutrality. Key proposals include establishing a Department of Efficiency, freezing green taxes, and enhancing support for frontline workers.",
    keyPoints: [
      "Establish a Department of Efficiency to achieve 10% savings on government spending over the next term.",
      "Freeze carbon taxes and abolish the Universal Social Charge (USC) and PRSI contributions for pensioners who continue to work.",
      "Subsidize rental accommodation for frontline workers, including nurses, teachers, and emergency service personnel.",
      "Implement stricter planning regulations for International Protection Accommodation Services (IPAS) centers and introduce a six-month Irish history and culture course for permanent residency applicants.",
      "Conduct feasibility studies to expand light rail systems, like the Luas, into every county to improve rural transport infrastructure."
    ],
    url: "https://www.independentireland.ie/manifesto"
  },
  {
    id: "manifesto-ifp-2024",
    partyId: "ie-irish-freedom",
    electionYear: 2024,
    title: "Common Sense Solutions for a Better Ireland - Irish Freedom Party Manifesto 2024",
    fullText: "",
    aiSummary: "The Irish Freedom Party’s 2024 platform emphasizes national sovereignty, economic liberalism, and traditional social values. Central to their agenda is advocating for Ireland's exit from the European Union (Irexit), reducing government expenditure, and promoting policies that support traditional family structures. The party also focuses on curbing immigration, preserving free speech, and challenging prevailing climate change narratives.",
    keyPoints: [
      "Advocate for Ireland's withdrawal from the EU to restore national sovereignty and democratic control over laws and borders.",
        "Propose significant tax reductions for individuals and businesses, coupled with a comprehensive review of government spending to eliminate inefficiencies.",
        "Support traditional family values, including pro-life policies and initiatives to strengthen the Irish language and cultural heritage.",
        "Call for stricter immigration controls, emphasizing the need to manage asylum processes effectively and prioritize the interests of Irish citizens.",
        "Promote free speech and oppose what they perceive as censorship, particularly concerning discussions on climate change and gender identity."
    ],
    url: "https://www.irishfreedom.ie/policies/"
  },
  {
    id: "manifesto-green-2024",
    partyId: "ie-green",
    electionYear: 2024,
    title: "Towards 2030: A Decade of Change - Green Party Manifesto 2024",
    fullText: "",
    aiSummary: "The Green Party’s 2024 manifesto, titled 'Towards 2030: A Decade of Change', presents a comprehensive plan focusing on climate action, social equity, and sustainable development. The manifesto outlines ambitious goals for reducing carbon emissions, expanding renewable energy, and enhancing public services, including healthcare and education. It emphasizes the importance of community-led initiatives and proposes significant investments in public transport and housing to create a fairer, greener Ireland.",
    keyPoints: [
      "Commitment to achieve net-zero carbon emissions by 2050, with a 51% reduction by 2030",
        "Investment in renewable energy projects to supply 80% of electricity from renewables by 2030",
        "Expansion of public transport infrastructure, including new bus and rail services, and promotion of cycling and walking",
        "Implementation of a nationwide retrofitting program to improve energy efficiency in homes",
        "Introduction of a Universal Basic Income pilot scheme to support economic security and social equity"
    ],
    url: "https://www.greenparty.ie/sites/default/files/2024-11/Manifesto%20OCT%2024%20-%20digital%20version_final.pdf"
  },
  {
    id: "manifesto-aontu-2024",
    partyId: "ie-aontu",
    electionYear: 2024,
    title: "The Movement for Life, Unity and Economic Justice - Aontú Manifesto 2020",
    fullText: "",
    aiSummary: "Aontú’s 2024 manifesto, titled 'Our Common Sense Manifesto', outlines a platform combining socially conservative values with economically left-leaning policies. The party emphasizes national sovereignty, traditional family structures, and robust public services. Key proposals include stricter immigration controls, opposition to gender ideology in education, significant investments in mental health services, and measures to support homeownership and childcare.",
    keyPoints: [
      "Establish a new Border Agency with over 4,000 staff to manage immigration and asylum processes",
        "Oppose the Gender Recognition Act 2015 and advocate for the preservation of traditional gender terms in legislation and education",
        "Allocate an additional €10 million to establish 12 new Child and Adolescent Mental Health Services (CAMHS) teams",
        "Cap childcare costs at €100 per week and provide a €3,000 childcare subvention to parents who choose to stay at home during the first three years of a child's life",
        "Implement measures to increase homeownership, including reforms to EU laws that favor investment funds over families seeking homes"
    ],
    url: "https://childrensrights.ie/wp-content/uploads/2024/11/Aontu-Manifesto-Summary.pdf"
  }
];

// Educational content for gamified learning
/** Educational content for gamified learning. */
export const educationalContent: EducationalContent[] = [
  {
    id: "education-political-spectrum",
    title: "Understanding the Political Spectrum",
    description: "Learn the fundamentals of political ideology mapping",
    category: "Political Theory",
    content: "This article explains the basic concepts of the political spectrum, from left to right, authoritarian to libertarian, and how different ideologies are positioned.",
    type: "article",
    topics: ["political theory", "ideology", "basics"],
    difficulty: "beginner",
    points: 10
  },
  {
    id: "education-irish-political-system",
    title: "How the Irish Political System Works",
    description: "Understanding Ireland's parliamentary democracy",
    category: "Irish Politics",
    content: "Learn about Ireland's parliamentary democracy, the role of the Taoiseach, how laws are made, and the electoral system of proportional representation.",
    type: "article",
    topics: ["irish politics", "government", "elections"],
    difficulty: "beginner",
    points: 15
  },
  {
    id: "education-quiz-irish-parties",
    title: "Quiz: Irish Political Parties",
    description: "Test your knowledge of political parties",
    category: "Assessment",
    content: "Test your knowledge of Irish political parties, their histories, leaders, and policies in this interactive quiz.",
    difficulty: "intermediate",
    points: 25,
    type: "quiz",
    topics: ["irish politics", "political parties"]
  },
  {
    id: "education-budget-simulation",
    title: "Budget Simulator: Balance Ireland's Books",
    description: "Interactive budget creation simulation",
    category: "Economics",
    content: "Try your hand at creating a national budget, making tough decisions about taxation and spending while managing economic constraints.",
    difficulty: "advanced",
    points: 40,
    type: "infographic",
    topics: ["economics", "governance", "fiscal policy"]
  },
  {
    id: "education-historical-leaders",
    title: "Ireland's Political Leaders Through History",
    description: "Explore major political figures in Irish history",
    category: "History",
    content: "Explore the major political figures who shaped modern Ireland, from independence to the present day.",
    difficulty: "intermediate",
    points: 20,
    type: "article",
    topics: ["history", "leadership", "irish politics"]
  }
];

// Track user progress in educational content
export interface UserEducationProgress {
  userId: number;
  completedContentIds: string[];
  totalPoints: number;
  quizScores: {[quizId: string]: number}; // percentage score
  badges: string[];
}

// Badge definitions for gamification
/** Badge definitions for gamification. */
export const educationBadges = {
  "beginner": {
    name: "Political Novice",
    description: "Completed 3 beginner-level educational items",
    icon: "🌱"
  },
  "informed-citizen": {
    name: "Informed Citizen",
    description: "Completed 10 educational items across all difficulties",
    icon: "📚"
  },
  "policy-expert": {
    name: "Policy Expert",
    description: "Scored over 90% on 5 advanced quizzes",
    icon: "🧠"
  },
  "historian": {
    name: "Political Historian",
    description: "Completed all historical content",
    icon: "📜"
  },
  "manifesto-master": {
    name: "Manifesto Master",
    description: "Read manifestos from all major parties",
    icon: "📋"
  }
};