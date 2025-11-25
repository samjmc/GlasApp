import { supabaseDb as supabase } from "../db.js";
import { supabaseAdmin } from "../auth/supabaseAuth.js";
import { PersonalRankingsService } from "./personalRankingsService.js";
import { UserIdeologyProfileService } from "./userIdeologyProfileService.js";
import {
  IDEOLOGY_DIMENSIONS,
  clampIdeologyValue,
  emptyIdeologyVector,
  type IdeologyDimension,
} from "../constants/ideology.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateVoteQuestion } from "../services/openaiService.js";

type VoteOpportunityRecord = {
  id: number;
  article_id: number;
  question_text: string | null;
  policy_domain: string | null;
  policy_topic: string | null;
  created_at: string;
};

type PolicyItemCandidate = {
  policy_vote_id: number | null;
  id: number;
  title: string;
  ai_summary: string | null;
  policy_direction: string | null;
  published_date: string;
  url: string | null;
  td_policy_stances: Array<{
    policy_dimension: string | null;
    stance_strength: number | null;
    politician_name: string | null;
  }>;
  question_text: string | null;
  policy_domain: string | null;
  policy_topic: string | null;
};

export interface DailySessionItem {
  id: number;
  sessionItemId: number;
  articleId: number;
  policyVoteId?: number | null;
  headline: string;
  summary: string;
  policyDimension: string | null;
  policyDirection: string | null;
  orderIndex: number;
  hasVoted: boolean;
  rating?: number;
  selectedOption?: string | null; // NEW: Option key when using multiple choice
  answerOptions?: Record<string, string> | null; // NEW: Multiple choice options
  politicianName?: string | null;
  prompt?: string;
  emoji?: string;
  highlightStats?: string[];
  contextNote?: string;
  articleUrl?: string | null;
  quickExplainer?: {
    summary: string;
    pros: string[];
    cons: string[];
  };
}

export interface DailySessionState {
  status: "pending" | "completed";
  sessionId: number;
  sessionDate: string;
  voteCount: number;
  streakCount: number;
  items: DailySessionItem[];
  completion?: DailySessionCompletion;
}

export interface DailySessionDimensionShift {
  ideologyDimension: IdeologyDimension;
  axisLabel: string;
  delta: number;
  deltaPercent: number;
  before: number;
  after: number;
  direction: "left" | "right" | "neutral";
}

export interface DailySessionCompletion {
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: "left" | "right" | "neutral";
  regionSummary: string;
  regionDimension?: string;
  regionPreviousRank?: number;
  regionCurrentRank?: number;
  streakCount: number;
  userComparison?: string;
  regionComparison?: string;
  constituencyTrend?: string;
  dimensionShifts: DailySessionDimensionShift[];
  historySnapshot?: {
    previousDate: string;
    previousAxis: string;
    previousDirection: "left" | "right" | "neutral";
    previousDelta: number;
    deltaChange: number;
    streakChange: number;
  };
  detailStats?: Array<{
    label: string;
    value: string;
    emoji?: string;
  }>;
}

const DAILY_ITEM_COUNT = 3;
const PRIMARY_WINDOW_HOURS = 24;
const MAX_FALLBACK_WINDOWS = 14;

function devResetEnabled(extraForce?: boolean): boolean {
  if (extraForce) return true;
  const flag = process.env.DAILY_SESSION_ALWAYS_RESET;
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
const POLICY_DIMENSION_PRIORITY: Record<string, number> = {
  economy: 1,
  housing: 1,
  immigration: 1,
  healthcare: 2,
  environment: 2,
  social_issues: 3,
  justice: 3,
  education: 3,
};

const POLICY_DIMENSION_TO_IDEOLOGY: Partial<Record<string, IdeologyDimension>> = {
  economy: "economic",
  housing: "welfare",
  healthcare: "welfare",
  immigration: "globalism",
  environment: "environmental",
  social_issues: "social",
  justice: "authority",
  education: "technocratic",
  culture: "cultural",  // NEW: explicit cultural dimension
  identity: "cultural",  // Cultural identity, national identity
  tradition: "cultural", // Traditional values vs progressive values
};

const CANONICAL_POLICY_DIMENSIONS = new Set(
  Object.keys(POLICY_DIMENSION_TO_IDEOLOGY)
);

const POLICY_DIMENSION_ALIAS: Record<string, string> = {
  economic: "economy",
  economics: "economy",
  fiscal: "economy",
  finance: "economy",
  finances: "economy",
  tax: "economy",
  taxation: "economy",
  taxes: "economy",
  budget: "economy",
  budgets: "economy",
  job: "economy",
  jobs: "economy",
  employment: "economy",
  business: "economy",
  enterprise: "economy",
  inflation: "economy",
  pension: "economy",
  pensions: "economy",
  wage: "economy",
  wages: "economy",
  pay: "economy",
  income: "economy",
  "cost of living": "economy",
  "cost-of-living": "economy",
  housing: "housing",
  house: "housing",
  houses: "housing",
  home: "housing",
  homes: "housing",
  rent: "housing",
  rents: "housing",
  rental: "housing",
  renting: "housing",
  tenant: "housing",
  tenants: "housing",
  mortgage: "housing",
  mortgages: "housing",
  planning: "housing",
  accommodation: "housing",
  homeless: "housing",
  homelessness: "housing",
  immigration: "immigration",
  migration: "immigration",
  migrant: "immigration",
  migrants: "immigration",
  asylum: "immigration",
  refugee: "immigration",
  refugees: "immigration",
  border: "immigration",
  borders: "immigration",
  citizenship: "immigration",
  visa: "immigration",
  visas: "immigration",
  healthcare: "healthcare",
  health: "healthcare",
  hospital: "healthcare",
  hospitals: "healthcare",
  medical: "healthcare",
  medicine: "healthcare",
  medicines: "healthcare",
  hse: "healthcare",
  nhs: "healthcare",
  doctor: "healthcare",
  doctors: "healthcare",
  nurse: "healthcare",
  nurses: "healthcare",
  gp: "healthcare",
  gps: "healthcare",
  "mental health": "healthcare",
  mentalhealth: "healthcare",
  care: "healthcare",
  environment: "environment",
  environmental: "environment",
  climate: "environment",
  "climate action": "environment",
  emissions: "environment",
  emission: "environment",
  carbon: "environment",
  energy: "environment",
  renewable: "environment",
  renewables: "environment",
  green: "environment",
  biodiversity: "environment",
  sustainability: "environment",
  sustainable: "environment",
  social: "social_issues",
  society: "social_issues",
  equality: "social_issues",
  equity: "social_issues",
  rights: "social_issues",
  welfare: "social_issues",
  poverty: "social_issues",
  inclusion: "social_issues",
  community: "social_issues",
  communities: "social_issues",
  family: "social_issues",
  families: "social_issues",
  childcare: "social_issues",
  disability: "social_issues",
  disabilities: "social_issues",
  gender: "social_issues",
  abortion: "social_issues",
  justice: "justice",
  crime: "justice",
  criminal: "justice",
  policing: "justice",
  police: "justice",
  security: "justice",
  law: "justice",
  courts: "justice",
  court: "justice",
  sentencing: "justice",
  sentence: "justice",
  garda: "justice",
  gardai: "justice",
  "law and order": "justice",
  education: "education",
  school: "education",
  schools: "education",
  teacher: "education",
  teachers: "education",
  pupil: "education",
  pupils: "education",
  student: "education",
  students: "education",
  classroom: "education",
  college: "education",
  colleges: "education",
  university: "education",
  universities: "education",
  tuition: "education",
  curriculum: "education",
  literacy: "education",
  apprenticeship: "education",
  apprenticeships: "education",
  skills: "education",
  training: "education",
  culture: "culture",
  cultural: "culture",
  identity: "identity",
  national: "identity",
  nationalism: "identity",
  tradition: "tradition",
  traditional: "tradition",
  values: "tradition",
  heritage: "culture",
  language: "culture",
  irish: "culture",
  gaelic: "culture",
  gaeltacht: "culture",
};

const POLICY_DIMENSION_KEYWORDS: Record<string, string[]> = {
  economy: [
    "economy",
    "economic",
    "fiscal",
    "tax",
    "budget",
    "jobs",
    "employment",
    "business",
    "enterprise",
    "inflation",
    "pension",
    "wage",
    "wages",
    "income",
    "cost of living",
    "cost-of-living",
  ],
  housing: [
    "housing",
    "house",
    "homes",
    "rent",
    "rental",
    "tenant",
    "mortgage",
    "planning",
    "accommodation",
    "homeless",
  ],
  immigration: [
    "immigration",
    "migration",
    "asylum",
    "refugee",
    "border",
    "borders",
    "visa",
    "citizenship",
  ],
  healthcare: [
    "health",
    "healthcare",
    "hospital",
    "medical",
    "doctor",
    "nurse",
    "mental health",
    "care",
    "waiting list",
  ],
  environment: [
    "environment",
    "climate",
    "energy",
    "emissions",
    "carbon",
    "renewable",
    "green",
    "sustainable",
    "biodiversity",
  ],
  culture: [
    "culture",
    "cultural",
    "heritage",
    "language",
    "irish",
    "gaelic",
    "gaeltacht",
    "arts",
    "music",
    "literature",
    "history",
    "tradition",
  ],
  identity: [
    "identity",
    "national",
    "nationalism",
    "patriotism",
    "sovereignty",
    "unity",
    "irish identity",
  ],
  tradition: [
    "tradition",
    "traditional",
    "values",
    "conservative values",
    "family values",
    "religious",
    "church",
  ],
  social_issues: [
    "social",
    "equality",
    "welfare",
    "poverty",
    "family",
    "childcare",
    "community",
    "rights",
    "inclusion",
    "gender",
    "abortion",
  ],
  justice: [
    "justice",
    "crime",
    "police",
    "policing",
    "security",
    "law and order",
    "court",
    "courts",
    "sentencing",
    "garda",
  ],
  education: [
    "education",
    "school",
    "schools",
    "teacher",
    "teachers",
    "student",
    "students",
    "college",
    "university",
    "curriculum",
    "skills",
    "training",
  ],
};

function normalizePolicyDimension(value?: string | null): string | null {
  if (!value) return null;
  const processed = value
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!processed) return null;

  if (CANONICAL_POLICY_DIMENSIONS.has(processed)) {
    return processed;
  }

  if (POLICY_DIMENSION_ALIAS[processed]) {
    return POLICY_DIMENSION_ALIAS[processed];
  }

  const collapsed = processed.replace(/\s+/g, "");
  if (POLICY_DIMENSION_ALIAS[collapsed]) {
    return POLICY_DIMENSION_ALIAS[collapsed];
  }

  for (const token of processed.split(" ")) {
    if (CANONICAL_POLICY_DIMENSIONS.has(token)) {
      return token;
    }
    if (POLICY_DIMENSION_ALIAS[token]) {
      return POLICY_DIMENSION_ALIAS[token];
    }
  }

  const keywordMatch = detectDimensionFromText(processed);
  if (keywordMatch) {
    return keywordMatch;
  }

  return null;
}

function detectDimensionFromText(
  ...texts: Array<string | null | undefined>
): string | null {
  const scores = new Map<string, number>();

  for (const text of texts) {
    if (!text) continue;
    const normalized = text
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ");

    for (const [dimension, keywords] of Object.entries(
      POLICY_DIMENSION_KEYWORDS
    )) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          scores.set(dimension, (scores.get(dimension) ?? 0) + 1);
        }
      }
    }
  }

  if (scores.size === 0) {
    return null;
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])[0]![0];
}

function resolvePolicyDimensionFromValues(
  values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const normalized = normalizePolicyDimension(value);
    if (normalized) {
      return normalized;
    }
  }

  const textMatch = detectDimensionFromText(...values);
  if (textMatch) {
    return textMatch;
  }

  return null;
}

const IDEOLOGY_LEARNING_RATE = 0.1;

async function loadUserIdeologyVector(
  client: SupabaseClient,
  userId: string
): Promise<{
  vector: Record<IdeologyDimension, number>;
  totalWeight: number;
} | null> {
  const { data, error } = await client
    .from("user_ideology_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user ideology profile", error);
    return null;
  }

  const vector = emptyIdeologyVector();
  for (const dimension of IDEOLOGY_DIMENSIONS) {
    vector[dimension] = Number(data?.[dimension] ?? 0);
  }

  return {
    vector,
    totalWeight: Number(data?.total_weight ?? 0),
  };
}

function mapIdeologyDimensionToAxisLabel(dimension: IdeologyDimension): string {
  const labels: Record<IdeologyDimension, string> = {
    economic: "Economic Left - Right",
    social: "Social Progressive - Conservative",
    cultural: "Cultural Liberal - Traditional",
    authority: "Authority Libertarian - Authoritarian",
    environmental: "Climate Aggressive - Moderate",
    welfare: "Welfare Expansive - Limited",
    globalism: "Globalism International - National",
    technocratic: "Technocratic Expert-Led - Populist",
  };
  return labels[dimension] ?? dimension;
}

function formatPercent(value: number, fractionDigits = 1): string {
  const rounded = Number(value.toFixed(fractionDigits));
  const sign = rounded >= 0 ? "+" : "-";
  return `${sign}${Math.abs(rounded).toFixed(fractionDigits)}%`;
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

function resolveSupabaseClient(accessToken?: string | null): SupabaseClient {
  if (supabase) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DailySession] Using shared supabase service client");
    }
    return supabase;
  }

  if (supabaseAdmin) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DailySession] Using supabaseAdmin service client");
    }
    return supabaseAdmin;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase credentials missing – set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or provide user access token"
    );
  }

  if (!accessToken) {
    throw new Error("Supabase access token required to perform this operation");
  }

  const customFetch: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers ?? {});
    headers.set("apikey", SUPABASE_ANON_KEY);
    headers.set("Authorization", `Bearer ${accessToken}`);
    if (process.env.NODE_ENV !== "production") {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;
      console.debug("[DailySession] Supabase fetch", {
        url,
        hasAuth: headers.has("Authorization"),
        authPrefix: headers.get("Authorization")?.slice(0, 16),
      });
    }
    return fetch(input, {
      ...init,
      headers,
    });
  };

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: customFetch,
    },
  });
  client.auth.setAuth(accessToken);
  return client;
}

function summarizeText(text: string | null, minSentences = 2, maxSentences = 4): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  
  // Split by sentence endings (period, exclamation, question mark followed by space or end of string)
  const sentences = trimmed
    .split(/(?<=[.!?])(\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.match(/[.!?]$/)); // Only include complete sentences
  
  // If we have fewer sentences than minSentences, return what we have (don't truncate)
  if (sentences.length < minSentences) {
    return sentences.join(" ");
  }
  
  // If we have more than maxSentences, take up to maxSentences
  // This ensures we don't cut mid-sentence
  if (sentences.length > maxSentences) {
    return sentences.slice(0, maxSentences).join(" ");
  }
  
  // Return all sentences if within range (2-4)
  return sentences.join(" ");
}

function shuffleArray<T>(items: T[]): T[] {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

function ratingToImpact(rating: number): number {
  return (rating - 3) / 2; // maps 1..5 to -1..+1
}

function directionMultiplier(direction: string | null, rating: number): number {
  const normalized = direction?.toLowerCase().trim() ?? null;

  const progressiveDirections = new Set([
    "progressive",
    "expand",
    "increase",
    "grow",
    "left",
    "liberal",
  ]);

  const conservativeDirections = new Set([
    "conservative",
    "reduce",
    "decrease",
    "shrink",
    "right",
    "restrict",
  ]);

  const neutralDirections = new Set([
    "neutral",
    "centrist",
    "balance",
    "status_quo",
    "maintain",
    "technical",
  ]);

  if (normalized && progressiveDirections.has(normalized)) {
    return -1;  // Progressive/left policies move you left (negative direction)
  }

  if (normalized && conservativeDirections.has(normalized)) {
    return 1;  // Conservative/right policies move you right (positive direction)
  }

  if (normalized && neutralDirections.has(normalized)) {
    if (rating > 3) return 1;
    if (rating < 3) return -1;
    return 0;
  }

  if (rating > 3) return 1;
  if (rating < 3) return -1;
  return 0;
}

function mapPolicyDimensionToIdeologyDimension(
  policyDimension?: string | null
): IdeologyDimension | null {
  if (!policyDimension) return null;
  return POLICY_DIMENSION_TO_IDEOLOGY[policyDimension] ?? null;
}

function mapDimensionToAxis(dimension: string | null): string {
  if (!dimension) return "Overall";
  switch (dimension) {
    case "economy":
    case "housing":
      return "Economic";
    case "immigration":
    case "justice":
      return "Security & Borders";
    case "healthcare":
    case "education":
    case "social_issues":
      return "Social";
    case "environment":
      return "Climate";
    default:
      return "Overall";
  }
}

function formatIdeologySummary(
  axis: string,
  deltaPercent: number,
  direction: "left" | "right" | "neutral"
): string {
  if (direction === "neutral" || deltaPercent === 0) {
    return `Your ${axis.toLowerCase()} stance held steady today.`;
  }
  const adjective = axis === "Economic" ? "Economic" : axis;
  const directionLabel =
    direction === "left"
      ? `${adjective} Left`
      : direction === "right"
      ? `${adjective} Right`
      : adjective;
  return `Your ideology shifted ${deltaPercent > 0 ? "+" : "-"}${Math.abs(
    deltaPercent
  ).toFixed(1)}% toward ${directionLabel}.`;
}

function mapDimensionLabel(dimension: string | null): string {
  if (!dimension) return "Overall";
  const labels: Record<string, string> = {
    economy: "Economic",
    housing: "Housing",
    immigration: "Immigration",
    healthcare: "Healthcare",
    environment: "Climate",
    social_issues: "Social Policy",
    justice: "Justice & Security",
    education: "Education",
  };
  return labels[dimension] || dimension.replace(/_/g, " ");
}

async function fetchUserTopDimensions(
  userId: string
): Promise<string[]> {
  const profile = await PersonalRankingsService.getUserProfile(userId);
  if (!profile) return [];

  const dimensionScores: Array<[string, number]> = [
    ["immigration", profile.immigration],
    ["healthcare", profile.healthcare],
    ["housing", profile.housing],
    ["economy", profile.economy],
    ["environment", profile.environment],
    ["social_issues", profile.social_issues],
    ["justice", profile.justice],
    ["education", profile.education],
  ];

  return dimensionScores
    .sort((a, b) => b[1] - a[1])
    .map(([dimension]) => dimension);
}

async function fetchRecentUserDimension(
  client: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await client
    .from("daily_session_items")
    .select(
      `
        policy_dimension,
        votes:daily_session_votes(rating)
      `
    )
    .eq("votes.user_id", userId)
    .order("votes.created_at", { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return null;

  const dimensionCount = new Map<string, number>();
  for (const row of data) {
    const dimension = row.policy_dimension;
    if (!dimension) continue;
    dimensionCount.set(dimension, (dimensionCount.get(dimension) || 0) + 1);
  }

  let topDimension: string | null = null;
  let maxCount = 0;
  for (const [dimension, count] of dimensionCount.entries()) {
    if (count > maxCount) {
      maxCount = count;
      topDimension = dimension;
    }
  }
  return topDimension;
}

/**
 * Get ideology dimension balance for the user over the past 7 days
 * Returns dimensions sorted by priority (least covered first)
 */
async function getIdeologyDimensionBalance(
  client: SupabaseClient,
  userId: string
): Promise<IdeologyDimension[]> {
  // Fetch user's votes from past 7 days
  const { data } = await client
    .from("daily_session_items")
    .select(
      `
        policy_dimension,
        created_at,
        votes:daily_session_votes!inner(user_id)
      `
    )
    .eq("votes.user_id", userId)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Count ideology dimensions
  const ideologyCount = new Map<IdeologyDimension, number>();
  for (const dim of IDEOLOGY_DIMENSIONS) {
    ideologyCount.set(dim, 0);
  }

  if (data) {
    for (const item of data) {
      const policyDim = item.policy_dimension;
      const ideologyDim = mapPolicyDimensionToIdeologyDimension(policyDim);
      if (ideologyDim) {
        ideologyCount.set(ideologyDim, (ideologyCount.get(ideologyDim) ?? 0) + 1);
      }
    }
  }

  // Sort by count (ascending) - least covered first
  const sorted = Array.from(ideologyCount.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([dim]) => dim);

  console.log('📊 Ideology dimension coverage (last 7 days):', 
    Array.from(ideologyCount.entries()).map(([dim, count]) => `${dim}:${count}`).join(', ')
  );

  return sorted;
}

async function fetchVoteOpportunitiesWindow(
  client: SupabaseClient,
  windowStartIso: string,
  windowEndIso: string
): Promise<VoteOpportunityRecord[]> {
  const { data, error } = await client
    .from("policy_vote_opportunities")
    .select(
      `
        id,
        article_id,
        question_text,
        policy_domain,
        policy_topic,
        created_at
      `
    )
    .gte("created_at", windowStartIso)
    .lt("created_at", windowEndIso)
    .order("created_at", { ascending: false })
    .limit(160);

  if (error) {
    console.error("Failed to fetch vote opportunities", error);
    throw error;
  }

  return data ?? [];
}

async function fetchOpportunityCandidates(
  client: SupabaseClient
): Promise<PolicyItemCandidate[]> {
  const collectedCandidates = new Map<number, PolicyItemCandidate>();
  const now = new Date();

  for (let windowIndex = 0; windowIndex < MAX_FALLBACK_WINDOWS; windowIndex += 1) {
    const windowEnd = new Date(now.getTime() - windowIndex * PRIMARY_WINDOW_HOURS * 60 * 60 * 1000);
    const windowStart = new Date(windowEnd.getTime() - PRIMARY_WINDOW_HOURS * 60 * 60 * 1000);

    const opportunities = await fetchVoteOpportunitiesWindow(
      client,
      windowStart.toISOString(),
      windowEnd.toISOString()
    );

    if (!opportunities.length) {
      continue;
    }

    const articleIds = Array.from(
      new Set(
        opportunities
          .map((opp) => opp.article_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    if (articleIds.length === 0) {
      continue;
    }

    const { data: articles, error: articleError } = await client
      .from("news_articles")
      .select(
        `
          id,
          title,
          ai_summary,
          policy_direction,
          published_date,
          url,
          td_policy_stances (
            policy_dimension,
            stance_strength,
            politician_name
          )
        `
      )
      .in("id", articleIds)
      .order("published_date", { ascending: false });

    if (articleError) {
      console.error("Failed to fetch articles for vote opportunities", articleError);
      throw articleError;
    }

    const articleMap = new Map<number, any>();
    (articles ?? []).forEach((article) => {
      articleMap.set(article.id, article);
    });

    const windowCandidates: PolicyItemCandidate[] = opportunities
      .map((opp) => {
        const article = articleMap.get(opp.article_id);
        if (!article) return null;
        return {
          policy_vote_id: opp.id,
          id: article.id,
          title: article.title,
          ai_summary: article.ai_summary,
          policy_direction: article.policy_direction,
          published_date: article.published_date,
          url: article.url ?? null,
          td_policy_stances: article.td_policy_stances ?? [],
          question_text: opp.question_text,
          policy_domain: opp.policy_domain,
          policy_topic: opp.policy_topic,
        } as PolicyItemCandidate;
      })
      .filter(Boolean) as PolicyItemCandidate[];

    const randomized = shuffleArray(windowCandidates);

    for (const candidate of randomized) {
      if (!collectedCandidates.has(candidate.id)) {
        collectedCandidates.set(candidate.id, candidate);
      }
      if (collectedCandidates.size >= DAILY_ITEM_COUNT) {
        break;
      }
    }

    if (collectedCandidates.size >= DAILY_ITEM_COUNT) {
      break;
    }
  }

  const finalCandidates = shuffleArray(Array.from(collectedCandidates.values()));

  if (finalCandidates.length === 0) {
    throw new Error("No eligible policy vote opportunities found within fallback window");
  }

  return finalCandidates;
}

async function fetchLegacyPolicyCandidates(
  client: SupabaseClient,
  sinceISO: string
): Promise<PolicyItemCandidate[]> {
  const { data, error } = await client
    .from("news_articles")
    .select(
      `
        id,
        title,
        ai_summary,
        policy_direction,
        published_date,
        url,
        td_policy_stances (
          policy_dimension,
          stance_strength,
          politician_name
        )
      `
    )
    .gte("published_date", sinceISO)
    .eq("is_ideological_policy", true)
    .order("published_date", { ascending: false })
    .limit(120);

  if (error) {
    console.error("Failed to fetch legacy policy candidates", error);
    return [];
  }

  return (data ?? []).map((article) => ({
    policy_vote_id: null,
    id: article.id,
    title: article.title,
    ai_summary: article.ai_summary,
    policy_direction: article.policy_direction,
    published_date: article.published_date,
    url: article.url ?? null,
    td_policy_stances: article.td_policy_stances ?? [],
    question_text: null,
    policy_domain: null,
    policy_topic: null,
  }));
}

function formatLocationSummary(
  session: { county: string | null; constituency: string | null },
  regionData: {
    dimension?: string;
    previousRank?: number;
    currentRank?: number;
  }
): string {
  const locationType = session.county ? "county" : session.constituency ? "constituency" : null;
  const locationName = session.county ?? session.constituency ?? "";
  const dimensionLabel = mapDimensionLabel(regionData.dimension ?? null);

  if (!locationType) {
    return "Add your county or constituency to unlock local leaderboard shifts.";
  }

  if (!regionData.dimension) {
    return `Once more people in your ${locationType} finish, we'll highlight which issue is trending.`;
  }

  if (regionData.currentRank && regionData.previousRank) {
    if (regionData.currentRank < regionData.previousRank) {
      return `Your ${locationType}${locationName ? ` ${locationName}` : ""} pushed ${dimensionLabel} up from #${regionData.previousRank} to #${regionData.currentRank} today.`;
    }
    if (regionData.currentRank > regionData.previousRank) {
      return `Your ${locationType}${locationName ? ` ${locationName}` : ""} saw ${dimensionLabel} slip from #${regionData.previousRank} to #${regionData.currentRank}.`;
    }
  }

  if (regionData.currentRank) {
    return `${dimensionLabel} currently sits at #${regionData.currentRank} in your ${locationType}${locationName ? ` (${locationName})` : ""}.`;
  }

  return `We'll surface ${dimensionLabel} trends for your ${locationType} as soon as neighbours log their votes.`;
}

async function summarizeDimensionShifts(
  client: SupabaseClient,
  userId: string,
  entries: Array<{ policyDimension: string | null; delta: number }>
): Promise<{
  shifts: DailySessionDimensionShift[];
  dominant: DailySessionDimensionShift | null;
  totalDelta: number;
}> {
  if (entries.length === 0) {
    return { shifts: [], dominant: null, totalDelta: 0 };
  }

  const profileData = await loadUserIdeologyVector(client, userId);
  if (!profileData) {
    return { shifts: [], dominant: null, totalDelta: 0 };
  }

  const { vector } = profileData;
  const totals = new Map<IdeologyDimension, number>();
  let totalDelta = 0;

  for (const entry of entries) {
    const ideologyDimension = mapPolicyDimensionToIdeologyDimension(
      entry.policyDimension
    );
    if (!ideologyDimension || !entry.delta) continue;
    totals.set(
      ideologyDimension,
      (totals.get(ideologyDimension) ?? 0) + entry.delta
    );
    totalDelta += entry.delta;
  }

  const shifts: DailySessionDimensionShift[] = [];

  for (const [dimension, delta] of totals.entries()) {
    const after = vector[dimension] ?? 0;
    const before = clampIdeologyValue(after - delta);
    const deltaPercent = delta * 10;
    // Positive delta = moving right, Negative delta = moving left
    const direction =
      delta > 0.0001 ? "right" : delta < -0.0001 ? "left" : "neutral";

    shifts.push({
      ideologyDimension: dimension,
      axisLabel: mapIdeologyDimensionToAxisLabel(dimension),
      delta,
      deltaPercent,
      before,
      after,
      direction,
    });
  }

  shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    shifts,
    dominant: shifts[0] ?? null,
    totalDelta,
  };
}

function buildHistorySnapshot(
  previous: {
    sessionDate?: string;
    ideologyAxis?: string | null;
    ideologyDelta?: number | null;
    ideologyDirection?: string | null;
    streakCount?: number | null;
  },
  current: {
    ideologyAxis: string;
    ideologyDelta: number;
    ideologyDirection: "left" | "right" | "neutral";
    streakCount: number;
  }
): DailySessionCompletion["historySnapshot"] | undefined {
  if (!previous.sessionDate) return undefined;

  const prevDelta = Number(previous.ideologyDelta ?? 0);
  const prevAxis = previous.ideologyAxis || current.ideologyAxis;
  const prevDirection =
    (previous.ideologyDirection as "left" | "right" | "neutral") || "neutral";
  const deltaChange = current.ideologyDelta - prevDelta;
  const streakChange =
    current.streakCount - Number(previous.streakCount ?? current.streakCount);

  return {
    previousDate: previous.sessionDate,
    previousAxis: prevAxis,
    previousDirection: prevDirection,
    previousDelta: prevDelta,
    deltaChange,
    streakChange,
  };
}

function buildCompletionSummaryPayload({
  sessionMeta,
  ideologySummary,
  ideologyDelta,
  ideologyAxis,
  ideologyDirection,
  regionSummaryData,
  streakCount,
  dominantShift,
  dimensionShifts,
  totalDelta,
  impactDelta,
  voteCount,
  historySnapshot,
}: {
  sessionMeta: { county: string | null; constituency: string | null };
  ideologySummary: string;
  ideologyDelta: number;
  ideologyAxis: string;
  ideologyDirection: "left" | "right" | "neutral";
  regionSummaryData: {
    summary: string;
    dimension?: string;
    previousRank?: number;
    currentRank?: number;
  };
  streakCount: number;
  dominantShift: DailySessionDimensionShift | null;
  dimensionShifts: DailySessionDimensionShift[];
  totalDelta: number;
  impactDelta: number;
  voteCount: number;
  historySnapshot?: DailySessionCompletion["historySnapshot"];
}): DailySessionCompletion {
  const axisLabel = ideologyAxis || "Overall";
  const roundedImpactDeltaPercent = impactDelta * 10;
  const roundedTotalDeltaPercent = totalDelta * 10;

  const dimensionStats = dimensionShifts.map((shift) => ({
    label: `${shift.axisLabel} axis`,
    value: `${formatPercent(shift.deltaPercent)} toward ${
      shift.direction === "left"
        ? "Left"
        : shift.direction === "right"
        ? "Right"
        : "centre"
    } (${shift.before.toFixed(2)} → ${shift.after.toFixed(2)})`,
    emoji:
      shift.direction === "left"
        ? "⬅️"
        : shift.direction === "right"
        ? "➡️"
        : "⚖️",
  }));

  const detailStats = [
    ...dimensionStats,
    ...(dimensionStats.length === 0
      ? [
          {
            label: "Axis shift",
            value: "No significant ideological change logged today.",
            emoji: "🧭",
          },
        ]
      : []),
    {
      label: "Impact vs yesterday",
      value: `${formatPercent(roundedImpactDeltaPercent)} impact change`,
      emoji: roundedImpactDeltaPercent >= 0 ? "📈" : "📉",
    },
    {
      label: "Total impact",
      value: `${formatPercent(roundedTotalDeltaPercent)} logged today`,
      emoji: "⚖️",
    },
    {
      label: "Issues completed",
      value: `${voteCount} of ${DAILY_ITEM_COUNT} issues logged`,
      emoji: "🗳️",
    },
  ];

  const movementText =
    ideologyDirection === "neutral"
      ? `You held your ${axisLabel.toLowerCase()} stance steady today.`
      : `You moved ${formatPercent(ideologyDelta)} toward the ${
          axisLabel
        } ${ideologyDirection === "left" ? "left" : "right"}.`;
  const impactText =
    roundedImpactDeltaPercent !== 0
      ? ` That's ${formatPercent(roundedImpactDeltaPercent)} versus yesterday.`
      : "";

  const constituencyTrend = formatLocationSummary(sessionMeta, regionSummaryData);

  return {
    ideologySummary,
    ideologyDelta,
    ideologyAxis,
    ideologyDirection,
    regionSummary: regionSummaryData.summary,
    regionDimension: regionSummaryData.dimension,
    regionPreviousRank: regionSummaryData.previousRank,
    regionCurrentRank: regionSummaryData.currentRank,
    streakCount,
    userComparison: `${movementText}${impactText}`,
    regionComparison: regionSummaryData.summary,
    constituencyTrend,
    dimensionShifts,
    historySnapshot,
    detailStats,
  };
}

async function fetchPolicyCandidates(
  client: SupabaseClient
): Promise<PolicyItemCandidate[]> {
  const opportunityCandidates = await fetchOpportunityCandidates(client);
  if (opportunityCandidates.length >= DAILY_ITEM_COUNT) {
    return opportunityCandidates;
  }

  const fallbackCutoff = new Date();
  fallbackCutoff.setHours(fallbackCutoff.getHours() - PRIMARY_WINDOW_HOURS * MAX_FALLBACK_WINDOWS);
  const legacyCandidates = await fetchLegacyPolicyCandidates(
    client,
    fallbackCutoff.toISOString()
  );

  const merged = new Map<number, PolicyItemCandidate>();
  for (const candidate of [...opportunityCandidates, ...legacyCandidates]) {
    if (!merged.has(candidate.id)) {
      merged.set(candidate.id, candidate);
    }
  }

  return shuffleArray(Array.from(merged.values()));
}

function deriveDimension(candidate: PolicyItemCandidate): string | null {
  const stances = candidate.td_policy_stances || [];
  if (stances.length > 0) {
    const sorted = [...stances].sort(
      (a, b) => (b.stance_strength || 0) - (a.stance_strength || 0)
    );

    for (const stance of sorted) {
      const normalized = normalizePolicyDimension(stance.policy_dimension);
      if (normalized) {
        return normalized;
      }
    }
  }

  const metadataDimension = resolvePolicyDimensionFromValues([
    candidate.policy_domain,
    candidate.policy_topic,
    candidate.title,
    candidate.ai_summary ?? undefined,
  ]);
  if (metadataDimension) {
    return metadataDimension;
  }

  return null;
}

function derivePolitician(candidate: PolicyItemCandidate): string | null {
  const stances = candidate.td_policy_stances || [];
  if (stances.length === 0) return null;
  const best = [...stances].sort(
    (a, b) => (b.stance_strength || 0) - (a.stance_strength || 0)
  )[0];
  return best?.politician_name || null;
}

async function inferPolicyDimensionForItem(
  client: SupabaseClient,
  itemRecord: {
    id: number;
    article_id: number | null;
    policy_dimension: string | null;
    policy_vote_id: number | null;
  }
): Promise<string | null> {
  const normalizedExisting = normalizePolicyDimension(
    itemRecord.policy_dimension
  );
  if (normalizedExisting) {
    if (normalizedExisting !== itemRecord.policy_dimension) {
      const { error: syncError } = await client
        .from("daily_session_items")
        .update({ policy_dimension: normalizedExisting })
        .eq("id", itemRecord.id);
      if (syncError) {
        console.error(
          "Failed to normalize existing policy dimension",
          syncError
        );
      }
    }
    return normalizedExisting;
  }

  if (!itemRecord.article_id) {
    return null;
  }

  const { data: article, error: articleError } = await client
    .from("news_articles")
    .select(
      `
        id,
        title,
        ai_summary,
        policy_direction,
        published_date,
        url,
        td_policy_stances (
          policy_dimension,
          stance_strength,
          politician_name
        )
      `
    )
    .eq("id", itemRecord.article_id)
    .maybeSingle();

  if (articleError) {
    console.error(
      "Failed to fetch article for policy dimension inference",
      articleError
    );
    return null;
  }

  if (!article) {
    return null;
  }

  let opportunity:
    | {
        policy_domain: string | null;
        policy_topic: string | null;
        question_text: string | null;
      }
    | null = null;

  if (itemRecord.policy_vote_id) {
    const { data: opportunityRow, error: opportunityError } = await client
      .from("policy_vote_opportunities")
      .select("policy_domain, policy_topic, question_text")
      .eq("id", itemRecord.policy_vote_id)
      .maybeSingle();

    if (opportunityError) {
      console.error(
        "Failed to fetch policy vote opportunity for dimension inference",
        opportunityError
      );
    } else {
      opportunity = opportunityRow ?? null;
    }
  }

  if (!opportunity) {
    const { data: fallbackOpportunity, error: fallbackError } = await client
      .from("policy_vote_opportunities")
      .select("policy_domain, policy_topic, question_text")
      .eq("article_id", itemRecord.article_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackError) {
      console.error(
        "Failed to fetch opportunity by article for dimension inference",
        fallbackError
      );
    } else {
      opportunity = fallbackOpportunity ?? null;
    }
  }

  const candidate: PolicyItemCandidate = {
    policy_vote_id: itemRecord.policy_vote_id,
    id: article.id,
    title: article.title,
    ai_summary: article.ai_summary,
    policy_direction: article.policy_direction,
    published_date: article.published_date ?? new Date().toISOString(),
    url: article.url ?? null,
    td_policy_stances: article.td_policy_stances ?? [],
    question_text: opportunity?.question_text ?? null,
    policy_domain: opportunity?.policy_domain ?? null,
    policy_topic: opportunity?.policy_topic ?? null,
  };

  const inferredDimension = deriveDimension(candidate);
  if (!inferredDimension) {
    return null;
  }

  const { error: persistError } = await client
    .from("daily_session_items")
    .update({ policy_dimension: inferredDimension })
    .eq("id", itemRecord.id);

  if (persistError) {
    console.error(
      "Failed to persist inferred policy dimension",
      persistError
    );
  }

  return inferredDimension;
}

function scoreCandidatePriority(
  dimension: string | null,
  index: number
): number {
  if (!dimension) return 10 + index;
  const base = POLICY_DIMENSION_PRIORITY[dimension] ?? 5;
  return base * 10 + index;
}

export class DailySessionService {
  static async getOrCreateSession(
    userId: string,
    options: { county?: string; constituency?: string; forceRefresh?: boolean } = {},
    accessToken?: string | null
  ): Promise<DailySessionState> {
    const client = resolveSupabaseClient(accessToken);
    const today = getTodayDate();

    const { data: existingSession } = await client
      .from("daily_sessions")
      .select("id, status, streak_count, session_date")
      .eq("user_id", userId)
      .eq("session_date", today)
      .maybeSingle();

    let sessionId: number;
    let sessionRecord = existingSession ?? null;

    const shouldReset = devResetEnabled(options.forceRefresh) && existingSession;

    if (shouldReset && existingSession) {
      const { error: deleteError } = await client
        .from("daily_sessions")
        .delete()
        .eq("id", existingSession.id);
      if (deleteError) {
        console.error("Failed to reset daily session:", deleteError);
        throw deleteError;
      }
      sessionRecord = null;
    }

    if (!sessionRecord) {
      const created = await this.createDailySession(
        client,
        userId,
        today,
        options,
        accessToken
      );
      sessionId = created.id;
    } else {
      sessionId = sessionRecord.id;
    }

    const sessionState = await this.getSessionState(client, sessionId, userId, accessToken);
    return sessionState;
  }

  private static async createDailySession(
    client: SupabaseClient,
    userId: string,
    sessionDate: string,
    options: { county?: string; constituency?: string },
    accessToken?: string | null
  ) {
    const candidates = await fetchPolicyCandidates(client);

    if (candidates.length === 0) {
      throw new Error("No policy issues available for daily session");
    }

    // NEW: Get balanced ideology dimensions based on what user has been missing
    const dimensionBalance = await getIdeologyDimensionBalance(client, userId);
    console.log('📊 Ideology dimension balance:', dimensionBalance);

    const randomizedCandidates = shuffleArray(candidates);

    const selectedItems: Array<{
      candidate: PolicyItemCandidate;
      dimension: string | null;
      politician: string | null;
    }> = [];

    const usedArticleIds = new Set<number>();
    const usedIdeologyDims = new Set<IdeologyDimension>();

    // Convert ideology dimensions to policy dimensions for matching
    const dimensionBalancePolicyDims: string[] = [];
    for (const ideologyDim of dimensionBalance) {
      // Find policy dimensions that map to this ideology dimension
      for (const [policyDim, ideoDim] of Object.entries(POLICY_DIMENSION_TO_IDEOLOGY)) {
        if (ideoDim === ideologyDim && !dimensionBalancePolicyDims.includes(policyDim)) {
          dimensionBalancePolicyDims.push(policyDim);
        }
      }
    }

    const pickCandidate = (preferredIdeologyDim?: IdeologyDimension) => {
      const ranked = randomizedCandidates
        .map((candidate, idx) => {
          const policyDim = deriveDimension(candidate);
          const ideologyDim = policyDim ? mapPolicyDimensionToIdeologyDimension(policyDim) : null;
          
          // Boost score if this ideology dimension is underrepresented
          let balanceBoost = 0;
          if (ideologyDim && !usedIdeologyDims.has(ideologyDim)) {
            const dimIndex = dimensionBalance.indexOf(ideologyDim);
            balanceBoost = dimIndex >= 0 ? (dimensionBalance.length - dimIndex) * 100 : 0;
          }
          
          const baseScore = scoreCandidatePriority(policyDim, idx);
          const score = baseScore - balanceBoost; // Lower score = higher priority
          
          return { candidate, policyDim, ideologyDim, idx, score };
        })
        .filter(({ candidate, ideologyDim }) => {
          if (usedArticleIds.has(candidate.id)) return false;
          if (!preferredIdeologyDim) return true;
          return ideologyDim === preferredIdeologyDim;
        })
        .sort((a, b) => a.score - b.score);

      if (ranked.length === 0) return null;
      const pick = ranked[0];
      usedArticleIds.add(pick.candidate.id);
      if (pick.ideologyDim) {
        usedIdeologyDims.add(pick.ideologyDim);
      }
      selectedItems.push({
        candidate: pick.candidate,
        dimension: pick.policyDim,
        politician: derivePolitician(pick.candidate),
      });
      console.log(`✓ Selected item: policy_dim=${pick.policyDim}, ideology_dim=${pick.ideologyDim}`);
      return pick;
    };

    // Select items prioritizing underrepresented ideology dimensions
    for (let i = 0; i < DAILY_ITEM_COUNT && dimensionBalance.length > 0; i++) {
      if (selectedItems.length >= DAILY_ITEM_COUNT) break;
      
      // Try to pick from underrepresented dimensions first
      const targetIdeologyDim = dimensionBalance[i % dimensionBalance.length];
      const picked = pickCandidate(targetIdeologyDim);
      
      // If we couldn't find a match for this dimension, pick any available
      if (!picked) {
        pickCandidate();
      }
    }

    // Fill remaining slots if needed
    while (selectedItems.length < DAILY_ITEM_COUNT) {
      const picked = pickCandidate();
      if (!picked) break;
    }

    if (selectedItems.length < DAILY_ITEM_COUNT) {
      throw new Error(
        `Failed to assemble daily session items: found ${selectedItems.length} of ${DAILY_ITEM_COUNT}`
      );
    }

    // Diversity Check: Ensure a healthy MIX of slider and multiple-choice questions
    // Count how many items have multiple choice vs slider
    const multipleChoiceCount = selectedItems.filter(
      (item) => item.candidate.policy_vote_id
    ).length;
    const sliderCount = selectedItems.length - multipleChoiceCount;

    console.log(`Question type distribution: ${multipleChoiceCount} multiple-choice, ${sliderCount} slider`);

    // If ALL are multiple choice or ALL are slider, convert some for diversity
    // Target: roughly 40-60% multiple choice
    const targetMultipleChoice = Math.floor(selectedItems.length * 0.5);
    
    if (multipleChoiceCount === 0 || multipleChoiceCount === selectedItems.length) {
      // Need to add diversity
      const needsMultipleChoice = multipleChoiceCount === 0;
      const numToConvert = needsMultipleChoice 
        ? Math.min(targetMultipleChoice, selectedItems.length)
        : Math.min(targetMultipleChoice, selectedItems.length);

      const candidatesForConversion = needsMultipleChoice
        ? selectedItems.filter((item) => !item.candidate.policy_vote_id)
        : selectedItems.filter((item) => item.candidate.policy_vote_id);

      // Convert up to numToConvert items
      const itemsToConvert = candidatesForConversion
        .sort(() => Math.random() - 0.5)
        .slice(0, numToConvert);

      for (const targetItem of itemsToConvert) {
        if (needsMultipleChoice && !targetItem.candidate.policy_vote_id) {
          // Convert slider to multiple choice
          try {
            console.log(`Converting slider to multiple-choice: ${targetItem.candidate.title}`);
            const numOptions = Math.random() > 0.5 ? 4 : 3;
            const generated = await generateVoteQuestion(
              targetItem.candidate.title,
              targetItem.candidate.ai_summary || "",
              numOptions
            );

            if (generated) {
              const { data: newOpp, error: oppError } = await client
                .from("policy_vote_opportunities")
                .insert({
                  article_id: targetItem.candidate.id,
                  question_text: generated.question_text,
                  answer_options: generated.answer_options,
                  policy_domain: targetItem.candidate.policy_domain || "general",
                  policy_topic: targetItem.candidate.policy_topic || "general",
                  created_at: new Date().toISOString(),
                })
                .select("id")
                .single();

              if (oppError) {
                console.error("Failed to persist generated vote opportunity:", oppError);
              } else if (newOpp) {
                targetItem.candidate.policy_vote_id = newOpp.id;
                targetItem.candidate.question_text = generated.question_text;
                console.log(`✓ Converted to ${numOptions}-option multiple choice`);
              }
            }
          } catch (err) {
            console.error("Error converting to multiple choice:", err);
          }
        } else if (!needsMultipleChoice && targetItem.candidate.policy_vote_id) {
          // Convert multiple choice to slider by removing the policy_vote_id reference
          console.log(`Converting multiple-choice to slider: ${targetItem.candidate.title}`);
          targetItem.candidate.policy_vote_id = null;
          targetItem.candidate.question_text = null;
        }
      }
    }

    const { data: sessionRecord, error: insertError } = await client
      .from("daily_sessions")
      .insert({
        user_id: userId,
        session_date: sessionDate,
        status: "pending",
        county: options.county || null,
        constituency: options.constituency || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create daily session:", insertError);
      throw insertError;
    }

    const sessionItems = selectedItems.map((item, idx) => ({
      session_id: sessionRecord.id,
      article_id: item.candidate.id,
      policy_vote_id: item.candidate.policy_vote_id ?? null,
      policy_dimension: item.dimension,
      policy_direction: item.candidate.policy_direction,
      headline: item.candidate.title,
      summary: summarizeText(item.candidate.ai_summary),
      politician_name: item.politician,
      order_index: idx,
    }));

    const { error: itemsError } = await client
      .from("daily_session_items")
      .insert(sessionItems);

    if (itemsError) {
      console.error("Failed to insert session items:", itemsError);
      throw itemsError;
    }

    return sessionRecord;
  }

  private static async getSessionState(
    client: SupabaseClient,
    sessionId: number,
    userId: string,
    accessToken?: string | null
  ): Promise<DailySessionState> {
    const { data: session, error: sessionError } = await client
      .from("daily_sessions")
      .select(
        `
          id,
          county,
          constituency,
          status,
          session_date,
          streak_count,
          ideology_summary,
          ideology_delta,
          ideology_axis,
          ideology_direction,
          region_shift_summary
        `
      )
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      throw new Error("Daily session not found");
    }

    const { data: items } = await client
      .from("daily_session_items")
      .select(
        `
          id,
          article_id,
          policy_vote_id,
          politician_name,
          headline,
          summary,
          policy_dimension,
          policy_direction,
          order_index,
          votes:daily_session_votes (
            rating,
            selected_option,
            impact_score,
            user_id
          )
        `
      )
      .eq("session_id", sessionId)
      .order("order_index", { ascending: true });

    const articleIds = Array.from(
      new Set(
        (items || [])
          .map((item) => item.article_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    const sliderVoteMap = new Map<number, number>();

    if (articleIds.length > 0) {
      const { data: sliderVotes, error: sliderVotesError } = await client
        .from("user_policy_votes")
        .select("article_id, support_rating")
        .eq("user_id", userId)
        .in("article_id", articleIds);

      if (sliderVotesError) {
        console.error("Failed to load user slider votes", sliderVotesError);
      } else {
        for (const vote of sliderVotes ?? []) {
          if (typeof vote.article_id === "number" && typeof vote.support_rating === "number") {
            sliderVoteMap.set(vote.article_id, vote.support_rating);
          }
        }
      }
    }

    const voteOpportunityMeta = new Map<
      number,
      { 
        question_text: string | null; 
        answer_options: Record<string, string> | null;
        policy_domain: string | null; 
        policy_topic: string | null;
      }
    >();
    const articleUrlMap = new Map<number, string | null>();
    const articleImageMap = new Map<number, string | null>();

    if (articleIds.length > 0) {
      const { data: opportunityRows, error: opportunityError } = await client
        .from("policy_vote_opportunities")
        .select(
          `
            article_id,
            question_text,
            answer_options,
            policy_domain,
            policy_topic,
            created_at
          `
        )
        .in("article_id", articleIds)
        .order("created_at", { ascending: false });

      if (opportunityError) {
        console.error("Failed to fetch vote opportunity metadata", opportunityError);
      } else {
        for (const row of opportunityRows || []) {
          if (!voteOpportunityMeta.has(row.article_id)) {
            voteOpportunityMeta.set(row.article_id, {
              question_text: row.question_text,
              answer_options: row.answer_options as Record<string, string> | null,
              policy_domain: row.policy_domain,
              policy_topic: row.policy_topic,
            });
          }
        }
      }

      const { data: articleRows, error: articleError } = await client
        .from("news_articles")
        .select("id, url, image_url")
        .in("id", articleIds);

      if (articleError) {
        console.error("Failed to fetch article URLs", articleError);
      } else {
        for (const article of articleRows || []) {
          articleUrlMap.set(article.id, article.url ?? null);
          articleImageMap.set(article.id, (article as any).image_url ?? null);
        }
      }
    }

    const pendingDimensionUpdates = new Map<number, string>();
    const resolvedDimensionByItemId = new Map<number, string>();
    const formattedItems: DailySessionItem[] = [];

    let fallbackIndex = 0;
    for (const item of items || []) {
      const userVote = (item.votes || []).find(
        (vote: any) => vote.user_id === userId
      );
      const opportunity = voteOpportunityMeta.get(item.article_id);
      const sliderVote = sliderVoteMap.get(item.article_id) ?? null;
      const hasDailySessionVote = !!userVote;
      const prefillRating = userVote?.rating ?? sliderVote ?? null;
      const prefillOption = userVote?.selected_option ?? null;

      const canonicalDimension = normalizePolicyDimension(
        item.policy_dimension
      );
      let policyDimension = canonicalDimension;

      if (policyDimension && policyDimension !== item.policy_dimension) {
        pendingDimensionUpdates.set(item.id, policyDimension);
      }

      if (!policyDimension) {
        policyDimension = resolvePolicyDimensionFromValues([
          item.policy_dimension,
          opportunity?.policy_domain,
          opportunity?.policy_topic,
          item.headline,
          item.summary,
        ]);
        if (policyDimension) {
          pendingDimensionUpdates.set(item.id, policyDimension);
        }
      }

      if (!policyDimension) {
        const inferred = await inferPolicyDimensionForItem(client, {
          id: item.id,
          article_id: item.article_id,
          policy_dimension: item.policy_dimension,
          policy_vote_id: item.policy_vote_id,
        });
        if (inferred) {
          policyDimension = inferred;
          pendingDimensionUpdates.set(item.id, inferred);
        }
      }

      if (policyDimension) {
        resolvedDimensionByItemId.set(item.id, policyDimension);
      }
      
      formattedItems.push({
        id: item.article_id,
        sessionItemId: item.id,
        articleId: item.article_id,
        policyVoteId: item.policy_vote_id,
        politicianName: item.politician_name,
        headline: item.headline,
        summary: item.summary,
        policyDimension,
        policyDirection: item.policy_direction,
        orderIndex: item.order_index ?? fallbackIndex,
        hasVoted: hasDailySessionVote,
        rating: prefillRating ?? undefined,
        selectedOption: prefillOption ?? null,
        answerOptions: opportunity?.answer_options ?? null,
        prompt: opportunity?.question_text ?? undefined,
        contextNote: opportunity?.policy_topic
          ? `Focus: ${opportunity.policy_topic}`
          : opportunity?.policy_domain ?? undefined,
        articleUrl: articleUrlMap.get(item.article_id) ?? null,
        imageUrl: articleImageMap.get(item.article_id) ?? null,
      });

      fallbackIndex += 1;
    }

    if (pendingDimensionUpdates.size > 0) {
      const updates = Array.from(pendingDimensionUpdates.entries()).map(
        ([id, policy_dimension]) => ({
          id,
          policy_dimension,
        })
      );

      const { error: dimensionUpdateError } = await client
        .from("daily_session_items")
        .upsert(updates, { onConflict: "id" });

      if (dimensionUpdateError) {
        console.error(
          "Failed to backfill policy dimensions for session items",
          dimensionUpdateError
        );
      }
    }

    const votesCompleted = formattedItems.filter((item) => item.hasVoted).length;
    const votedItems = (items || []).filter((item) =>
      (item.votes || []).some((vote: any) => vote.user_id === userId)
    );
    const voteEntries = votedItems.map((item) => {
      const resolvedDimension =
        resolvedDimensionByItemId.get(item.id) ??
        normalizePolicyDimension(item.policy_dimension);
      return {
        policyDimension: resolvedDimension,
        delta:
          (item.votes || []).find((vote: any) => vote.user_id === userId)
            ?.impact_score ?? 0,
      };
    });
    const { shifts, dominant, totalDelta } = await summarizeDimensionShifts(
      client,
      userId,
      voteEntries
    );
    const previousMeta = await this.fetchPreviousSessionMeta(
      client,
      userId,
      session.session_date
    );

    const baseState: DailySessionState = {
      status: session.status as "pending" | "completed",
      sessionId: session.id,
      sessionDate: session.session_date,
      voteCount: votesCompleted,
      streakCount: session.streak_count ?? 0,
      items: formattedItems,
    };

    if (session.status === "completed") {
      const focusDimensions = votedItems.map((item) =>
        resolvedDimensionByItemId.get(item.id) ??
        normalizePolicyDimension(item.policy_dimension) ??
        "overall"
      );
      const regionSummaryData = await this.computeRegionShift(
        client,
        session,
        focusDimensions
      );
      const impactDelta = totalDelta - previousMeta.totalImpact;

      const storedAxis = session.ideology_axis || "Overall";
      const storedDirection =
        (session.ideology_direction as "left" | "right" | "neutral") ||
        "neutral";
      const storedDelta = Number(session.ideology_delta) || 0;

      const ideologyAxis = dominant?.axisLabel ?? storedAxis;
      const ideologyDirection = dominant?.direction ?? storedDirection;
      const ideologyDelta =
        dominant?.deltaPercent !== undefined && !Number.isNaN(dominant.deltaPercent)
          ? Math.abs(dominant.deltaPercent)
          : storedDelta;
      const ideologySummary =
        session.ideology_summary ||
        formatIdeologySummary(ideologyAxis, ideologyDelta, ideologyDirection);

      const historySnapshot = buildHistorySnapshot(
        previousMeta,
        {
          ideologyAxis,
          ideologyDelta,
          ideologyDirection,
          streakCount: session.streak_count ?? formattedItems.length,
        }
      );

      baseState.completion = buildCompletionSummaryPayload({
        sessionMeta: {
          county: session.county ?? null,
          constituency: session.constituency ?? null,
        },
        ideologySummary,
        ideologyDelta,
        ideologyAxis,
        ideologyDirection,
        regionSummaryData: {
          summary:
            session.region_shift_summary ||
            regionSummaryData.summary ||
            "Regional sentiment data will appear once enough neighbours finish their sessions.",
          dimension: regionSummaryData.dimension,
          previousRank: regionSummaryData.previousRank,
          currentRank: regionSummaryData.currentRank,
        },
        streakCount: session.streak_count ?? formattedItems.length,
        dominantShift: dominant,
        dimensionShifts: shifts,
        totalDelta,
        impactDelta,
        voteCount: votesCompleted,
        historySnapshot,
      });
    }

    return baseState;
  }

  static async recordVote(
    userId: string,
    sessionItemId: number,
    rating?: number,
    optionKey?: string,
    accessToken?: string | null
  ): Promise<DailySessionState> {
    const client = resolveSupabaseClient(accessToken);

    // Validate: must have either rating or optionKey
    if (!rating && !optionKey) {
      throw new Error("Either rating or optionKey must be provided");
    }

    // Fetch item record first
    const { data: itemRecord, error: itemError } = await client
      .from("daily_session_items")
      .select(
        `
          id,
          session_id,
          article_id,
          politician_name,
          policy_direction,
          policy_dimension,
          policy_vote_id
        `
      )
      .eq("id", sessionItemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!itemRecord) throw new Error("Session item not found");

    const { data: session } = await client
      .from("daily_sessions")
      .select("status")
      .eq("id", itemRecord.session_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!session) throw new Error("Session not found for user");
    if (session.status === "completed") {
      throw new Error("Daily session already completed");
    }

    // If using optionKey, we need to map it to a rating and get ideology delta
    let finalRating: number;
    let ideologyDelta: number = 0;

    if (optionKey && itemRecord.policy_vote_id) {
      // Fetch the option vectors from the separate table
      const { data: optionVectors, error: vectorError } = await client
        .from("policy_vote_option_vectors")
        .select("*")
        .eq("policy_vote_id", itemRecord.policy_vote_id)
        .eq("option_key", optionKey)
        .maybeSingle();

      if (vectorError) {
        console.error(`Failed to load option vector for policy ${itemRecord.policy_vote_id}, option ${optionKey}:`, vectorError);
      }

      if (optionVectors) {
        // Calculate ideology delta from option vectors - PRESERVE SIGN for direction
        // Sum across all ideology dimensions (economic, social, cultural, authority, etc.)
        const ideologyDimensions = ['economic', 'social', 'cultural', 'authority', 'environmental', 'welfare', 'globalism', 'technocratic'];
        const dimensionDeltas = ideologyDimensions
          .map(dim => Number(optionVectors[dim]) || 0)
          .filter(val => val !== 0);
        
        if (dimensionDeltas.length > 0) {
          // Calculate average delta across dimensions
          ideologyDelta = dimensionDeltas.reduce((sum, val) => sum + val, 0) / dimensionDeltas.length;
          
          // Map ideology delta magnitude to rating
          const avgAbsDelta = Math.abs(ideologyDelta);
          finalRating = avgAbsDelta > 0.5 ? 5 : avgAbsDelta > 0.3 ? 4 : 3;
          
          console.log(`✅ Loaded option vector: policy=${itemRecord.policy_vote_id}, option=${optionKey}, ideologyDelta=${ideologyDelta.toFixed(3)}, rating=${finalRating}`);
        } else {
          finalRating = 3; // Neutral if no deltas
          ideologyDelta = 0;
        }
      } else {
        // No option_vectors - map option key to rating based on position
        // option_a = strong support (5), option_b = moderate support (4), 
        // option_c = moderate oppose (2), option_d = strong oppose (1)
        const optionRatingMap: Record<string, number> = {
          option_a: 5,
          option_b: 4,
          option_c: 2,
          option_d: 1,
        };
        finalRating = optionRatingMap[optionKey] ?? 3;
        console.log(`Mapped ${optionKey} to rating ${finalRating} (no option_vectors available)`);
      }
    } else if (optionKey) {
      // No policy vote ID but has optionKey - treat as moderate support
      finalRating = 4;
    } else {
      // Using slider rating
      if (rating! < 1 || rating! > 5) {
        throw new Error("Rating must be between 1 and 5");
      }
      finalRating = rating!;
    }

    const policyDimension = await inferPolicyDimensionForItem(
      client,
      itemRecord
    );

    const direction = directionMultiplier(
      itemRecord.policy_direction,
      finalRating
    );
    const baseImpact = ratingToImpact(finalRating) * direction;
    // If using optionKey, use the calculated ideology delta, otherwise use baseImpact
    const intendedDelta = optionKey && ideologyDelta !== 0
      ? ideologyDelta * IDEOLOGY_LEARNING_RATE
      : baseImpact * IDEOLOGY_LEARNING_RATE;

    const ideologyResult = await this.syncGlobalVoteArtifacts(client, {
      userId,
      rating: finalRating,
      optionKey: optionKey ?? null,
      delta: intendedDelta,
      articleId: itemRecord.article_id ?? null,
      politicianName: itemRecord.politician_name ?? null,
      policyVoteId: itemRecord.policy_vote_id ?? null,
      policyDimension,
    });

    // If ideologyResult returned a delta, use it.
    // If it was null (e.g. multiple choice recompute), use intendedDelta so the session summary reflects the shift.
    const appliedDelta = ideologyResult?.delta ?? intendedDelta;

    // Build vote payload - only include selected_option if optionKey is provided
    const votePayload: any = {
      session_item_id: sessionItemId,
      user_id: userId,
      rating: finalRating,
      impact_score: appliedDelta,
    };
    
    // Only add selected_option if we have an optionKey (multiple choice)
    if (optionKey) {
      votePayload.selected_option = optionKey;
    }

    const { error: upsertError } = await client
      .from("daily_session_votes")
      .upsert(votePayload, {
        onConflict: "session_item_id,user_id",
      });

    if (upsertError) {
      console.error("Failed to save vote", upsertError);
      throw upsertError;
    }

    return this.getSessionState(client, itemRecord.session_id, userId, accessToken);
  }

  private static async syncGlobalVoteArtifacts(
    client: SupabaseClient,
    options: {
    userId: string;
    rating: number;
    delta: number;
    articleId: number | null;
    politicianName: string | null;
    policyVoteId: number | null;
    policyDimension: string | null;
    optionKey: string | null;
    }
  ): Promise<{ dimension: IdeologyDimension; before: number; after: number; delta: number } | null> {
    const {
      userId,
      rating,
      delta,
      articleId,
      politicianName,
      policyVoteId,
      policyDimension,
      optionKey,
    } = options;

    const timestamp = new Date().toISOString();

    // Use provided politician name or fallback to "General Policy" to ensure vote is recorded for the article
    // This is critical for the "News Feed" to know the user has engaged with this article.
    const effectivePoliticianName = politicianName || "General Policy";

    if (articleId) {
      const { error: globalVoteError } = await client
        .from("user_policy_votes")
        .upsert(
          {
            user_id: userId,
            article_id: articleId,
            politician_name: effectivePoliticianName,
            support_rating: rating,
            updated_at: timestamp,
          },
          {
            onConflict: "user_id,article_id,politician_name",
          }
        );

      if (globalVoteError) {
        console.error("Failed to upsert user_policy_votes entry:", globalVoteError);
      }
      
      // Update policy agreements and recalculate personal rankings
      await PersonalRankingsService.updatePolicyAgreementFromVote(
        userId,
        articleId,
        rating
      );
    }

    // Handle multiple choice votes (optionKey provided)
    if (policyVoteId && optionKey) {
      console.log(`💾 Syncing multiple choice vote: user=${userId}, policy_vote_id=${policyVoteId}, option=${optionKey}`);
      const { error: responseError } = await client
        .from("user_policy_vote_responses")
        .upsert(
          {
            user_id: userId,
            policy_vote_id: policyVoteId,
            article_id: articleId,
            selected_option: optionKey,
            updated_at: timestamp,
          },
          {
            onConflict: "user_id,policy_vote_id",
          }
        );

      if (responseError) {
        console.error(
          "❌ Failed to upsert user_policy_vote_responses entry:",
          responseError
        );
      } else {
        console.log(`✅ Successfully saved vote to user_policy_vote_responses`);
        // For multiple choice votes, recompute the entire ideology profile from all responses
        // This properly aggregates all dimensions from option vectors
        await UserIdeologyProfileService.recomputeUserProfile(userId);
        
        // Recalculate personal rankings after ideology update
        await PersonalRankingsService.recalculatePersonalRankings(userId);
        
        // Return null since recomputeUserProfile handles all dimensions
        return null;
      }
    } 
    // Handle slider votes (no optionKey, derive from rating if needed)
    else if (policyVoteId && !optionKey) {
      const selectedOption = await this.determineOptionKey(client, policyVoteId, rating);
      if (selectedOption) {
        const { error: responseError } = await client
          .from("user_policy_vote_responses")
          .upsert(
            {
              user_id: userId,
              policy_vote_id: policyVoteId,
              article_id: articleId,
              selected_option: selectedOption,
              updated_at: timestamp,
            },
            {
              onConflict: "user_id,policy_vote_id",
            }
          );

        if (responseError) {
          console.error(
            "Failed to upsert user_policy_vote_responses entry:",
            responseError
          );
        } else {
          // For slider votes that map to options, also recompute profile
          await UserIdeologyProfileService.recomputeUserProfile(userId);
          await PersonalRankingsService.recalculatePersonalRankings(userId);
          return null;
        }
      }
    }

    // For slider votes without policy vote opportunities, use simple delta update
    if (delta !== 0 && !optionKey) {
      const result = await this.applyIdeologyDelta(client, {
        userId,
        policyDimension,
        delta,
      });
      
      // Recalculate personal rankings after ideology update
      if (result && result.delta !== 0) {
        await PersonalRankingsService.recalculatePersonalRankings(userId);
      }
      
      return result;
    }

    return null;
  }

  /**
   * Sync all votes from a completed daily session to user_policy_vote_responses
   * This ensures ideology recomputation works correctly
   */
  private static async syncAllSessionVotesToPolicyResponses(
    client: SupabaseClient,
    userId: string,
    sessionId: number
  ): Promise<void> {
    // Fetch all session items with votes
    const { data: items, error: itemsError } = await client
      .from("daily_session_items")
      .select(`
        id,
        policy_vote_id,
        article_id,
        votes:daily_session_votes!inner (
          user_id,
          selected_option,
          rating
        )
      `)
      .eq("session_id", sessionId)
      .eq("votes.user_id", userId);

    if (itemsError) {
      console.error("Failed to fetch session items for sync:", itemsError);
      return;
    }

    if (!items || items.length === 0) {
      console.log("No items found to sync");
      return;
    }

    const timestamp = new Date().toISOString();
    let syncedCount = 0;

    for (const item of items) {
      const vote = (item.votes as any[])?.[0];
      if (!vote) continue;

      const policyVoteId = item.policy_vote_id;
      if (!policyVoteId) continue; // Skip items without policy vote opportunities

      // If we have a selected_option, use it directly
      if (vote.selected_option) {
        const { error: syncError } = await client
          .from("user_policy_vote_responses")
          .upsert(
            {
              user_id: userId,
              policy_vote_id: policyVoteId,
              article_id: item.article_id,
              selected_option: vote.selected_option,
              updated_at: timestamp,
            },
            {
              onConflict: "user_id,policy_vote_id",
            }
          );

        if (syncError) {
          console.error(`Failed to sync vote for policy_vote_id ${policyVoteId}:`, syncError);
        } else {
          syncedCount++;
        }
      } 
      // Otherwise, try to derive option from rating
      else if (vote.rating) {
        const selectedOption = await this.determineOptionKey(client, policyVoteId, vote.rating);
        if (selectedOption) {
          const { error: syncError } = await client
            .from("user_policy_vote_responses")
            .upsert(
              {
                user_id: userId,
                policy_vote_id: policyVoteId,
                article_id: item.article_id,
                selected_option: selectedOption,
                updated_at: timestamp,
              },
              {
                onConflict: "user_id,policy_vote_id",
              }
            );

          if (syncError) {
            console.error(`Failed to sync derived vote for policy_vote_id ${policyVoteId}:`, syncError);
          } else {
            syncedCount++;
          }
        }
      }
    }

    console.log(`✅ Synced ${syncedCount}/${items.length} votes to user_policy_vote_responses`);
  }

  private static async determineOptionKey(
    client: SupabaseClient,
    policyVoteId: number,
    rating: number
  ): Promise<string | null> {
    if (rating === 3) {
      return null;
    }

    const { data, error } = await client
      .from("policy_vote_opportunities")
      .select("answer_options")
      .eq("id", policyVoteId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load policy vote answer options", error);
      return null;
    }

    const optionsRecord = (data?.answer_options ?? {}) as Record<string, string>;
    const optionKeys = Object.keys(optionsRecord).sort();
    if (optionKeys.length === 0) {
      return null;
    }

    if (rating >= 4) {
      return optionKeys[0] ?? null;
    }

    if (rating <= 2) {
      return optionKeys[optionKeys.length - 1] ?? null;
    }

    if (optionKeys.length >= 3) {
      return optionKeys[Math.floor(optionKeys.length / 2)];
    }

    return null;
  }

  private static async applyIdeologyDelta(
    client: SupabaseClient,
    options: {
      userId: string;
      policyDimension: string | null;
      delta: number;
    }
  ): Promise<{ dimension: IdeologyDimension; before: number; after: number; delta: number } | null> {
    const { userId, policyDimension, delta } = options;
    if (delta === 0) return null;

    const ideologyDimension = mapPolicyDimensionToIdeologyDimension(
      policyDimension
    );
    if (!ideologyDimension) return null;

    const profileData = await loadUserIdeologyVector(client, userId);
    if (!profileData) {
      return null;
    }
    const { vector, totalWeight } = profileData;

    const currentValue = vector[ideologyDimension];

    let adjustedDelta = delta;
    if (delta !== 0) {
      const headroom =
        delta > 0 ? 10 - currentValue : 10 + currentValue;
      if (headroom <= 0) {
        adjustedDelta = 0;
      } else {
        const scaling = Math.min(1, Math.max(headroom / 10, 0.05));
        adjustedDelta = delta * scaling;
      }
    }

    const nextValue = clampIdeologyValue(currentValue + adjustedDelta);
    const appliedDelta = nextValue - currentValue;

    if (appliedDelta === 0) {
      return {
        dimension: ideologyDimension,
        before: currentValue,
        after: currentValue,
        delta: 0,
      };
    }

    vector[ideologyDimension] = nextValue;

    const updatedWeight = totalWeight + Math.abs(appliedDelta);
    const payload = {
      user_id: userId,
      ...vector,
      total_weight: updatedWeight,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await client
      .from("user_ideology_profiles")
      .upsert(payload, { onConflict: "user_id" });

    if (upsertError) {
      console.error("Failed to update user ideology profile", upsertError);
    }

    return {
      dimension: ideologyDimension,
      before: currentValue,
      after: nextValue,
      delta: appliedDelta,
    };
  }

  static async completeSession(
    userId: string,
    accessToken?: string | null
  ): Promise<DailySessionCompletion> {
    const client = resolveSupabaseClient(accessToken);
    const today = getTodayDate();

    const { data: session, error: sessionError } = await client
      .from("daily_sessions")
      .select(
        `
          id,
          status,
          county,
          constituency
        `
      )
      .eq("user_id", userId)
      .eq("session_date", today)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) {
      throw new Error("Daily session not found for today");
    }

    if (session.status === "completed") {
      const state = await this.getSessionState(client, session.id, userId, accessToken);
      if (!state.completion) {
        throw new Error("Session already completed");
      }
      return state.completion;
    }

    const { data: items } = await client
      .from("daily_session_items")
      .select(
        `
          id,
          policy_dimension,
          policy_direction,
          votes:daily_session_votes (
            rating,
            selected_option,
            impact_score,
            user_id
          )
        `
      )
      .eq("session_id", session.id);

    if (!items || items.length === 0) {
      throw new Error("Daily session has no items");
    }

    const userVotes = items
      .map((item) => ({
        dimension:
          normalizePolicyDimension(item.policy_dimension) ??
          resolvePolicyDimensionFromValues([item.policy_dimension]),
        direction: item.policy_direction,
        votes: (item.votes || []).filter(
          (vote: any) => vote.user_id === userId
        ),
      }))
      .filter((item) => item.votes.length > 0);

    if (userVotes.length < DAILY_ITEM_COUNT) {
      throw new Error("Please complete all votes before finishing");
    }

    const voteEntries = userVotes.map((item) => ({
      policyDimension: item.dimension,
      delta: item.votes[0]?.impact_score ?? 0,
    }));

    const { shifts, dominant, totalDelta } = await summarizeDimensionShifts(
      client,
      userId,
      voteEntries
    );

    const previousMeta = await this.fetchPreviousSessionMeta(
      client,
      userId,
      today
    );

    const impactDelta = totalDelta - previousMeta.totalImpact;
    const ideologyAxis =
      dominant?.axisLabel ||
      mapDimensionToAxis(
        userVotes.map((item) => item.dimension).filter(Boolean)[0] || null
      );
    const direction: "left" | "right" | "neutral" =
      dominant?.direction ?? "neutral";
    const ideologyDeltaPercent = dominant
      ? Math.abs(dominant.deltaPercent)
      : 0;
    const ideologySummary = formatIdeologySummary(
      ideologyAxis,
      ideologyDeltaPercent,
      direction
    );

    const regionSummaryData = await this.computeRegionShift(
      client,
      session,
      userVotes.map(
        (v) => v.dimension ?? "overall"
      )
    );

    const streakCount = await this.calculateAndUpdateStreak(
      client,
      userId,
      today,
      session.id
    );

    const { error: updateError } = await client
      .from("daily_sessions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ideology_axis: ideologyAxis,
        ideology_delta: ideologyDeltaPercent,
        ideology_direction: direction,
        ideology_summary: ideologySummary,
        region_shift_summary: regionSummaryData.summary,
        streak_count: streakCount,
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("Failed to finalize daily session", updateError);
      throw updateError;
    }

    // CRITICAL: Ensure all votes are synced to user_policy_vote_responses
    // and recompute ideology profile from all responses
    console.log(`🔄 Syncing all daily session votes to user_policy_vote_responses for user ${userId}...`);
    await this.syncAllSessionVotesToPolicyResponses(client, userId, session.id);
    
    // Recompute ideology profile from all policy vote responses
    console.log(`🔄 Recomputing ideology profile for user ${userId}...`);
    await UserIdeologyProfileService.recomputeUserProfile(userId);
    
    // Recalculate personal rankings after ideology update
    console.log(`🔄 Recalculating personal rankings for user ${userId}...`);
    await PersonalRankingsService.recalculatePersonalRankings(userId);

    const historySnapshot = buildHistorySnapshot(previousMeta, {
      ideologyAxis,
      ideologyDelta: ideologyDeltaPercent,
      ideologyDirection: direction,
      streakCount,
    });

    return buildCompletionSummaryPayload({
      sessionMeta: { county: session.county ?? null, constituency: session.constituency ?? null },
      ideologySummary,
      ideologyDelta: ideologyDeltaPercent,
      ideologyAxis,
      ideologyDirection: direction,
      regionSummaryData,
      streakCount,
      dominantShift: dominant,
      dimensionShifts: shifts,
      totalDelta,
      impactDelta,
      voteCount: userVotes.length,
      historySnapshot,
    });
  }

  private static async fetchPreviousSessionMeta(
    client: SupabaseClient,
    userId: string,
    beforeDate?: string
  ): Promise<{
    totalImpact: number;
    sessionDate?: string;
    ideologyAxis?: string | null;
    ideologyDelta?: number | null;
    ideologyDirection?: string | null;
    streakCount?: number | null;
  }> {
    const cutoff = beforeDate ?? getTodayDate();

    const { data: previousSessions } = await client
      .from("daily_sessions")
      .select(
        `
          id,
          session_date,
          ideology_axis,
          ideology_delta,
          ideology_direction,
          streak_count
        `
      )
      .eq("user_id", userId)
      .eq("status", "completed")
      .lt("session_date", cutoff)
      .order("session_date", { ascending: false })
      .limit(1);

    if (!previousSessions || previousSessions.length === 0) {
      return { totalImpact: 0 };
    }

    const previousSession = previousSessions[0];

    const { data: votes } = await client
      .from("daily_session_items")
      .select(
        `
          votes:daily_session_votes (impact_score)
        `
      )
      .eq("session_id", previousSession.id);

    let totalImpact = 0;
    if (votes) {
      totalImpact = votes.reduce((sum, item) => {
        const voteImpact = item.votes?.[0]?.impact_score ?? 0;
        return sum + Number(voteImpact);
      }, 0);
    }

    return {
      totalImpact,
      sessionDate: previousSession.session_date,
      ideologyAxis: previousSession.ideology_axis,
      ideologyDelta: Number(previousSession.ideology_delta ?? 0),
      ideologyDirection: previousSession.ideology_direction,
      streakCount: previousSession.streak_count ?? null,
    };
  }

  private static async computeRegionShift(
    client: SupabaseClient,
    session: { county: string | null; constituency: string | null },
    focusDimensions: string[]
  ): Promise<{
    summary: string;
    dimension?: string;
    previousRank?: number;
    currentRank?: number;
  }> {
    const today = getTodayDate();
    const regionField = session.county ? "county" : session.constituency ? "constituency" : null;
    if (!regionField) {
      return {
        summary:
          "Regional shift unavailable – add your county or constituency to unlock local insights.",
      };
    }

    const regionValue = regionField === "county" ? session.county : session.constituency;

    const { data: todaySessions } = await client
      .from("daily_sessions")
      .select("id")
      .eq("status", "completed")
      .eq("session_date", today)
      .eq(regionField, regionValue);

    if (!todaySessions || todaySessions.length === 0) {
      return {
        summary:
          "Be the first in your area to finish today's loop. We'll show local sentiment once neighbours join in.",
      };
    }

    const todayDimensionScores = await this.aggregateRegionDimensionScores(
      client,
      todaySessions.map((s) => s.id)
    );

    const { data: yesterdaySessions } = await client
      .from("daily_sessions")
      .select("id")
      .eq("status", "completed")
      .eq(
        "session_date",
        new Date(new Date(today).setDate(new Date(today).getDate() - 1))
          .toISOString()
          .split("T")[0]
      )
      .eq(regionField, regionValue);

    const yesterdayDimensionScores = yesterdaySessions?.length
      ? await this.aggregateRegionDimensionScores(
          client,
          yesterdaySessions.map((s) => s.id)
        )
      : null;

    const rankedToday = this.rankDimensions(todayDimensionScores);
    const primaryDimension =
      focusDimensions.find((dimension) => rankedToday.some((r) => r.dimension === dimension)) ||
      rankedToday[0]?.dimension ||
      "overall";

    const currentRank =
      rankedToday.findIndex((entry) => entry.dimension === primaryDimension) + 1;

    let previousRank: number | undefined;
    if (yesterdayDimensionScores) {
      const rankedYesterday = this.rankDimensions(yesterdayDimensionScores);
      previousRank =
        rankedYesterday.findIndex(
          (entry) => entry.dimension === primaryDimension
        ) + 1;
    }

    const dimensionLabel = mapDimensionLabel(primaryDimension);

    if (!previousRank) {
      const sentiment = rankedToday.find(
        (entry) => entry.dimension === primaryDimension
      );
      const leaning = sentiment && sentiment.score >= 0 ? "supporting" : "pushing back on";
      return {
        summary: `Your ${dimensionLabel.toLowerCase()} vote is ${
          leaning === "supporting" ? "leading" : "countering"
        } sentiment locally.`,
        dimension: primaryDimension,
        currentRank,
      };
    }

    if (previousRank === currentRank) {
      return {
        summary: `Your area held ${dimensionLabel} at #${currentRank} today.`,
        dimension: primaryDimension,
        previousRank,
        currentRank,
      };
    }

    const trend = previousRank > currentRank ? "up" : "down";
    return {
      summary: `Your area moved ${dimensionLabel} from #${previousRank} → #${currentRank}.`,
      dimension: primaryDimension,
      previousRank,
      currentRank,
    };
  }

  private static async aggregateRegionDimensionScores(
    client: SupabaseClient,
    sessionIds: number[]
  ): Promise<Map<string, number>> {
    if (sessionIds.length === 0) return new Map();

    const { data } = await client
      .from("daily_session_items")
      .select(
        `
          policy_dimension,
          votes:daily_session_votes (impact_score)
        `
      )
      .in("session_id", sessionIds);

    const totals = new Map<string, number>();
    for (const row of data || []) {
      const dimension = row.policy_dimension || "overall";
      const impact = row.votes?.[0]?.impact_score ?? 0;
      totals.set(dimension, (totals.get(dimension) || 0) + Number(impact));
    }
    return totals;
  }

  private static rankDimensions(scores: Map<string, number>): Array<{
    dimension: string;
    score: number;
  }> {
    return Array.from(scores.entries())
      .map(([dimension, score]) => ({ dimension, score }))
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  private static async calculateAndUpdateStreak(
    client: SupabaseClient,
    userId: string,
    today: string,
    sessionId: number
  ): Promise<number> {
    const { data: sessions } = await client
      .from("daily_sessions")
      .select("session_date")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("session_date", { ascending: false });

    if (!sessions) return 1;

    const todayDate = new Date(today);
    let streak = 0;

    for (const session of sessions) {
      const expectedDate = new Date(todayDate);
      expectedDate.setDate(expectedDate.getDate() - streak);
      const sessionDate = new Date(session.session_date);
      if (sessionDate.toDateString() === expectedDate.toDateString()) {
        streak += 1;
      } else if (sessionDate < expectedDate) {
        break;
      }
    }

    if (streak === 0) streak = 1;

    await client
      .from("daily_sessions")
      .update({ streak_count: streak })
      .eq("id", sessionId);

    return streak;
  }
}

export default DailySessionService;


