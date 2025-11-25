/**
 * Adaptive Scoring Engine
 * Prevents score saturation using diminishing returns and asymmetric updates
 * 
 * Key principles:
 * 1. High scores (90+) → Agreements add less, disagreements subtract more
 * 2. Low scores (10-) → Disagreements subtract less, agreements add more
 * 3. Middle scores (40-60) → Most volatile, normal deltas
 * 4. Score distribution stays interesting (normal-ish curve around 50-60)
 * 
 * Inspired by: TrueSkill, Elo K-factor adjustment, Logistic regression
 */

export class AdaptiveScoringEngine {
  
  /**
   * Calculate adaptive delta for a policy agreement/disagreement
   * 
   * @param currentScore - Current compatibility score (0-100)
   * @param baselineDelta - Raw delta (+3 for strong agreement, -3 for strong disagreement)
   * @param votesCompared - Number of policies compared so far (affects confidence)
   * @returns Adjusted delta that prevents saturation
   */
  static calculateAdaptiveDelta(
    currentScore: number,
    baselineDelta: number,
    votesCompared: number
  ): number {
    
    // 1. CONFIDENCE FACTOR (K-factor, like in Elo)
    // Few votes = more volatile (high confidence), many votes = more stable (low confidence)
    // Prevents whiplash after user has voted 50+ times
    const maxVotesForFullVolatility = 20; // After 20 votes, deltas start shrinking
    const confidenceFactor = Math.max(0.3, 1 - (votesCompared / (maxVotesForFullVolatility * 2)));
    // votesCompared=0  → factor=1.0 (full impact)
    // votesCompared=10 → factor=0.75
    // votesCompared=20 → factor=0.5
    // votesCompared=40 → factor=0.3 (minimum)
    
    // 2. DIMINISHING RETURNS (Sigmoid-style dampening)
    // Harder to improve when already high, harder to drop when already low
    let positionFactor = 1.0;
    
    if (baselineDelta > 0) {
      // POSITIVE delta (agreement) - diminishing returns at high scores
      // Score 50 → factor 1.0 (normal)
      // Score 70 → factor 0.8
      // Score 85 → factor 0.5
      // Score 95 → factor 0.2 (very hard to gain more)
      positionFactor = this.calculatePositionFactor(currentScore, 'positive');
    } else {
      // NEGATIVE delta (disagreement) - diminishing returns at low scores
      // Score 50 → factor 1.0 (normal)
      // Score 30 → factor 0.8
      // Score 15 → factor 0.5
      // Score 5  → factor 0.2 (very hard to drop more)
      positionFactor = this.calculatePositionFactor(currentScore, 'negative');
    }
    
    // 3. ASYMMETRIC PENALTIES (Easier to lose trust than gain it)
    // When score is high (>70), disagreements hurt MORE than agreements help
    // When score is low (<30), agreements help MORE than disagreements hurt
    let asymmetryFactor = 1.0;
    
    if (currentScore > 70 && baselineDelta < 0) {
      // High score + disagreement = AMPLIFY penalty
      // Score 80 + disagree → 1.3x penalty
      // Score 90 + disagree → 1.5x penalty
      asymmetryFactor = 1.0 + ((currentScore - 70) / 60); // 1.0 to 1.5
    } else if (currentScore < 30 && baselineDelta > 0) {
      // Low score + agreement = AMPLIFY bonus (give them a chance)
      // Score 20 + agree → 1.3x bonus
      // Score 10 + agree → 1.5x bonus
      asymmetryFactor = 1.0 + ((30 - currentScore) / 60); // 1.0 to 1.5
    }
    
    // 4. COMBINE ALL FACTORS
    const adjustedDelta = baselineDelta * confidenceFactor * positionFactor * asymmetryFactor;
    
    // 5. Round and cap (prevent jumps > 10 points)
    const finalDelta = Math.max(-10, Math.min(10, Math.round(adjustedDelta * 10) / 10));
    
    return finalDelta;
  }
  
  /**
   * Calculate position factor using sigmoid-like dampening
   * Makes it harder to reach extremes (0 or 100)
   */
  private static calculatePositionFactor(score: number, direction: 'positive' | 'negative'): number {
    if (direction === 'positive') {
      // For positive deltas, dampen at high scores
      if (score >= 90) return 0.2;  // Very hard to improve
      if (score >= 85) return 0.4;
      if (score >= 80) return 0.6;
      if (score >= 75) return 0.8;
      if (score >= 65) return 0.9;
      return 1.0; // Normal impact below 65
    } else {
      // For negative deltas, dampen at low scores
      if (score <= 10) return 0.2;  // Very hard to drop further
      if (score <= 15) return 0.4;
      if (score <= 20) return 0.6;
      if (score <= 25) return 0.8;
      if (score <= 35) return 0.9;
      return 1.0; // Normal impact above 35
    }
  }
  
  /**
   * Predict expected score distribution after N votes
   * Useful for testing if the algorithm keeps scores interesting
   */
  static simulateScoreDistribution(
    initialScore: number,
    numVotes: number,
    agreementRate: number = 0.6 // 60% agreement, 40% disagreement
  ): { finalScore: number; volatility: number; distribution: number[] } {
    let score = initialScore;
    const history: number[] = [score];
    
    for (let i = 0; i < numVotes; i++) {
      // Simulate a vote
      const isAgreement = Math.random() < agreementRate;
      const baseDelta = isAgreement ? 3 : -3;
      
      const adaptiveDelta = this.calculateAdaptiveDelta(score, baseDelta, i);
      score = Math.max(0, Math.min(100, score + adaptiveDelta));
      history.push(score);
    }
    
    // Calculate volatility (standard deviation of changes)
    const changes = history.slice(1).map((s, i) => s - history[i]);
    const avgChange = changes.reduce((sum, c) => sum + Math.abs(c), 0) / changes.length;
    
    return {
      finalScore: Math.round(score * 10) / 10,
      volatility: Math.round(avgChange * 100) / 100,
      distribution: history
    };
  }
  
  /**
   * Get human-readable explanation for why delta was adjusted
   */
  static explainDelta(
    currentScore: number,
    baselineDelta: number,
    actualDelta: number,
    votesCompared: number
  ): string {
    if (Math.abs(baselineDelta - actualDelta) < 0.1) {
      return 'Normal impact';
    }
    
    const reasons: string[] = [];
    
    // Confidence dampening
    if (votesCompared > 20) {
      reasons.push(`${votesCompared} votes analyzed (more stable)`);
    }
    
    // Position dampening
    if (currentScore > 85 && baselineDelta > 0) {
      reasons.push('Already high compatibility (diminishing returns)');
    } else if (currentScore < 15 && baselineDelta < 0) {
      reasons.push('Already low compatibility (floor effect)');
    }
    
    // Asymmetry
    if (currentScore > 70 && baselineDelta < 0) {
      reasons.push('Disagreement penalty amplified (easier to lose trust)');
    } else if (currentScore < 30 && baselineDelta > 0) {
      reasons.push('Agreement bonus amplified (chance to recover)');
    }
    
    return reasons.join('; ');
  }
}























