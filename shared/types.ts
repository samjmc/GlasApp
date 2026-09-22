/**
 * Shared type definitions across server and client.
 * These replace generic `any` types with proper TypeScript interfaces.
 */

// ============================================================================
// Ideological & Political Types
// ============================================================================

export interface IdeologicalDimensions {
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
}

export interface PartyMatch {
  party: string;
  abbreviation: string;
  matchPercentage: number;
  matchReason: string;
  color: string;
}

export interface PartyDimensionRationales {
  economic: string;
  social: string;
  cultural: string;
  globalism: string;
  environmental: string;
  authority: string;
  welfare: string;
  technocratic: string;
}

// ============================================================================
// Generic utility types
// ============================================================================

/**
 * JSON-compatible value type.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

/**
 * Event handler callback type for DOM events.
 */
export type EventHandler<E extends Event = Event> = (event: E) => void;

/**
 * Generic comparison function for sorting.
 */
export type Comparator<T> = (a: T, b: T) => number;

// ============================================================================
// Quiz & Political Evolution Types
// ============================================================================

/**
 * Political evolution scoring payload.
 */
export interface PoliticalEvolutionInput {
  userId: string;
  economicScore?: number;
  socialScore?: number;
  culturalScore?: number;
  globalismScore?: number;
  environmentalScore?: number;
  authorityScore?: number;
  welfareScore?: number;
  technocraticScore?: number;
  ideology?: string;
  quizVersion?: string;
  quizResultId?: string | null;
  notes?: string | null;
  label?: string | null;
}

/**
 * Quiz result payload.
 */
export interface QuizResultInput {
  userId?: string;
  answers: Record<string, string | number | boolean>;
  scores: Record<string, number>;
  ideology?: string;
  shareCode?: string;
  createdAt?: Date;
}

// ============================================================================
// Debate & Parliamentary Types
// ============================================================================

/**
 * Debate contribution row from database query.
 */
export interface DebateContributionRow {
  performance_delta?: number;
  effectiveness_delta?: number;
  influence_delta?: number;
  calculated_at?: string | null;
  debate_sections?: { title: string };
  debate_days?: {
    title: string;
    date: string;
    chamber: string;
  };
  metadata?: JsonObject;
}

/**
 * Formatted contribution data after processing.
 */
export interface ContributionData {
  performanceDelta: number;
  effectivenessDelta: number;
  influenceDelta: number;
  calculatedAt: string | null;
  sectionTitle: string | null;
  debateTitle: string | null;
  debateDate: string | null;
  debateChamber: string | null;
  topics: string[];
  reasoning: string | null;
}

/**
 * Policy voting opportunity.
 */
export interface PolicyVoteOpportunity {
  id: string;
  question_text: string;
  answer_options: string[] | string;
  policy_domain: string;
  policy_topic: string;
  confidence: number;
  rationale: string;
  source_hint?: string;
}

// ============================================================================
// Geographical & Electoral Types
// ============================================================================

/**
 * GeoJSON feature structure for electoral boundaries.
 */
export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][] | number[][] | number[];
  } | null;
  properties: Record<string, string | number | undefined>;
}

/**
 * Processed GeoJSON data structure.
 */
export interface ProcessedGeoJson {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

/**
 * Constituency info with electoral data.
 */
export interface ConstituencyInfo {
  name: string;
  tds?: Array<{ id: string; name: string; [key: string]: unknown }>;
  parties?: Array<{ id: string; name: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

// ============================================================================
// Party & TD Scoring Types
// ============================================================================

/**
 * Party data with scores.
 */
export interface PartyScoreData {
  id: string;
  name: string;
  overall_score?: number;
  government_status?: 'coalition' | 'opposition' | string;
  score?: number;
  [key: string]: unknown;
}

/**
 * TD (Teachta Dála - Irish parliamentarian) with scores and rankings.
 */
export interface TDScoreData {
  id: string;
  name: string;
  politician_name?: string;
  score?: number;
  overall_score?: number;
  [key: string]: unknown;
}

/**
 * Polling data structure.
 */
export interface PollData {
  date: string;
  value: number;
  [key: string]: unknown;
}

/**
 * API member from Oireachtas API.
 */
export interface ApiMember {
  uri?: string;
  name?: string;
  [key: string]: unknown;
}

// ============================================================================
// Search & Filter Types
// ============================================================================

/**
 * Search result item (generic).
 */
export interface SearchResultItem<T = unknown> {
  entity: T;
  score?: number;
  [key: string]: unknown;
}

/**
 * Comprehensive search results.
 */
export interface SearchResults {
  tds: Array<SearchResultItem<TDScoreData>>;
  parties: Array<SearchResultItem<PartyScoreData>>;
  constituencies: Array<SearchResultItem<ConstituencyInfo>>;
}

// ============================================================================
// Activity & Tracking Types
// ============================================================================

/**
 * Activity tracker event.
 */
export interface ActivityEvent {
  type: 'zoom' | 'pan' | 'click' | string;
  location?: unknown;
  timestamp?: number;
  metadata?: JsonObject;
}

/**
 * Activity statistics.
 */
export interface ActivityStats {
  [key: string]: unknown;
}

// ============================================================================
// Supabase API Response Types
// ============================================================================

/**
 * Generic Supabase database response.
 */
export interface SupabaseResponse<T> {
  data: T | null;
  error: SupabaseError | null;
}

/**
 * Supabase error object.
 */
export interface SupabaseError {
  message: string;
  code: string;
  [key: string]: unknown;
}

// ============================================================================
// UI & Component Types
// ============================================================================

/**
 * Tab value type (commonly strings).
 */
export type TabValue = string | number;

/**
 * Icon component props.
 */
export interface IconProps {
  [key: string]: unknown;
}

/**
 * Modal/Dialog state.
 */
export interface ModalState {
  isOpen: boolean;
  title?: string;
  message?: string;
  [key: string]: unknown;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Application error with context.
 */
export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: JsonObject;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Pagination metadata for API responses
 */
export interface PaginationMetadata {
  limit: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  cursor?: string | null;
  nextCursor?: string | null;
}

/**
 * Paginated API response with new standardized format
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: PaginationMetadata;
  };
}

/**
 * Success API response with data
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Error API response
 */
export interface ErrorApiResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Generic API response wrapper (legacy, for backwards compatibility)
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * API error response (legacy)
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

// ============================================================================
// Map & Layer Types
// ============================================================================

export type MapLayer = string;

export interface MapLayerButton {
  id: MapLayer;
  label: string;
  icon: unknown;
}