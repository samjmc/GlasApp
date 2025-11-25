/**
 * Score Conversion Utilities
 * Converts various scoring systems to unified 0-100 scale
 */

/**
 * Convert ELO score (1000-2000) to percentage (0-100)
 * 
 * @param elo - ELO rating (typically 1000-2000)
 * @returns Percentage score (0-100)
 * 
 * Scale:
 * - 1000 ELO = 0/100 (minimum)
 * - 1500 ELO = 50/100 (average)
 * - 2000 ELO = 100/100 (maximum)
 */
export function convertELOToPercentage(elo: number): number {
  if (!elo || isNaN(elo)) return 50; // Default to average if missing
  
  // Convert: (ELO - 1000) / 10 = percentage
  const percentage = (elo - 1000) / 10;
  
  // Clamp between 0 and 100
  return Math.min(100, Math.max(0, Math.round(percentage)));
}

/**
 * Convert percentage (0-100) back to ELO (1000-2000)
 * 
 * @param percentage - Score as percentage (0-100)
 * @returns ELO rating (1000-2000)
 */
export function convertPercentageToELO(percentage: number): number {
  if (!percentage || isNaN(percentage)) return 1500; // Default to average
  
  // Convert: percentage * 10 + 1000 = ELO
  const elo = percentage * 10 + 1000;
  
  // Clamp between 1000 and 2000
  return Math.min(2000, Math.max(1000, Math.round(elo)));
}

/**
 * Get color class based on score
 */
export function getScoreColor(score: number): {
  bg: string;
  text: string;
  badge: string;
  label: string;
  emoji: string;
} {
  if (score >= 90) {
    return {
      bg: 'bg-emerald-500',
      text: 'text-emerald-600',
      badge: 'bg-emerald-100 text-emerald-700',
      label: 'Excellent',
      emoji: '🟢'
    };
  }
  if (score >= 75) {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-600',
      badge: 'bg-blue-100 text-blue-700',
      label: 'Good',
      emoji: '🔵'
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-yellow-500',
      text: 'text-yellow-600',
      badge: 'bg-yellow-100 text-yellow-700',
      label: 'Average',
      emoji: '🟡'
    };
  }
  if (score >= 40) {
    return {
      bg: 'bg-orange-500',
      text: 'text-orange-600',
      badge: 'bg-orange-100 text-orange-700',
      label: 'Below Average',
      emoji: '🟠'
    };
  }
  return {
    bg: 'bg-red-500',
    text: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
    label: 'Poor',
    emoji: '🔴'
  };
}

/**
 * Calculate parliamentary activity score (0-100)
 * Based on questions asked and attendance
 */
export function calculateParliamentaryScore(data: {
  questionsAsked?: number | string;
  attendancePercentage?: number | string;
}): number {
  // Benchmarks (based on actual data analysis)
  const QUESTIONS_BENCHMARK = 200;  // Excellent performance (top TDs ask 400-900)
  const ATTENDANCE_BENCHMARK = 95;  // Excellent performance (75th percentile is 95.89%)
  
  // Questions score (0-100) - RELATIVE
  const questions = typeof data.questionsAsked === 'string' 
    ? parseInt(data.questionsAsked) 
    : (data.questionsAsked || 0);
  const questionsScore = Math.min(100, (questions / QUESTIONS_BENCHMARK) * 100);
  
  // Attendance score (0-100) - RELATIVE
  // Someone with 99% attendance should score 100/100 (they're at the top!)
  const attendance = typeof data.attendancePercentage === 'string'
    ? parseFloat(data.attendancePercentage)
    : (data.attendancePercentage || 0);
  const attendanceScore = Math.min(100, (attendance / ATTENDANCE_BENCHMARK) * 100);
  
  // Weighted average (60% questions, 40% attendance)
  const parliamentaryScore = (questionsScore * 0.6) + (attendanceScore * 0.4);
  
  return Math.min(100, Math.max(0, Math.round(parliamentaryScore)));
}

/**
 * Calculate unified overall TD score (0-100)
 * Combines multiple data sources with proper weighting
 */
export function calculateUnifiedScore(td: {
  overall_elo?: number;
  questionsAsked?: number | string;
  attendancePercentage?: number | string;
  constituency_service_score?: number;
  public_trust_score?: number;
}): {
  overall_score: number;
  news_score: number;
  parliamentary_score: number;
  constituency_score: number;
  public_trust_score: number;
} {
  // 1. News impact (from ELO)
  const newsScore = convertELOToPercentage(td.overall_elo || 1500);
  
  // 2. Parliamentary activity
  const parliamentaryScore = calculateParliamentaryScore(td);
  
  // 3. Constituency service (use if available, else default to 50)
  const constituencyScore = td.constituency_service_score || 50;
  
  // 4. Public trust (use if available, else default to 50)
  const publicTrustScore = td.public_trust_score || 50;
  
  // 5. WEIGHTED OVERALL SCORE (matches unifiedTDScoringService.ts weights)
  const overallScore = (
    newsScore * 0.40 +              // News: 40% weight
    parliamentaryScore * 0.30 +      // Parliamentary: 30% weight
    constituencyScore * 0.15 +       // Constituency: 15% weight
    publicTrustScore * 0.05 +        // Trust: 5% weight
    50 * 0.10                        // Legislative: 10% weight (TODO: implement)
  );
  
  return {
    overall_score: Math.round(overallScore),
    news_score: Math.round(newsScore),
    parliamentary_score: Math.round(parliamentaryScore),
    constituency_score: Math.round(constituencyScore),
    public_trust_score: Math.round(publicTrustScore)
  };
}

/**
 * Calculate all dimensional scores (0-100) from ELO
 */
export function calculateDimensionalScores(td: {
  transparency_elo?: number;
  effectiveness_elo?: number;
  integrity_elo?: number;
  consistency_elo?: number;
  constituency_service_elo?: number;
}): {
  transparency: number;
  effectiveness: number;
  integrity: number;
  consistency: number;
  constituency_service: number;
} {
  return {
    transparency: convertELOToPercentage(td.transparency_elo || 1500),
    effectiveness: convertELOToPercentage(td.effectiveness_elo || 1500),
    integrity: convertELOToPercentage(td.integrity_elo || 1500),
    consistency: convertELOToPercentage(td.consistency_elo || 1500),
    constituency_service: convertELOToPercentage(td.constituency_service_elo || 1500)
  };
}

