export type PolicyDomain =
  | 'foreign_policy'
  | 'humanitarian_aid'
  | 'housing'
  | 'health'
  | 'economy'
  | 'taxation'
  | 'climate'
  | 'immigration'
  | 'justice'
  | 'education'
  | 'infrastructure'
  | 'agriculture'
  | 'technology'
  | 'other';

export interface PolicyTopicDefinition {
  key: string;
  title: string;
  description: string;
  examplePrompts: string[];
  defaultAlignment?: {
    more_action?: string[];
    keep_course?: string[];
    reduce_action?: string[];
  };
}

export const POLICY_DOMAINS: Record<PolicyDomain, PolicyTopicDefinition[]> = {
  foreign_policy: [
    {
      key: 'foreign_aid',
      title: 'Foreign Aid & International Solidarity',
      description:
        'Ireland’s overseas development assistance, humanitarian missions, and diplomatic solidarity.',
      examplePrompts: [
        'A €500M humanitarian aid budget must prioritize one region. Which should it be?',
        'An international conflict requires a diplomatic response. What approach should Ireland take?',
      ],
      defaultAlignment: {
        more_action: ['Sinn Féin', 'Social Democrats', 'Labour Party', 'People Before Profit'],
        keep_course: ['Fianna Fáil', 'Fine Gael', 'Green Party'],
        reduce_action: ['Aontú', 'Independent Ireland', 'Certain Independents'],
      },
    },
    {
      key: 'defence_policy',
      title: 'Defence & Peacekeeping',
      description:
        'Matters related to defence spending, neutrality, and participation in peacekeeping missions.',
      examplePrompts: [
        'Peacekeeping capacity can be expanded via additional funding, partnerships, or redeployment. Which approach?',
        'Defence spending can prioritize international missions, domestic security, or equipment modernization. Which priority?',
      ],
    },
  ],
  humanitarian_aid: [
    {
      key: 'domestic_relief',
      title: 'Domestic Humanitarian Response',
      description:
        'Government response to emergencies such as natural disasters, pandemics, or housing emergencies.',
      examplePrompts: [
        'A crisis requires response. Should we declare a national emergency, use existing powers, or deploy targeted relief?',
        'Emergency funding can prioritize displaced families, infrastructure repair, or prevention measures. Which should come first?',
      ],
    },
  ],
  housing: [
    {
      key: 'public_housing_targets',
      title: 'Housing Supply & Public Building',
      description:
        'Targets and delivery of affordable, social, and cost-rental housing, including emergency accommodation.',
      examplePrompts: [
        'A €5bn housing fund can prioritize public construction, cost-rental partnerships, first-time buyer grants, or vacancy activation. Which approach?',
        'Housing capacity is strained. Should we expand public housing, expand partnerships, tighten criteria, or pause new applications?',
      ],
    },
    {
      key: 'tenants_rights',
      title: 'Tenants’ Rights & Rent Regulation',
      description:
        'Measures relating to rent caps, eviction bans, tenant protections, and rental oversight.',
      examplePrompts: [
        'Tenant protections can be strengthened via eviction bans, rent caps, or enhanced rights. Which approach feels right?',
        'Rent regulation can be temporary bans, pressure zone expansion, or nationwide caps. Which method aligns with your values?',
      ],
    },
  ],
  health: [
    {
      key: 'health_capacity',
      title: 'Health Service Capacity',
      description:
        'Investment in hospital beds, staff recruitment, emergency department wait times, and regional health services.',
      examplePrompts: [
        'A&E wait times require attention. Should we increase hospital capacity, expand community care, prioritize staff recruitment, or streamline triage?',
        'Healthcare capacity can be expanded via new hospital beds, regional upgrades, community clinics, or private partnerships. Which priority?',
      ],
    },
  ],
  economy: [
    {
      key: 'cost_of_living',
      title: 'Cost of Living & Supports',
      description:
        'Policy responses to rising living costs, including welfare supports, wage subsidy schemes, and tax credits.',
      examplePrompts: [
        'Cost-of-living pressures persist. Should we extend direct payments, increase tax credits, raise minimum wage, or trust market adjustments?',
        'A budget surplus can fund one cost-of-living measure. Should it be payments to households, wage increases, tax relief, or energy supports?',
      ],
    },
  ],
  taxation: [
    {
      key: 'windfall_tax',
      title: 'Windfall & Corporate Taxation',
      description:
        'Measures targeting excess profits, corporation tax reform, or redistribution of windfall revenues.',
      examplePrompts: [
        'Energy company profits have surged. Should we impose a windfall tax, negotiate voluntary contributions, increase corporate rates, or trust market forces?',
      ],
    },
  ],
  climate: [
    {
      key: 'climate_targets',
      title: 'Climate & Environmental Targets',
      description:
        'Commitments related to emissions reductions, just transition, and environmental protection.',
      examplePrompts: [
        'Climate targets conflict with economic concerns. Should we accelerate targets, maintain current pace, adjust for economic impact, or pause for review?',
        'Energy security requires balancing climate goals. Should we keep plants online longer, accelerate renewables, expand imports, or reduce demand?',
      ],
    },
  ],
  immigration: [
    {
      key: 'asylum_supports',
      title: 'Asylum & Migration Supports',
      description:
        'Policies on International Protection Accommodation Services (IPAS), asylum processing, and community supports.',
      examplePrompts: [
        'Communities hosting asylum seekers face pressure. Should we increase local supports, expand to new areas, tighten criteria, or improve integration services?',
        'Asylum accommodation capacity is strained. Should we expand via emergency legislation, tighten criteria, expand community housing, or pause applications?',
      ],
    },
  ],
  justice: [
    {
      key: 'public_order',
      title: 'Public Order & Safety',
      description:
        'Responses to crime, protests, riots, and Garda resourcing, balancing civil liberties and safety.',
      examplePrompts: [
        'Public order challenges require response. Should we expand Garda powers, increase community partnerships, strengthen sentencing, or improve social services?',
        'Safety funding can prioritize Garda expansion, community partnerships, social programs, or rehabilitation. Which approach should come first?',
      ],
    },
  ],
  education: [
    {
      key: 'higher_ed_fees',
      title: 'Higher Education Funding & Fees',
      description:
        'Policy changes around university fees, student supports, and apprenticeship funding.',
      examplePrompts: [
        'Education funding can prioritize fee reduction, apprenticeship expansion, staff recruitment, or infrastructure. Which should be funded?',
        'Education pathways can be equalized via fee reductions, apprenticeship funding, access programs, or maintenance grants. Which priority?',
      ],
    },
  ],
  infrastructure: [
    {
      key: 'transport_investment',
      title: 'Transport & Regional Investment',
      description:
        'Major capital projects, transport connectivity, and regional development priorities.',
      examplePrompts: [
        'A €10bn transport project can be delivered via PPP, state-owned, hybrid approach, or deferred. Which method?',
        'Transport investment can prioritize urban metro, rural services, regional rail, or road upgrades. Which should come first?',
      ],
    },
  ],
  agriculture: [
    {
      key: 'agri_emissions',
      title: 'Agriculture & Emissions Reduction',
      description:
        'Measures balancing CAP payments, herd reduction, and supports for farmers in climate transition.',
      examplePrompts: [
        'Agricultural emissions must be reduced. Should we reduce herd size, support low-emission practices, fund transitions, or adjust targets?',
        'Farm support can prioritize low-emission incentives, herd reduction payments, transition funding, or maintaining current practices. Which approach?',
      ],
    },
  ],
  technology: [
    {
      key: 'ai_regulation',
      title: 'Technology & AI Regulation',
      description:
        'Positions on data protection, AI governance, and tech industry oversight.',
      examplePrompts: [
        'AI governance can be strict regulation, industry self-regulation, expert oversight, or minimal intervention. Which approach feels right?',
      ],
    },
  ],
  other: [
    {
      key: 'general_governance',
      title: 'General Governance & Accountability',
      description:
        'Catch-all for reform proposals, transparency debates, and cross-cutting governance issues.',
      examplePrompts: [
        'Transparency can be improved via real-time publication, proactive disclosure, FOI reform, or selective release. Which method should be prioritized?',
      ],
    },
  ],
};

export const HIGH_PRIORITY_TOPICS = new Set<string>([
  'foreign_aid',
  'asylum_supports',
  'public_housing_targets',
  'health_capacity',
  'climate_targets',
  'cost_of_living',
]);

export function normalisePolicyTopic(topic: string): string {
  return topic.trim().toLowerCase().replace(/\s+/g, '_');
}



