// Extended multi-dimensional ideological axes types
export interface IdeologicalDimensions {
  economic: number;      // Left (-10) to Right (10) economic position
  social: number;        // Progressive (-10) to Conservative (10) social position
  cultural: number;      // Multicultural (-10) to Traditional (10) cultural values
  globalism: number;     // Nationalist (-10) to Internationalist (10)
  environmental: number; // Industrial (-10) to Ecological (10) priorities
  authority: number;     // Libertarian (-10) to Authoritarian (10) governance
  welfare: number;       // Individual (-10) to Communitarian (10) welfare approach
  technocratic: number;  // Populist (-10) to Technocratic (10) governance approach
}

// Default dimensions with neutral values
export const defaultDimensions: IdeologicalDimensions = {
  economic: 0,
  social: 0,
  cultural: 0,
  globalism: 0,
  environmental: 0,
  authority: 0,
  welfare: 0,
  technocratic: 0
};

// Quiz question types
export interface QuizAnswer {
  text: string;
  description: string;
  economic: number;
  social: number;
  cultural?: number;
  globalism?: number;
  environmental?: number;
  authority?: number;
  welfare?: number;
  technocratic?: number;
}

export interface QuizQuestion {
  id: number;
  text: string;
  answers: QuizAnswer[];
  category?: string;
  weight?: number;
}

// Response type for a user's quiz answers
export interface UserResponse {
  questionId: number;
  answerId?: number;
  customAnswer?: string;
}

// Extended result type with multi-dimensional ideological scores
export interface MultidimensionalQuizResult {
  // Core dimensions (original)
  economic: number;
  social: number;
  
  // New extended dimensions
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
  
  // Result interpretation
  ideology: string;
  description: string;
  
  // Additional data
  similarFigures?: any[];
  uniqueCombinations?: any[];
  
  // Enhanced analysis
  detailedAnalysis?: string;
  dimensionBreakdown?: Record<string, {
    score: number;
    explanation: string;
    influence: string;
  }>;
  
  // Irish context insights
  irishContextInsights?: string | any;
  
  // User location data
  userLocation?: {
    constituency: string;
    county: string;
  };
  
  // User response data for answer explanations
  responses?: Array<{
    questionId: number;
    answerId?: number;
    customAnswer?: string;
  }>;
  
  // Timestamp
  timestamp?: string;
}

// Dimension display config for visualization
export interface DimensionDisplayConfig {
  id: keyof IdeologicalDimensions;
  label: string;
  leftLabel: string;
  rightLabel: string;
  color: string;
  icon?: string;
}

// Configuration for displaying the dimensions in the UI
export const dimensionDisplayConfig: DimensionDisplayConfig[] = [
  {
    id: 'economic',
    label: 'Economic',
    leftLabel: 'Left',
    rightLabel: 'Right', 
    color: '#ff5757',
    icon: '💰'
  },
  {
    id: 'social',
    label: 'Social', 
    leftLabel: 'Progressive',
    rightLabel: 'Conservative',
    color: '#5271ff',
    icon: '👥'
  },
  {
    id: 'cultural',
    label: 'Cultural',
    leftLabel: 'Multicultural',
    rightLabel: 'Traditional',
    color: '#8b5cf6',
    icon: '🏛️'
  },
  {
    id: 'globalism',
    label: 'Globalism',
    leftLabel: 'Nationalist',
    rightLabel: 'Internationalist',
    color: '#22c55e',
    icon: '🌐'
  },
  {
    id: 'environmental',
    label: 'Environmental',
    leftLabel: 'Industrial',
    rightLabel: 'Ecological',
    color: '#10b981',
    icon: '🌱'
  },
  {
    id: 'authority',
    label: 'Authority',
    leftLabel: 'Libertarian',
    rightLabel: 'Authoritarian',
    color: '#f59e0b',
    icon: '⚖️'
  },
  {
    id: 'welfare',
    label: 'Welfare',
    leftLabel: 'Individual',
    rightLabel: 'Communitarian',
    color: '#ec4899',
    icon: '🤲'
  },
  {
    id: 'technocratic',
    label: 'Governance',
    leftLabel: 'Populist',
    rightLabel: 'Technocratic',
    color: '#06b6d4',
    icon: '🏛️'
  }
];

// Helper functions for multi-dimensional analysis
export const getDimensionDescription = (dimensionId: keyof IdeologicalDimensions, score: number): string => {
  const dimension = dimensionDisplayConfig.find(d => d.id === dimensionId);
  if (!dimension) return '';
  
  if (score < -7) return `Strongly ${dimension.leftLabel}`;
  if (score < -3) return `Moderately ${dimension.leftLabel}`;
  if (score < 0) return `Leaning ${dimension.leftLabel}`;
  if (score === 0) return `Centrist on ${dimension.label} issues`;
  if (score < 4) return `Leaning ${dimension.rightLabel}`;
  if (score < 8) return `Moderately ${dimension.rightLabel}`;
  return `Strongly ${dimension.rightLabel}`;
};