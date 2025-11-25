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

export interface PolicyPledge {
  id: string;
  partyId: string;
  electionYear: number;
  title: string;
  description: string;
  category: string;
  fulfilled: number; // percentage 0-100
  evidence: string;
}

// Policy pledges with implementation tracking
export const policyPledges: PolicyPledge[] = [
  // Fianna Fáil pledges
  {
    id: "pledge-ff-housing-2020",
    partyId: "ie-ff",
    electionYear: 2020,
    title: "Build 50,000 new social housing units",
    description: "Fianna Fáil pledged to build 50,000 new social housing units by 2025 to address the housing crisis.",
    category: "Housing",
    fulfilled: 25, // Only 25% of promised housing delivered
    evidence: "Government housing statistics show only 12,500 units were delivered by mid-2023, far short of the target pace."
  },
  {
    id: "pledge-ff-healthcare-2020",
    partyId: "ie-ff",
    electionYear: 2020,
    title: "Reduce hospital waiting lists by 50%",
    description: "Promised to reduce overall hospital waiting lists by 50% within 5 years through increased capacity and staffing.",
    category: "Healthcare",
    fulfilled: 15,
    evidence: "HSE data shows waiting lists have decreased by only 15%, with certain specialties seeing increases."
  },
  {
    id: "pledge-ff-rural-2020",
    partyId: "ie-ff",
    electionYear: 2020,
    title: "Rural regeneration fund",
    description: "Fianna Fáil promised to significantly expand the Rural Regeneration Fund to revitalize town centers and support community development.",
    category: "Rural Development",
    fulfilled: 60,
    evidence: "The Rural Regeneration Fund was increased by 40% and has supported over 200 projects across rural Ireland."
  },
  {
    id: "pledge-fg-tax-2020",
    partyId: "ie-fg",
    electionYear: 2020,
    title: "No increases in income tax or USC",
    description: "Fine Gael promised not to increase income tax or Universal Social Charge during their term.",
    category: "Taxation",
    fulfilled: 100,
    evidence: "No increases to income tax or USC rates were implemented during the government term."
  },
  {
    id: "pledge-sf-housing-2020",
    partyId: "ie-sf",
    electionYear: 2020,
    title: "Deliver 100,000 public homes",
    description: "Sinn Féin promised to deliver 100,000 public homes on public land over five years if in government.",
    category: "Housing",
    fulfilled: 35, // Influenced policy through opposition pressure
    evidence: "Though not in government, Sinn Féin's housing proposals have influenced government policy, with housing budget increases and the introduction of several measures originally proposed by SF. Their opposition position has shifted the national conversation on public housing."
  },
  {
    id: "pledge-sf-wealth-tax-2020",
    partyId: "ie-sf",
    electionYear: 2020,
    title: "Implement a wealth tax on assets over €1 million",
    description: "Sinn Féin pledged to introduce a 1% tax on assets valued over €1 million to fund public services.",
    category: "Taxation",
    fulfilled: 20,
    evidence: "While the specific wealth tax has not been implemented, Sinn Féin's advocacy has contributed to the introduction of higher taxes on property transactions above €1 million and increased bank levies, moving partially toward their policy goal."
  },
  {
    id: "pledge-sf-healthcare-2020",
    partyId: "ie-sf",
    electionYear: 2020,
    title: "All-Ireland universal healthcare system",
    description: "Sinn Féin promised to work toward an integrated, all-Ireland healthcare system with universal coverage.",
    category: "Healthcare",
    fulfilled: 15,
    evidence: "As the largest opposition party, Sinn Féin has successfully advocated for increased cross-border healthcare cooperation, including several new shared services between Northern Ireland and the Republic. Their healthcare proposals have influenced government policy on waiting list initiatives."
  },
  {
    id: "pledge-green-emissions-2020",
    partyId: "ie-green",
    electionYear: 2020,
    title: "7% annual reduction in carbon emissions",
    description: "The Green Party promised to ensure a 7% annual reduction in carbon emissions as part of government.",
    category: "Environment",
    fulfilled: 60,
    evidence: "EPA data shows emissions reductions averaged 4.2% annually, short of the 7% target but significant progress. The Green Party successfully implemented substantial policy changes to reduce emissions in energy and transport sectors."
  },
  {
    id: "pledge-green-transport-2020",
    partyId: "ie-green",
    electionYear: 2020,
    title: "Allocate 10% of transport budget to cycling",
    description: "The Green Party pledged to allocate 10% of the total transport budget to cycling infrastructure across Ireland.",
    category: "Transport",
    fulfilled: 75,
    evidence: "Department of Transport figures show 7.5% of the transport budget was allocated to cycling projects, a substantial increase from previous years. The new cycling strategy implemented 150km of additional urban cycling routes since 2020."
  },
  {
    id: "pledge-green-just-transition-2020",
    partyId: "ie-green",
    electionYear: 2020,
    title: "Just Transition fund for Midlands peat workers",
    description: "The Green Party promised to establish a Just Transition fund to support workers and communities affected by the phase-out of peat harvesting in the Midlands.",
    category: "Employment",
    fulfilled: 85,
    evidence: "The €77 million Just Transition Fund was established and has supported over 30 projects and hundreds of workers in transitioning to new employment."
  },
  {
    id: "pledge-green-renewable-2020",
    partyId: "ie-green",
    electionYear: 2020,
    title: "70% renewable electricity by 2030",
    description: "The Green Party committed to ensuring 70% of Ireland's electricity would come from renewable sources by 2030.",
    category: "Energy",
    fulfilled: 45,
    evidence: "Current projections show Ireland on track for approximately 55% renewable electricity by 2030, making progress but likely to fall short of the 70% target."
  },
  {
    id: "pledge-fg-broadband-2020",
    partyId: "ie-fg",
    electionYear: 2020,
    title: "National Broadband Plan implementation",
    description: "Fine Gael promised to connect 1.1 million people to high-speed broadband through the National Broadband Plan by 2025.",
    category: "Infrastructure",
    fulfilled: 65,
    evidence: "By 2024, approximately 650,000 premises were connected, showing significant progress but behind the original timeline."
  },
  {
    id: "pledge-fg-housing-2020",
    partyId: "ie-fg",
    electionYear: 2020,
    title: "First-time buyer supports",
    description: "Fine Gael promised to expand the Help-to-Buy scheme and implement affordable housing initiatives for first-time buyers.",
    category: "Housing",
    fulfilled: 80,
    evidence: "Help-to-Buy scheme was expanded and maintained, with new affordable housing initiatives implemented, though house prices continued to rise."
  },
  {
    id: "pledge-aontu-abortion-2020",
    partyId: "ie-aontu",
    electionYear: 2020,
    title: "Review implementation of abortion legislation",
    description: "Aontú pledged to fight for a thorough review of abortion legislation and its implementation.",
    category: "Social Policy",
    fulfilled: 40,
    evidence: "While not in government, Aontú representatives consistently raised the issue and secured some parliamentary discussion."
  },
  {
    id: "pledge-aontu-housing-2020",
    partyId: "ie-aontu",
    electionYear: 2020,
    title: "End to vulture fund tax advantages",
    description: "Aontú pledged to end tax advantages for vulture funds and real estate investment trusts (REITs) in the Irish property market.",
    category: "Housing",
    fulfilled: 20,
    evidence: "As a small opposition party, Aontú successfully highlighted the issue but had limited impact on policy changes."
  },
  {
    id: "pledge-aontu-healthcare-2020",
    partyId: "ie-aontu",
    electionYear: 2020,
    title: "Protection of community hospitals",
    description: "Aontú committed to preventing closures of rural and community hospitals and ensuring adequate care for elderly citizens.",
    category: "Healthcare",
    fulfilled: 30,
    evidence: "Though in opposition, Aontú effectively campaigned against several proposed closures through local and national advocacy."
  },
  {
    id: "pledge-lab-minimum-wage-2020",
    partyId: "ie-labour",
    electionYear: 2020,
    title: "Living wage implementation",
    description: "Labour pledged to implement a living wage of €12.30 per hour and strengthen workers' rights across all sectors.",
    category: "Employment",
    fulfilled: 35,
    evidence: "While not in government, Labour helped build public support that contributed to minimum wage increases, though not to full living wage levels. Labour's advocacy in the Oireachtas has also influenced improved working hours legislation."
  },
  {
    id: "pledge-lab-housing-2020",
    partyId: "ie-labour",
    electionYear: 2020,
    title: "Build 80,000 social and affordable homes",
    description: "Labour promised to deliver 80,000 social and affordable homes over 5 years through a new state-led housing program.",
    category: "Housing",
    fulfilled: 20,
    evidence: "Through consistent opposition and policy work, Labour has influenced the government's Affordable Housing Act and helped secure increased funding for social housing. Their advocacy has contributed to the growing consensus on the need for state-led housing solutions."
  },
  {
    id: "pledge-lab-childcare-2020",
    partyId: "ie-labour",
    electionYear: 2020,
    title: "Universal public childcare",
    description: "Labour committed to creating a universal public childcare system with fees capped at €4.50 per hour.",
    category: "Education",
    fulfilled: 25,
    evidence: "While not in government to fully implement their proposal, Labour's advocacy contributed to the expansion of the National Childcare Scheme and increased childcare subsidies for low and middle-income families."
  },
  {
    id: "pledge-pbp-wealth-tax-2020",
    partyId: "ie-pbp",
    electionYear: 2020,
    title: "Emergency wealth tax on millionaires",
    description: "People Before Profit pledged to implement an emergency wealth tax of 2% on assets over €1 million and 5% on assets over €3 million.",
    category: "Taxation",
    fulfilled: 15,
    evidence: "Through consistent advocacy in parliament and public campaigns, PBP has helped shift the public debate on wealth inequality, influencing some modest increases in taxes affecting wealthy individuals."
  },
  {
    id: "pledge-pbp-housing-2020",
    partyId: "ie-pbp",
    electionYear: 2020,
    title: "Ban evictions and freeze rents",
    description: "People Before Profit promised to introduce legislation to ban all evictions and implement a nationwide rent freeze.",
    category: "Housing",
    fulfilled: 30,
    evidence: "While not fully implemented as proposed, PBP's persistent advocacy contributed to temporary pandemic eviction bans being implemented, rent caps in pressure zones, and ongoing debate about tenant rights that has shifted government policy."
  },
  {
    id: "pledge-pbp-climate-2020",
    partyId: "ie-pbp",
    electionYear: 2020,
    title: "Public ownership of energy infrastructure",
    description: "People Before Profit pledged to bring energy infrastructure under public ownership and significantly expand renewable energy investment.",
    category: "Environment",
    fulfilled: 20,
    evidence: "While energy privatization has continued, PBP's opposition has helped secure commitments to greater state involvement in renewable energy projects and expanded the role of public bodies in energy planning."
  },
  {
    id: "pledge-sd-housing-2020",
    partyId: "ie-sd",
    electionYear: 2020,
    title: "Vienna Model public housing",
    description: "The Social Democrats pledged to implement a Vienna Model of public housing with affordable, high-quality, mixed-income developments.",
    category: "Housing",
    fulfilled: 25,
    evidence: "While not in government, the Social Democrats have influenced housing policy through their persistent advocacy, with several local authorities now exploring Vienna Model pilot projects."
  },
  {
    id: "pledge-sd-health-2020", 
    partyId: "ie-sd",
    electionYear: 2020,
    title: "Sláintecare implementation",
    description: "The Social Democrats pledged to fully implement the Sláintecare healthcare reform plan with universal single-tier healthcare.",
    category: "Healthcare",
    fulfilled: 35,
    evidence: "As original co-authors of Sláintecare, the Social Democrats have successfully kept pressure on government to implement aspects of the plan, including removal of some inpatient hospital charges and expansion of free GP care."
  },
  {
    id: "pledge-sd-childcare-2020",
    partyId: "ie-sd",
    electionYear: 2020,
    title: "Public childcare system",
    description: "The Social Democrats promised to develop a public, affordable childcare system over five years, reducing fees by 66%.",
    category: "Education",
    fulfilled: 30,
    evidence: "While not implementing their full vision, the Social Democrats' advocacy has contributed to increased childcare subsidies and the beginning of a more publicly-supported childcare model."
  }
];

// Party manifestos with AI summaries
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