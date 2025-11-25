/**
 * Outcomes Tracking Service
 * 
 * SOLVES MEDIA BIAS PROBLEM:
 * - Don't give full credit for announcements
 * - Track if promises are actually delivered
 * - Score based on OUTCOMES, not SPIN
 * 
 * Example:
 * - "Minister announces housing scheme" → +2 (low score for announcement)
 * - 6 months later: Check if it was actually delivered
 * - If delivered: +8 (high score for results)
 * - If not delivered: -5 (penalty for broken promise)
 */

import { supabaseDb } from '../db';
import Anthropic from '@anthropic-ai/sdk';

let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required but not set. Outcomes tracking features are disabled.');
    }
    anthropic = new Anthropic({ 
      apiKey: process.env.ANTHROPIC_API_KEY 
    });
  }
  return anthropic;
}

// ============================================
// TYPES
// ============================================

export interface PolicyPromise {
  id?: number;
  politician_name: string;
  promise_text: string;
  promise_type: 'policy' | 'funding' | 'legislation' | 'reform' | 'service';
  
  // Announced
  announced_date: Date;
  source_article_id: number;
  initial_score_given: number;  // Small score for announcement
  
  // Target
  target_date?: Date;
  target_metrics?: any;  // What success looks like
  
  // Outcome
  status: 'pending' | 'delivered' | 'partial' | 'failed' | 'broken';
  outcome_verified_date?: Date;
  outcome_score: number;  // Actual score when verified
  verification_sources?: any;
  
  // Tracking
  follow_up_articles: number[];
  last_checked: Date;
}

// ============================================
// ANNOUNCEMENT DETECTION
// ============================================

/**
 * Detect if article is an ANNOUNCEMENT vs ACHIEVEMENT
 */
export function detectAnnouncementVsAchievement(article: any, analysis: any): {
  isAnnouncement: boolean;
  isAchievement: boolean;
  confidence: number;
} {
  const text = (article.title + ' ' + article.content).toLowerCase();
  
  // Announcement indicators
  const announcementWords = [
    'announces', 'will', 'plans to', 'pledges', 'promises',
    'to launch', 'to introduce', 'to deliver', 'commits to',
    'unveils plan', 'reveals scheme', 'sets out vision'
  ];
  
  // Achievement indicators
  const achievementWords = [
    'delivered', 'completed', 'achieved', 'passed',
    'implemented', 'launched', 'opened', 'signed',
    'approved', 'enacted', 'finished'
  ];
  
  const hasAnnouncement = announcementWords.some(word => text.includes(word));
  const hasAchievement = achievementWords.some(word => text.includes(word));
  
  // Check for future tense (indicates promise, not delivery)
  const hasFutureTense = /will (create|deliver|provide|build|introduce)/i.test(text);
  
  return {
    isAnnouncement: hasAnnouncement || hasFutureTense,
    isAchievement: hasAchievement && !hasFutureTense,
    confidence: 0.85
  };
}

// ============================================
// ADJUSTED SCORING FOR ANNOUNCEMENTS
// ============================================

/**
 * Reduce score impact for announcements
 * Only give full credit for delivered results
 */
export function adjustScoreForAnnouncementBias(
  analysis: any,
  article: any
): {
  adjustedImpact: number;
  adjustedDimensionalImpacts: any;
  adjustment_reason: string;
  track_promise: boolean;
} {
  
  const detection = detectAnnouncementVsAchievement(article, analysis);
  
  // CASE 1: Clear Achievement (already delivered)
  if (detection.isAchievement && !detection.isAnnouncement) {
    return {
      adjustedImpact: analysis.impact_score,  // Full credit
      adjustedDimensionalImpacts: {
        transparency: analysis.transparency_impact,
        effectiveness: analysis.effectiveness_impact,
        integrity: analysis.integrity_impact,
        consistency: analysis.consistency_impact,
        constituency_service: analysis.constituency_service_impact
      },
      adjustment_reason: 'Verified achievement - full credit given',
      track_promise: false
    };
  }
  
  // CASE 2: Announcement Only (promise, not delivery)
  if (detection.isAnnouncement && !detection.isAchievement) {
    
    // Reduce positive impact by 70% for announcements
    const reductionFactor = 0.30;  // Only give 30% credit
    
    const adjustedImpact = analysis.impact_score > 0
      ? Math.round(analysis.impact_score * reductionFactor)
      : analysis.impact_score;  // Don't reduce negative scores
    
    return {
      adjustedImpact,
      adjustedDimensionalImpacts: {
        transparency: analysis.transparency_impact,  // Keep transparency as-is
        effectiveness: Math.round(analysis.effectiveness_impact * reductionFactor),  // Reduce 70%
        integrity: analysis.integrity_impact,
        consistency: Math.round(analysis.consistency_impact * reductionFactor),  // Reduce 70%
        constituency_service: Math.round(analysis.constituency_service_impact * reductionFactor)
      },
      adjustment_reason: 'Announcement only (not delivered) - reduced to 30% credit. Will verify outcome in 6 months.',
      track_promise: true  // Track this promise!
    };
  }
  
  // CASE 3: Mixed or unclear
  return {
    adjustedImpact: Math.round(analysis.impact_score * 0.6),  // 40% reduction
    adjustedDimensionalImpacts: {
      transparency: analysis.transparency_impact,
      effectiveness: Math.round(analysis.effectiveness_impact * 0.6),
      integrity: analysis.integrity_impact,
      consistency: Math.round(analysis.consistency_impact * 0.6),
      constituency_service: Math.round(analysis.constituency_service_impact * 0.6)
    },
    adjustment_reason: 'Mixed announcement/achievement - moderate reduction',
    track_promise: true
  };
}

// ============================================
// PROMISE TRACKING
// ============================================

/**
 * Extract and track promises from announcements
 */
export async function trackPromiseFromAnnouncement(
  article: any,
  td: { name: string; constituency: string; party: string },
  analysis: any
): Promise<number | null> {
  
  if (!supabaseDb) return null;
  
  try {
    // Use AI to extract the specific promise
    const promiseExtraction = await extractPromiseDetails(article, td, analysis);
    
    // Calculate target date (default 6 months for verification)
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + 6);
    
    // Save to database
    const { data, error } = await supabaseDb
      .from('policy_promises')
      .insert({
        politician_name: td.name,
        promise_text: promiseExtraction.promise,
        promise_type: promiseExtraction.type,
        announced_date: article.published_date,
        source_article_id: article.id,
        initial_score_given: analysis.impact_score * 0.3,  // Reduced score
        target_date: targetDate,
        target_metrics: promiseExtraction.metrics,
        status: 'pending',
        last_checked: new Date()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error saving promise:', error);
      return null;
    }
    
    console.log(`   📋 Promise tracked (ID: ${data.id}) - will verify in 6 months`);
    return data.id;
    
  } catch (error: any) {
    console.error('Error tracking promise:', error.message);
    return null;
  }
}

/**
 * Extract promise details using AI
 */
async function extractPromiseDetails(article: any, td: any, analysis: any) {
  const prompt = `
Extract the specific promise from this article about ${td.name}:

Title: ${article.title}
Content: ${article.content}

What exactly did they promise? Be specific.
What are the measurable outcomes? (e.g., "€10M funding", "1000 homes built", "Bill passed by Q2")
When should this be delivered?

Respond with JSON:
{
  "promise": "Specific promise text",
  "type": "policy | funding | legislation | reform | service",
  "metrics": {
    "amount": "€10M" or null,
    "quantity": "1000 homes" or null,
    "timeline": "Q1 2026" or null,
    "deliverable": "What should exist when complete"
  },
  "verifiable": true/false
}
`;

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  });
  
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return {
    promise: article.title,
    type: 'policy',
    metrics: {},
    verifiable: false
  };
}

// ============================================
// OUTCOME VERIFICATION (Run after 6 months)
// ============================================

/**
 * Check if promises were actually delivered
 */
export async function verifyPromiseOutcome(promiseId: number): Promise<{
  delivered: boolean;
  score_adjustment: number;
  evidence: string;
}> {
  
  if (!supabaseDb) {
    return { delivered: false, score_adjustment: 0, evidence: 'Database not connected' };
  }
  
  try {
    // Get promise details
    const { data: promise } = await supabaseDb
      .from('policy_promises')
      .select('*')
      .eq('id', promiseId)
      .single();
    
    if (!promise) {
      return { delivered: false, score_adjustment: 0, evidence: 'Promise not found' };
    }
    
    // Use AI to research if promise was delivered
    const verification = await aiVerifyPromiseDelivery(promise);
    
    // Calculate score adjustment
    let scoreAdjustment = 0;
    
    if (verification.delivered) {
      // Promise delivered - give FULL original score that was withheld
      const fullScore = promise.initial_score_given / 0.3;  // Restore to 100%
      scoreAdjustment = fullScore - promise.initial_score_given;  // Give the remaining 70%
    } else if (verification.partial) {
      // Partially delivered - give 50% of withheld score
      const fullScore = promise.initial_score_given / 0.3;
      scoreAdjustment = (fullScore * 0.5) - promise.initial_score_given;  // Give 20% more
    } else {
      // Not delivered - PENALTY
      scoreAdjustment = -promise.initial_score_given * 2;  // Double penalty for broken promise
    }
    
    // Update promise status
    await supabaseDb
      .from('policy_promises')
      .update({
        status: verification.delivered ? 'delivered' : verification.partial ? 'partial' : 'failed',
        outcome_verified_date: new Date(),
        outcome_score: scoreAdjustment,
        verification_sources: verification.sources
      })
      .eq('id', promiseId);
    
    // Update TD score
    await applyScoreAdjustment(promise.politician_name, scoreAdjustment, 'Promise verification');
    
    console.log(`✅ Promise ${promiseId} verified: ${verification.delivered ? 'DELIVERED' : 'FAILED'}`);
    console.log(`   Score adjustment: ${scoreAdjustment > 0 ? '+' : ''}${scoreAdjustment}`);
    
    return {
      delivered: verification.delivered,
      score_adjustment: scoreAdjustment,
      evidence: verification.evidence
    };
    
  } catch (error: any) {
    console.error('Error verifying promise:', error);
    return { delivered: false, score_adjustment: 0, evidence: 'Verification error' };
  }
}

async function aiVerifyPromiseDelivery(promise: any) {
  // Use AI to search for evidence of delivery
  const prompt = `
Research if this promise was delivered:

Promise: ${promise.promise_text}
By: ${promise.politician_name}
Announced: ${promise.announced_date}
Target: ${promise.target_date}

Search for evidence that this was actually implemented.
Look for:
- Follow-up news articles confirming delivery
- Official government records
- Budget allocations
- Actual implementation

Respond with JSON:
{
  "delivered": true/false,
  "partial": true/false,
  "evidence": "What evidence did you find?",
  "sources": ["source 1", "source 2"],
  "delivery_date": "2026-03-15" or null,
  "effectiveness": "Did it actually help? Or was it window dressing?"
}
`;

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });
  
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  return jsonMatch ? JSON.parse(jsonMatch[0]) : {
    delivered: false,
    partial: false,
    evidence: 'Could not verify',
    sources: []
  };
}

async function applyScoreAdjustment(tdName: string, adjustment: number, reason: string) {
  if (!supabaseDb) return;
  
  const { data: current } = await supabaseDb
    .from('td_scores')
    .select('overall_elo')
    .eq('politician_name', tdName)
    .single();
  
  if (current) {
    await supabaseDb
      .from('td_scores')
      .update({
        overall_elo: current.overall_elo + adjustment,
        last_updated: new Date()
      })
      .eq('politician_name', tdName);
    
    // Record in history
    await supabaseDb
      .from('td_score_history')
      .insert({
        politician_name: tdName,
        old_overall_elo: current.overall_elo,
        new_overall_elo: current.overall_elo + adjustment,
        elo_change: adjustment,
        dimension_affected: 'consistency',
        story_type: reason
      });
  }
}

export const OutcomesTrackingService = {
  detectAnnouncementVsAchievement,
  adjustScoreForAnnouncementBias,
  trackPromiseFromAnnouncement,
  verifyPromiseOutcome
};

