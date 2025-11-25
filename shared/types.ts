// Shared types to be used throughout the application

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