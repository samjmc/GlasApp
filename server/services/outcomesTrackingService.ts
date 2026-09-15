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
import { callAnthropicMessage } from './aiService.js';

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
  target_metrics?: unknown;  // What success looks like
  
  // Outcome
  status: 'pending' | 'delivered' | 'partial' | 'failed' | 'broken';
  outcome_verified_date?: Date;
  outcome_score: number;  // Actual score when verified
  verification_sources?: unknown;
  
  // Tracking
  follow_up_articles: number[];
  last_checked: Date;
}

interface OutcomeArticle {
  id?: number;
  title?: string;
  content?: string;
  published_date?: string;
}

interface OutcomeAnalysis {
  impact_score: number;
  transparency_impact: number;
  effectiveness_impact: number;
  integrity_impact: number;
  consistency_impact: number;
  constituency_service_impact: number;
}

// ============================================
// ANNOUNCEMENT DETECTION
// ============================================

/**
 * Detect if article is an ANNOUNCEMENT vs ACHIEVEMENT
 */
/** Detect whether an article is an announcement or an achievement. */
export function detectAnnouncementVsAchievement(article: unknown, analysis: unknown): {
  isAnnouncement: boolean;
  isAchievement: boolean;
  confidence: number;
} {
  const articleData = article as { title: string; content: string };
  const text = (articleData.title + ' ' + articleData.content).toLowerCase();
  
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
/** Reduce score impact for announcements, only crediting delivered results. */
export function adjustScoreForAnnouncementBias(
  analysis: unknown,
  article: unknown
): {
  adjustedImpact: number;
  adjustedDimensionalImpacts: unknown;
  adjustment_reason: string;
  track_promise: boolean;
} {
  
  const an = analysis as OutcomeAnalysis;
  
  const detection = detectAnnouncementVsAchievement(article, analysis);
  
  // CASE 1: Clear Achievement (already delivered)
  if (detection.isAchievement && !detection.isAnnouncement) {
    return {
      adjustedImpact: an.impact_score,  // Full credit
      adjustedDimensionalImpacts: {
        transparency: an.transparency_impact,
        effectiveness: an.effectiveness_impact,
        integrity: an.integrity_impact,
        consistency: an.consistency_impact,
        constituency_service: an.constituency_service_impact
      },
      adjustment_reason: 'Verified achievement - full credit given',
      track_promise: false
    };
  }
  
  // CASE 2: Announcement Only (promise, not delivery)
  if (detection.isAnnouncement && !detection.isAchievement) {
    
    // Reduce positive impact by 70% for announcements
    const reductionFactor = 0.30;  // Only give 30% credit
    
    const adjustedImpact = an.impact_score > 0
      ? Math.round(an.impact_score * reductionFactor)
      : an.impact_score;  // Don't reduce negative scores
    
    return {
      adjustedImpact,
      adjustedDimensionalImpacts: {
        transparency: an.transparency_impact,  // Keep transparency as-is
        effectiveness: Math.round(an.effectiveness_impact * reductionFactor),  // Reduce 70%
        integrity: an.integrity_impact,
        consistency: Math.round(an.consistency_impact * reductionFactor),  // Reduce 70%
        constituency_service: Math.round(an.constituency_service_impact * reductionFactor)
      },
      adjustment_reason: 'Announcement only (not delivered) - reduced to 30% credit. Will verify outcome in 6 months.',
      track_promise: true  // Track this promise!
    };
  }
  
  // CASE 3: Mixed or unclear
  return {
    adjustedImpact: Math.round(an.impact_score * 0.6),  // 40% reduction
    adjustedDimensionalImpacts: {
      transparency: an.transparency_impact,
      effectiveness: Math.round(an.effectiveness_impact * 0.6),
      integrity: an.integrity_impact,
      consistency: Math.round(an.consistency_impact * 0.6),
      constituency_service: Math.round(an.constituency_service_impact * 0.6)
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
  article: unknown,
  td: { name: string; constituency: string; party: string },
  analysis: unknown
): Promise<number | null> {
  
  if (!supabaseDb) return null;
  
  try {
    const a = article as OutcomeArticle;
    const an = analysis as OutcomeAnalysis;
    
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
        announced_date: a.published_date,
        source_article_id: a.id,
        initial_score_given: an.impact_score * 0.3,  // Reduced score
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
    
  } catch (error: unknown) {
    console.error('Error tracking promise:', (error as Error).message);
    return null;
  }
}

/**
 * Extract promise details using AI
 */
async function extractPromiseDetails(article: unknown, td: unknown, analysis: unknown) {
  const a = article as OutcomeArticle;
  const tdData = td as { name: string };
  const prompt = `
Extract the specific promise from this article about ${tdData.name}:

Title: ${a.title}
Content: ${a.content}

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

  const message = await callAnthropicMessage({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  }, { operation: 'trackOutcome' });
  
  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  
  return {
    promise: a.title,
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
    
  } catch (error: unknown) {
    console.error('Error verifying promise:', error);
    return { delivered: false, score_adjustment: 0, evidence: 'Verification error' };
  }
}

async function aiVerifyPromiseDelivery(promise: unknown) {
  const p = promise as {
    promise_text: string;
    politician_name: string;
    announced_date?: string;
    target_date?: string;
  };
  // Use AI to search for evidence of delivery
  const prompt = `
Research if this promise was delivered:

Promise: ${p.promise_text}
By: ${p.politician_name}
Announced: ${p.announced_date}
Target: ${p.target_date}

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

  const message = await callAnthropicMessage({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  }, { operation: 'verifyDelivery', timeoutMs: 120_000 });
  
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

/** Outcome tracking service methods. */
export const OutcomesTrackingService = {
  detectAnnouncementVsAchievement,
  adjustScoreForAnnouncementBias,
  trackPromiseFromAnnouncement,
  verifyPromiseOutcome
};

