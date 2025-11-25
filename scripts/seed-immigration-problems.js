const immigrationProblems = [
  {
    title: "Accommodation & Processing Backlogs",
    description: "Overcrowded reception centers and lengthy asylum processing times creating bottlenecks in the immigration system.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: true,
    fullDescription: "Ireland faces significant challenges with accommodation shortages for asylum seekers and international protection applicants, leading to unsuitable emergency accommodation and extended processing times that leave people in limbo for months or years.",
    tags: ["asylum", "processing", "accommodation", "backlogs"]
  },
  {
    title: "Social-Housing Shortages",
    description: "Public perception that immigrants are taking social housing beds, creating community tensions over limited housing stock.",
    category: "immigration",
    author: "Admin Team", 
    isOfficial: true,
    isNew: true,
    isTrending: false,
    fullDescription: "The housing crisis intersects with immigration policy as communities perceive competition for scarce social housing resources, leading to resentment and political tensions despite complex allocation systems.",
    tags: ["housing", "social housing", "community", "perception"]
  },
  {
    title: "Labour-Market Mismatch",
    description: "Skills shortages in key sectors while work permit system remains inflexible, preventing efficient matching of talent to needs.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: false,
    fullDescription: "Ireland has critical skills shortages in healthcare, construction, and technology while bureaucratic work permit processes prevent qualified immigrants from filling these roles efficiently.",
    tags: ["employment", "skills", "permits", "workforce"]
  },
  {
    title: "Integration & Social Cohesion",
    description: "Language barriers and community tensions affecting successful integration of new residents into Irish society.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: false,
    fullDescription: "Successful long-term integration requires language support, cultural orientation, and community bridge-building to prevent segregation and build cohesive multicultural communities.",
    tags: ["integration", "language", "community", "culture"]
  },
  {
    title: "Pressure on Health & Education Services",
    description: "Increased demand on already strained public services without proportional capacity expansion or resource allocation.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: true,
    fullDescription: "Healthcare and education systems face additional pressure from immigration without adequate planning or resource increases, affecting service quality for both new arrivals and existing residents.",
    tags: ["healthcare", "education", "services", "capacity"]
  },
  {
    title: "Public Perception & Misinformation",
    description: "Misconceptions about job displacement and crime rates creating political tensions and social division.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: true,
    fullDescription: "Misinformation campaigns and selective media coverage fuel public fears about economic competition and security concerns, often contradicting official statistics and research evidence.",
    tags: ["perception", "misinformation", "media", "politics"]
  },
  {
    title: "Return-and-Repatriation Pathways",
    description: "Managing voluntary and involuntary returns while maintaining human rights standards and international cooperation.",
    category: "immigration",
    author: "Admin Team",
    isOfficial: true,
    isNew: true,
    isTrending: false,
    fullDescription: "Complex legal and humanitarian challenges in processing returns, including voluntary repatriation support and enforced removals while meeting international human rights obligations.",
    tags: ["returns", "repatriation", "rights", "cooperation"]
  }
];

async function seedProblems() {
  console.log('Starting to seed immigration problems...');
  
  for (const problem of immigrationProblems) {
    try {
      const response = await fetch('http://localhost:5000/api/problems', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(problem)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✓ Created problem: ${problem.title}`);
      } else {
        console.error(`✗ Failed to create problem: ${problem.title}`, await response.text());
      }
    } catch (error) {
      console.error(`✗ Error creating problem: ${problem.title}`, error.message);
    }
  }
  
  console.log('Seeding complete!');
}

seedProblems();