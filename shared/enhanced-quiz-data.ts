import { QuizQuestion, IdeologicalDimensions } from "./quizTypes";

// Enhanced multidimensional quiz data with expanded ideological axes
export const enhancedQuestions: QuizQuestion[] = [
  {
    id: 1,
    text: "How should a €3bn budget surplus be used when only one priority can be funded?",
    category: "Economic Strategy",
    answers: [
      {
        text: "Accelerate national infrastructure like transport and housing even if debt rises short term",
        description: "Back a state-led building surge that keeps timelines tight and national outcomes front of mind.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Expand targeted social supports such as healthcare cost relief and income floors",
        description: "Channel the windfall into safety-net programmes designed around the most vulnerable households.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Deliver broad-based tax relief so households and SMEs feel an immediate dividend",
        description: "Return the surplus directly to earners and firms to stimulate private choice and investment.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      },
      {
        text: "Bank the funds in a resilience reserve for future shocks and major contingencies",
        description: "Keep powder dry and let experts deploy the capital when a strategic threat or opportunity appears.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: -1.67,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -3.33
      }
    ]
  },
  {
    id: 2,
    text: "With global tax rules shifting, what should Ireland do about its corporate tax model?",
    category: "Economic Strategy",
    answers: [
      {
        text: "Hold the 12.5% rate and double down on competitiveness to keep multinationals anchored",
        description: "Stick with the classic playbook: low rates, fast approvals, and a pro-investment signal to boardrooms.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      },
      {
        text: "Accept the EU minimum rate but swap in generous R&D and green innovation credits",
        description: "Split the difference: comply with new floors while sharpening targeted incentives for high-value jobs.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: -1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Raise headline rates and recycle the revenue into domestic innovation funds and apprenticeships",
        description: "Ask corporates to pay more, then plough it into home-grown capacity and future-ready skills.",
        economic: -2.5,
        social: -1.67,
        cultural: 0,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Pivot from tax competition entirely and scale state-led strategic industries",
        description: "Build sovereign capabilities first and treat the tax model as a bridge to a more self-directed economy.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      }
    ]
  },
  {
    id: 3,
    text: "A €10bn rail upgrade can be done via private partnerships or the exchequer. How do you deliver?",
    category: "Economic Strategy",
    answers: [
      {
        text: "Use a regulated PPP so private operators build and run services under state oversight",
        description: "Blend market efficiency with accountability while keeping fares and service quality in check.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: -1.67,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Borrow and build entirely through a state agency to keep ownership and fares public",
        description: "Own every asset, accept higher national debt, and guarantee public-interest delivery.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Run a hybrid: state constructs core lines, specialists operate the add-ons under contract",
        description: "Split responsibilities to keep strategic control while leveraging private expertise where it helps.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Defer the project and focus on smaller upgrades until fiscal space grows",
        description: "Press pause, prioritise stability, and avoid a mega-project until conditions are perfect.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 4,
    text: "Wholesale energy prices spike 40% overnight. What intervention feels right?",
    category: "Economic Strategy",
    answers: [
      {
        text: "Impose a universal price cap funded by borrowing so every household is shielded",
        description: "Freeze energy bills across the board and ask the state to absorb the volatility.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Offer targeted rebates for low-income homes and critical SMEs only",
        description: "Protect those most exposed, keep overall price signals intact, and limit fiscal damage.",
        economic: -1.25,
        social: -1.67,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Keep market prices but tier tariffs to reward conservation and retrofit investment",
        description: "Let prices bite, then help people who cut demand or upgrade to efficient systems.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: -1.67,
        environmental: 3.33,
        authority: 0,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Avoid distortion, allow prices to settle, and help via income supports or business relief",
        description: "Respect market signals, trust households to adjust, and cushion income instead of price.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: -1.67,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 5,
    text: "Citizenship education is being rewritten. What emphasis should the curriculum carry?",
    category: "Social Fabric",
    answers: [
      {
        text: "Champion rights, diversity, and inclusive histories in every classroom",
        description: "Double down on equality, minority experiences, and the social movements that shaped Ireland.",
        economic: -1.25,
        social: -3.33,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 0,
        authority: -1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Blend modern citizenship with space for heritage, faith schools, and ethical debates",
        description: "Balance pluralism with continuity so schools mirror the country’s layered identity.",
        economic: 0,
        social: 1.67,
        cultural: 3.33,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Keep the focus practical: media literacy, civic participation, and digital citizenship",
        description: "Equip students with critical thinking tools more than ideology-laden content.",
        economic: 0,
        social: -1.67,
        cultural: -1.67,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: 0,
        technocratic: -1.67
      },
      {
        text: "Devolve content to local school boards within light national guardrails",
        description: "Let communities steer the tone while the state only defines core competencies.",
        economic: 1.25,
        social: 3.33,
        cultural: 3.33,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 6,
    text: "Sláintecare is behind schedule. Which system reset do you back?",
    category: "Social Fabric",
    answers: [
      {
        text: "Move rapidly to a fully public system with state-run hospitals and clinics",
        description: "Make healthcare a universal public service, even if it means major structural upheaval.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 0,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Keep a mixed system but cap private profits and embed regulated waiting-time guarantees",
        description: "Hold on to choice while tightening the rules to ensure universal access in practice.",
        economic: -1.25,
        social: -1.67,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Lean into mandatory basic insurance with private providers competing on top-up care",
        description: "Mandate coverage for all, but keep insurers and hospitals market-driven within rules.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Shift to vouchers that citizens can spend in public or private facilities as they see fit",
        description: "Fund people instead of systems so patient choice forces quality improvements.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 7,
    text: "A new personal freedoms bill expands speech, assembly, and reproductive rights. Without tweaks?",
    category: "Social Fabric",
    answers: [
      {
        text: "Pass it exactly as drafted; rights come first even if some groups are uneasy",
        description: "Lock in strong protections and trust society to adapt to a broader rights framework.",
        economic: -1.25,
        social: -3.33,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 0,
        authority: -3.33,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Pass it with tailored conscience clauses for faith-based organisations",
        description: "Safeguard liberties while giving sincere objectors a legal path to opt out.",
        economic: 0,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Pause for a national consultation and redraft once the public has weighed in",
        description: "Seek a broader mandate and slow down rather than risk polarising the debate.",
        economic: 0,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 0,
        technocratic: 1.67
      },
      {
        text: "Reject it; existing legal protections already strike the right balance",
        description: "Avoid what feels like social engineering and stick with the current settlement.",
        economic: 1.25,
        social: 3.33,
        cultural: 3.33,
        globalism: 1.67,
        environmental: 0,
        authority: 3.33,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 8,
    text: "How should Ireland support both Gaeilge and migrant integration in communities?",
    category: "Cultural Identity",
    answers: [
      {
        text: "Double Irish-language investment and require structured cultural induction for newcomers",
        description: "Put heritage front and centre while ensuring everyone understands shared cultural references.",
        economic: 0,
        social: 1.67,
        cultural: 3.33,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Maintain current support, focus integration on employment pathways and practical services",
        description: "Keep language supports steady but prioritise labour market access for new arrivals.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Fund community-led projects pairing Irish-language groups with migrant organisations",
        description: "Let local partnerships define culture-building so everyone sees themselves in the programme.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 0,
        authority: 0,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Shift emphasis to shared civic values and lighten direct state heritage promotion",
        description: "Focus resources on a common civic identity instead of state-led cultural preservation.",
        economic: 1.25,
        social: -1.67,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 0,
        authority: -1.67,
        welfare: 1.67,
        technocratic: -1.67
      }
    ]
  },
  {
    id: 9,
    text: "A historic quarter is needed for new housing supply. What planning call do you make?",
    category: "Cultural Identity",
    answers: [
      {
        text: "Rezone aggressively; densify even if beloved buildings disappear",
        description: "Housing shortage trumps preservation—move fast and accept cultural trade-offs.",
        economic: -1.25,
        social: -1.67,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Preserve exteriors but allow adaptive reuse inside once heritage is documented",
        description: "Protect the streetscape while modernising interiors for homes and services.",
        economic: -1.25,
        social: 0,
        cultural: 1.67,
        globalism: 0,
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Redirect development to another area and keep the historic fabric intact",
        description: "Respect the quarter as a national asset and find housing capacity elsewhere.",
        economic: 1.25,
        social: 1.67,
        cultural: 3.33,
        globalism: 1.67,
        environmental: -1.67,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Stage a citizens’ vote; proceed only with a clear democratic mandate",
        description: "Let local residents and the wider public decide before anything irreversible happens.",
        economic: 0,
        social: 1.67,
        cultural: 3.33,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 10,
    text: "Arts funding is being cut. Which philosophy keeps creative life vibrant?",
    category: "Cultural Identity",
    answers: [
      {
        text: "Protect national institutions first; make sure landmark orchestras and theatres survive",
        description: "Keep the cultural flagships strong even if grassroots projects feel the squeeze.",
        economic: 1.25,
        social: 1.67,
        cultural: 3.33,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Prioritise community arts, emerging voices, and contemporary Irish stories",
        description: "Back the next generation, new media, and local access over elite institutions.",
        economic: -1.25,
        social: -1.67,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 0,
        authority: 0,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Tie grants to economic impact, tourism appeal, and measurable reach",
        description: "Fund the projects with the clearest return—jobs, visitors, and national promotion.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Scale back state involvement and invite philanthropy or private patronage",
        description: "Let markets and donors decide what art thrives rather than Treasury allocations.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 11,
    text: "Ireland is asked to join an EU rapid-response defence force. What's your instinct?",
    category: "Global Role",
    answers: [
      {
        text: "Join fully; collective security outweighs neutrality concerns in today's threat landscape",
        description: "Step into shared defence, accept joint command, and deepen European solidarity.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: 3.33,  // FIXED: Internationalist answer should be positive
        environmental: 1.67,
        authority: 3.33,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Join for logistics, cyber, and intelligence while keeping combat neutrality",
        description: "Support allies behind the scenes and build capability without crossing combat red lines.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 1.67,  // FIXED: Leaning internationalist should be positive
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Decline politely and double down on UN peacekeeping instead",
        description: "Protect neutrality, stay trusted in conflict mediation, and avoid permanent alliances.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: -3.33,  // FIXED: Nationalist answer should be negative
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Hold a referendum before any commitment of forces or funding",
        description: "Let the electorate decide if neutrality should evolve and respect the result.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: -1.67,  // FIXED: Leaning nationalist should be negative
        environmental: 0,
        authority: -1.67,
        welfare: 0,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 12,
    text: "The EU wants unified agricultural policy to hit climate targets. Where do you land?",
    category: "Global Role",
    answers: [
      {
        text: "Support full harmonisation; shared standards protect exports and climate commitments",
        description: "Align with Brussels on regulation, even if it constrains domestic policy freedom.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: 3.33,  // FIXED: EU integration = Internationalist = positive
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Back it with opt-outs for sectors where Ireland is uniquely exposed",
        description: "Integrate broadly but fight for carve-outs that recognise Irish agriculture realities.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 1.67,  // FIXED: Partial integration = leaning internationalist = positive
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Oppose centralisation; keep national control of agri policy to protect producers",
        description: "Trust local knowledge and resist EU encroachment on a pillar industry.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: -3.33,  // FIXED: National control = Nationalist = negative
        environmental: -1.67,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Devolve decisions further to regions and farmer co-ops, not Brussels or Dublin",
        description: "Empower those on the ground to lead, keeping higher tiers of government out of it.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: -3.33,  // FIXED: Anti-centralization = Nationalist = negative
        environmental: -1.67,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 13,
    text: "The UN asks Ireland to double its refugee intake within three years. What's credible?",
    category: "Global Role",
    answers: [
      {
        text: "Agree and expand integration services nationwide immediately",
        description: "Honor humanitarian responsibilities and build capacity quickly across the state.",
        economic: -1.25,
        social: -3.33,
        cultural: -3.33,
        globalism: 3.33,  // FIXED: Open borders/internationalist = positive
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Accept but phase quotas with clear housing and service milestones",
        description: "Meet the challenge gradually so infrastructure keeps pace with arrivals.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: 1.67,  // FIXED: Leaning internationalist = positive
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Hold intake steady and ramp up aid closer to conflict zones instead",
        description: "Support refugees abroad and prioritise domestic capacity constraints at home.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: -1.67,  // FIXED: Prioritize domestic = leaning nationalist = negative
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Decline; national resources are already stretched and community patience is thin",
        description: "Protect domestic stability first and signal that Ireland has reached its limit.",
        economic: 1.25,
        social: 3.33,
        cultural: 3.33,
        globalism: -3.33,  // FIXED: Closed borders/nationalist = negative
        environmental: 0,
        authority: 1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 14,
    text: "Agricultural emissions are missing targets. Which policy trade-off feels right?",
    category: "Environmental Choices",
    answers: [
      {
        text: "Mandate herd reduction with compensation for affected farmers",
        description: "Meet climate goals head-on and pay those who need to transition out of current models.",
        economic: -2.5,
        social: -1.67,
        cultural: 0,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Invest heavily in feed additives, precision farming, and innovation grants",
        description: "Keep herds viable by leaning on technology to decouple production from emissions.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Allow offsets through forestry, peatland restoration, and biodiversity credits",
        description: "Let farmers balance emissions elsewhere while production continues largely unchanged.",
        economic: 1.25,
        social: 0,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 1.67,
        authority: 0,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Relax timelines so competitiveness and rural livelihoods stay protected",
        description: "Prioritise agri income now and stretch climate delivery over a longer horizon.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -3.33,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 15,
    text: "Ireland’s 2050 energy mix can pursue one anchor strategy. Which one earns your backing?",
    category: "Environmental Choices",
    answers: [
      {
        text: "Go all-in on offshore wind with new interconnectors exporting surplus",
        description: "Bet on massive renewables, grid upgrades, and the island as a green power hub.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Balance renewables with small modular reactors by the 2040s",
        description: "Keep emissions down using nuclear as a firm power source alongside wind and solar.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 0,
        technocratic: -1.67
      },
      {
        text: "Back green gas and carbon capture to extend existing infrastructure",
        description: "Blend low-carbon fuels with CCS so current pipelines and industry stay relevant.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Authorise transitional LNG terminals until new tech fully matures",
        description: "Secure supply now with gas, then pivot gradually as alternatives scale up.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -3.33,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 16,
    text: "Dublin is considering a congestion charge. What’s your move?",
    category: "Environmental Choices",
    answers: [
      {
        text: "Introduce the charge now and reinvest every euro in cycling, bus lanes, and public realm",
        description: "Use pricing to change behaviour quickly and fund the alternatives that make it stick.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Phase it in only after commuter rail expansions are delivered",
        description: "Wait until the offer improves so charges feel fair and the public has real choices.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 3.33,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Drop the charge idea, swap in a national EV subsidy and parking reform instead",
        description: "Steer behaviour through incentives and local policy rather than punitive pricing.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 1.67,
        authority: 0,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Reject the charge and stick with road upgrades plus commuter choice",
        description: "Preserve car freedom, expand road capacity, and leave mobility decisions to citizens.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -3.33,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 17,
    text: "A law would allow Garda facial recognition in limited circumstances. How far should it go?",
    category: "Authority & Liberties",
    answers: [
      {
        text: "Approve broad access with strong oversight and regular effectiveness reviews",
        description: "Prioritise security and trust accountability frameworks to prevent abuse.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: 3.33,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Pilot in high-threat cases only, with warrants and independent auditing",
        description: "Test carefully, limit usage, and keep checks in place before any wider rollout.",
        economic: 0,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 3.33,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Reject the proposal; risks to civil liberties outweigh the promised benefits",
        description: "Draw a hard line on privacy even if it makes investigations slower.",
        economic: 0,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 0,
        authority: -3.33,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Invest instead in community policing and manual investigative capacity",
        description: "Build trust and human intelligence rather than leaning on controversial tech.",
        economic: -1.25,
        social: -3.33,
        cultural: -3.33,
        globalism: -1.67,
        environmental: 0,
        authority: -3.33,
        welfare: 1.67,
        technocratic: -1.67
      }
    ]
  },
  {
    id: 18,
    text: "A protest blocks essential infrastructure for hours. What response fits?",
    category: "Authority & Liberties",
    answers: [
      {
        text: "Clear the protest immediately; vital services must trump disruption",
        description: "Use the powers available to restore normal operations swiftly.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: 3.33,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Facilitate the protest but issue fines or penalties for disruption caused",
        description: "Protect expression yet signal that blocking infrastructure has consequences.",
        economic: 0,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 0,
        technocratic: 0
      },
      {
        text: "Keep dialogue open, intervene only if safety risks escalate",
        description: "Negotiate first and only escalate once the public is genuinely in danger.",
        economic: 0,
        social: -1.67,
        cultural: -1.67,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Protect the protest entirely; disruption is part of democratic pressure",
        description: "Let demonstrations run their course and avoid any heavy-handed policing.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 0,
        authority: -3.33,
        welfare: 1.67,
        technocratic: -1.67
      }
    ]
  },
  {
    id: 19,
    text: "A new pandemic variant appears. What public health approach do you favour?",
    category: "Authority & Liberties",
    answers: [
      {
        text: "Reinstate mandatory restrictions quickly under a central command structure",
        description: "Move fast, limit spread, and accept strong state coordination to save lives.",
        economic: -1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 3.33,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Stick with voluntary guidance backed by transparent real-time data",
        description: "Trust citizens once they have the facts and avoid heavy-handed coercion.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 0,
        technocratic: -1.67
      },
      {
        text: "Let local authorities tailor responses based on risk levels in their area",
        description: "Keep decision-making close to communities instead of a one-size national response.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: 0,
        technocratic: 1.67
      },
      {
        text: "Protect high-risk groups only, keep wider society fully open",
        description: "Shield those most vulnerable while minimising wider economic and social disruption.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 20,
    text: "Ireland is debating a nationwide universal basic income. What’s your stance?",
    category: "Welfare & Opportunity",
    answers: [
      {
        text: "Adopt UBI nationwide and replace selected benefits immediately",
        description: "Guarantee a baseline income and simplify welfare even if taxes rise markedly.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 0,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Run a 5-year pilot in high-poverty regions before any national rollout",
        description: "Test the concept carefully, evaluate outcomes, and scale only if results justify it.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Expand targeted programmes instead of creating a universal payment",
        description: "Keep resources focused on those who need help the most and avoid blanket supports.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 0,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Reject UBI; prioritise job creation, upskilling, and earned income support",
        description: "Keep incentives to work strong and grow prosperity through enterprise.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 21,
    text: "Rent caps are set to expire and evictions are rising. What safety net works?",
    category: "Welfare & Opportunity",
    answers: [
      {
        text: "Extend caps and create a state landlord of last resort for at-risk tenants",
        description: "Keep protections strong and let government step in directly where the market fails.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Boost rent supports and scale rapid-build public housing for supply",
        description: "Help people stay put now while accelerating public construction for the medium term.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Incentivise private supply through tax breaks and planning reforms",
        description: "Make it attractive to build and rent so competition drives affordability.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Deregulate rent entirely and focus on raising incomes instead",
        description: "Let the market clear naturally and support people through earnings growth.",
        economic: 2.5,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: -1.67,
        welfare: -3.33,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 22,
    text: "Rural regions lag on services and jobs. How should the state respond?",
    category: "Welfare & Opportunity",
    answers: [
      {
        text: "Increase central redistribution through larger block grants and national programmes",
        description: "Use the exchequer to lift regional services and infrastructure directly.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Tie funding to performance metrics, citizen panels, and accountability dashboards",
        description: "Keep investments evidence-based and co-designed with residents before money flows.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: -1.67
      },
      {
        text: "Expand enterprise zones, tax incentives, and local investment funds",
        description: "Stimulate private sector momentum and let local leaders attract employers.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Encourage relocation with personal tax reliefs and mobility supports",
        description: "Nudge households to move and rebalance population flows through incentives.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: 1.67
      }
    ]
  },
  {
    id: 23,
    text: "Cabinet considers AI-driven policy simulations to stress-test decisions. Your call?",
    category: "Governance Models",
    answers: [
      {
        text: "Adopt the tools and let expert teams steer policy with data-rich simulations",
        description: "Lean into technocratic delivery with analytics guiding ministers on the key moves.",
        economic: 0,
        social: 0,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: 1.67,
        welfare: 0,
        technocratic: 3.33
      },
      {
        text: "Pilot the technology first and require citizens’ assemblies to validate major findings",
        description: "Blend expert input with participatory democracy before policies go live.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: 1.67,
        technocratic: 1.67
      },
      {
        text: "Use simulations as advisory only; elected representatives must own final calls",
        description: "Keep technology in a supporting role so politics remains accountable and human-led.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 0,
        welfare: 0,
        technocratic: -1.67
      },
      {
        text: "Reject the approach; opaque algorithms shouldn’t steer national decisions",
        description: "Prioritise transparency and democratic instinct over experimental governance tech.",
        economic: 0,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: 0,
        technocratic: -3.33
      }
    ]
  },
  {
    id: 24,
    text: "Should citizens’ assemblies gain any binding authority over specific reforms?",
    category: "Governance Models",
    answers: [
      {
        text: "Yes—give assemblies binding power on social and climate legislation",
        description: "Let deliberative democracy lead the way on values-driven policy areas.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 1.67,
        authority: -1.67,
        welfare: 1.67,
        technocratic: 3.33
      },
      {
        text: "Yes, but require Dáil ratification before anything takes effect",
        description: "Marry citizen deliberation with parliamentary legitimacy to keep balance.",
        economic: -1.25,
        social: -1.67,
        cultural: -1.67,
        globalism: 0,
        environmental: 1.67,
        authority: -1.67,
        welfare: 1.67,
        technocratic: 1.67
      },
      {
        text: "Keep assemblies advisory; elected TDs should always make the final decision",
        description: "Value their input but protect representative democracy as the ultimate authority.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Limit the assemblies; too many processes dilute electoral mandates",
        description: "Return focus to the ballot box and keep reforms in the hands of elected leadership.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: -1.67,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -3.33
      }
    ]
  },
  {
    id: 25,
    text: "A productivity audit finds sluggish delivery across public services. What reform leads?",
    category: "Governance Models",
    answers: [
      {
        text: "Introduce performance contracts, bonuses, and consequences for missed targets",
        description: "Bring private-sector style accountability into departments and agencies.",
        economic: 1.25,
        social: 1.67,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: -1.67
      },
      {
        text: "Invest in serious digital transformation and user-centric service redesign",
        description: "Fund the tools and teams that make government intuitive and data-driven.",
        economic: -1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 1.67,
        authority: 1.67,
        welfare: 1.67,
        technocratic: 1.67
      },
      {
        text: "Merge overlapping agencies and cut middle layers to streamline decision-making",
        description: "Reduce duplication, shrink bureaucracy, and keep structures nimble.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 0
      },
      {
        text: "Give front-line departments more discretion and loosen central controls",
        description: "Trust practitioners to innovate locally without restrictive HQ oversight.",
        economic: 1.25,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: -1.67
      }
    ]
  },
  {
    id: 26,
    text: "After an election your emerging party holds 12 seats. Which coalition strategy wins you over?",
    category: "Strategic Compass",
    answers: [
      {
        text: "Partner with a major centrist party to control economic portfolios, even if social reforms slow",
        description: "Trade some ideals for influence over fiscal policy and stability in government.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 0,
        environmental: 0,
        authority: 1.67,
        welfare: -1.67,
        technocratic: 1.67
      },
      {
        text: "Join a progressive alliance focused on climate, welfare, and social change despite higher taxes",
        description: "Commit to transformative policy even if it means a tougher fiscal message.",
        economic: -2.5,
        social: -1.67,
        cultural: -1.67,
        globalism: -1.67,
        environmental: 3.33,
        authority: 1.67,
        welfare: 3.33,
        technocratic: -1.67
      },
      {
        text: "Support a minority government issue-by-issue to keep independence and leverage",
        description: "Stay agile, negotiate on priorities, and avoid being locked into cabinet discipline.",
        economic: 0,
        social: 0,
        cultural: 0,
        globalism: 0,
        environmental: 0,
        authority: -1.67,
        welfare: 0,
        technocratic: -1.67
      },
      {
        text: "Remain in opposition to build grassroots momentum for a bigger breakthrough next time",
        description: "Hold your line, keep your brand pure, and prepare for a future surge on your own terms.",
        economic: 1.25,
        social: 1.67,
        cultural: 1.67,
        globalism: 1.67,
        environmental: 0,
        authority: -1.67,
        welfare: -1.67,
        technocratic: -3.33
      }
    ]
  }
];

// Define ideological profiles based on multidimensional scoring
export const getMultidimensionalIdeology = (
  dimensions: IdeologicalDimensions
): { name: string; description: string } => {
  const { economic, social, cultural, globalism, authority, welfare, technocratic } = dimensions;
  
  // Calculate average scores for major ideological groupings
  // Note: globalism scale is -10 = Nationalist, +10 = Internationalist (from quizTypes.ts)
  const leftScore = -economic;
  const rightScore = economic;
  const progressiveScore = -(social + cultural) / 2;
  const conservativeScore = (social + cultural) / 2;
  const libertarianScore = -authority;
  const authoritarianScore = authority;
  const globalistScore = globalism;      // FIXED: +10 globalism = Internationalist
  const nationalistScore = -globalism;   // FIXED: -10 globalism = Nationalist
  const collectivistScore = -welfare;
  const individualistScore = welfare;
  const technocraticScore = -technocratic;
  const populistScore = technocratic;
  
  // Define ideology thresholds
  const THRESHOLD_STRONG = 6;
  const THRESHOLD_MODERATE = 3;
  
  // Determine primary economic axis
  let economicIdentity = "";
  if (leftScore > THRESHOLD_STRONG) economicIdentity = "Socialist";
  else if (leftScore > THRESHOLD_MODERATE) economicIdentity = "Social Democratic";
  else if (rightScore > THRESHOLD_STRONG) economicIdentity = "Free Market";
  else if (rightScore > THRESHOLD_MODERATE) economicIdentity = "Market-Oriented";
  else economicIdentity = "Centrist";
  
  // Determine primary social axis
  let socialIdentity = "";
  if (progressiveScore > THRESHOLD_STRONG) socialIdentity = "Progressive";
  else if (progressiveScore > THRESHOLD_MODERATE) socialIdentity = "Moderately Progressive";
  else if (conservativeScore > THRESHOLD_STRONG) socialIdentity = "Traditional";
  else if (conservativeScore > THRESHOLD_MODERATE) socialIdentity = "Conservative";
  else socialIdentity = "Socially Moderate";
  
  // Determine authority axis
  let authorityIdentity = "";
  if (libertarianScore > THRESHOLD_STRONG) authorityIdentity = "Libertarian";
  else if (libertarianScore > THRESHOLD_MODERATE) authorityIdentity = "Civil Libertarian";
  else if (authoritarianScore > THRESHOLD_STRONG) authorityIdentity = "Authoritarian";
  else if (authoritarianScore > THRESHOLD_MODERATE) authorityIdentity = "Statist";
  
  // Determine globalist-nationalist axis
  let globalistIdentity = "";
  if (globalistScore > THRESHOLD_STRONG) globalistIdentity = "Internationalist";
  else if (nationalistScore > THRESHOLD_STRONG) globalistIdentity = "Nationalist";
  else if (nationalistScore > THRESHOLD_MODERATE) globalistIdentity = "Patriotic";
  
  // Determine collective-individual axis
  let collectiveIdentity = "";
  if (collectivistScore > THRESHOLD_STRONG) collectiveIdentity = "Communitarian";
  else if (individualistScore > THRESHOLD_STRONG) collectiveIdentity = "Individualist";
  
  // Determine technocratic-populist axis
  let governanceIdentity = "";
  if (technocraticScore > THRESHOLD_MODERATE) governanceIdentity = "Technocratic";
  else if (populistScore > THRESHOLD_MODERATE) governanceIdentity = "Populist";
  
  // Special cases for well-known ideological combinations
  if (leftScore > THRESHOLD_STRONG && authoritarianScore > THRESHOLD_STRONG) {
    return {
      name: "Authoritarian Left",
      description: "You favor strong state control of the economy and society to achieve equality and social goals. You believe centralized authority is necessary to implement progressive economic policies."
    };
  }
  
  if (rightScore > THRESHOLD_STRONG && authoritarianScore > THRESHOLD_STRONG) {
    return {
      name: "Authoritarian Right",
      description: "You favor traditional values, national identity, and strong leadership. You believe a powerful state should protect cultural traditions, enforce social order, and maintain national sovereignty."
    };
  }
  
  if (leftScore > THRESHOLD_MODERATE && libertarianScore > THRESHOLD_MODERATE) {
    return {
      name: "Libertarian Left",
      description: "You support economic equality and social freedom, believing in cooperative economics with minimal state intervention. You value community decision-making, personal freedom, and social justice."
    };
  }
  
  if (rightScore > THRESHOLD_MODERATE && libertarianScore > THRESHOLD_MODERATE) {
    return {
      name: "Libertarian Right",
      description: "You support free markets and individual liberty with minimal government intervention. You believe in strong property rights, free enterprise, and personal freedom in both economic and social domains."
    };
  }
  
  if (leftScore > THRESHOLD_STRONG && progressiveScore > THRESHOLD_STRONG) {
    return {
      name: "Progressive Left",
      description: "You favor significant economic redistribution and progressive social policies. You believe the state should actively reduce inequality while promoting social justice and cultural progressivism."
    };
  }
  
  if (rightScore > THRESHOLD_STRONG && conservativeScore > THRESHOLD_STRONG) {
    return {
      name: "Conservative Right",
      description: "You support free markets and traditional social values. You believe in limited government economic intervention while upholding traditional cultural norms and national identity."
    };
  }
  
  if (Math.abs(economic) < THRESHOLD_MODERATE && Math.abs(social) < THRESHOLD_MODERATE) {
    return {
      name: "Centrist",
      description: "You favor moderate, pragmatic approaches that balance competing values. You're skeptical of ideological extremes and prefer evidence-based policies that incorporate elements from different political traditions."
    };
  }
  
  // Construct custom ideology name and description for other combinations
  let ideologyName = "";
  let ideologyParts = [];
  
  if (collectiveIdentity) ideologyParts.push(collectiveIdentity);
  if (globalistIdentity) ideologyParts.push(globalistIdentity);
  if (governanceIdentity) ideologyParts.push(governanceIdentity);
  if (authorityIdentity) ideologyParts.push(authorityIdentity);
  
  if (ideologyParts.length > 0) {
    ideologyName = `${ideologyParts.join(" ")} ${economicIdentity} ${socialIdentity}`;
  } else {
    ideologyName = `${economicIdentity} ${socialIdentity}`;
  }
  
  return {
    name: ideologyName.trim(),
    description: `Your political orientation combines ${economicIdentity.toLowerCase()} economic views with ${socialIdentity.toLowerCase()} social perspectives.${
      authorityIdentity ? ` You favor a ${authorityIdentity.toLowerCase()} approach to government authority.` : ""
    }${
      globalistIdentity ? ` On global issues, you lean ${globalistIdentity.toLowerCase()}.` : ""
    }${
      collectiveIdentity ? ` You value ${collectiveIdentity.toLowerCase()} approaches to social organization.` : ""
    }${
      governanceIdentity ? ` You prefer ${governanceIdentity.toLowerCase()} approaches to governance and policy-making.` : ""
    }`
  };
};