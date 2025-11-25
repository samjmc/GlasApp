/**
 * Personal Rankings Service
 * Calculates personalized TD rankings based on:
 * 1. Ideology Match (50%) - from quiz baseline
 * 2. Policy Agreement (50%) - from specific article votes
 */

import { supabaseDb } from '../db.js';
import { AdaptiveScoringEngine } from './adaptiveScoringEngine.js';
import {
  IDEOLOGY_DIMENSIONS,
  clampIdeologyValue,
  emptyIdeologyVector,
  type IdeologyDimension,
} from '../constants/ideology.js';

type IdeologyVector = Record<IdeologyDimension, number>;

interface LegacyQuizAnswers {
  immigration: number;
  healthcare: number;
  housing: number;
  economy: number;
  environment: number;
  social_issues: number;
  justice: number;
  education: number;
}

interface UserIdeologyProfile extends IdeologyVector {
  user_id: string;
  total_weight: number;
}

interface TDIdeologyProfile extends IdeologyVector {
  politician_name: string;
  party: string | null;
  constituency: string | null;
  total_weight: number;
}

interface CachedTDEntry {
  key: string;
  profile: TDIdeologyProfile;
  meta: {
    party: string | null;
    constituency: string | null;
    national_rank: number | null;
    overall_elo: number | null;
    overall_score: number | null;
    image_url: string | null;
  };
}

const MAX_IDEOLOGY_DISTANCE = 20; // Range between -10 and +10 on each axis

function convertQuizAnswerToIdeology(value?: number): number {
  if (typeof value !== 'number') return 0;
  return clampIdeologyValue(((value - 3) / 2) * 10);
}

function convertIdeologyToQuizAnswer(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 3;
  const scaled = Math.round(((value / 10) * 2) + 3);
  return Math.max(1, Math.min(5, scaled));
}

interface FriendInsightsPayload {
  summary: {
    totalFriends: number;
    activeThisWeek: number;
    sharedVotes: number;
    averageCompatibility: number | null;
    sharedStreaks: number;
  };
  leaderboard: Array<{
    friendId: string;
    name: string;
    compatibility: number;
    compatibilityDelta: number | null;
    sharedVotes: number;
    personalRank: number | null;
    friendRank: number | null;
    streakDays: number;
    lastActive: string | null;
  }>;
  streaks: Array<{
    friendId: string;
    name: string;
    streakDays: number;
    lastSharedAt: string | null;
    message?: string;
  }>;
  pendingInvites: Array<{
    inviteId: string;
    friendName: string;
    status: 'pending' | 'accepted';
    sentAt: string;
  }>;
}

export class PersonalRankingsService {
  private static friendInsightsWarningLogged = false;
  private static tdCache: Map<string, CachedTDEntry> = new Map();
  private static tdCacheList: CachedTDEntry[] = [];
  private static tdCacheLoadedAt: number | null = null;
  private static readonly TD_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
  private static tdCachePending: Promise<void> | null = null;
  
  /**
   * Get or create user profile from quiz results
   */
  static async getUserProfile(userId: string): Promise<UserIdeologyProfile | null> {
    if (!supabaseDb) return null;

    const { data, error } = await supabaseDb
      .from('user_ideology_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user ideology profile:', error.message);
    }

    if (data) {
      const vector = emptyIdeologyVector();
      for (const dimension of IDEOLOGY_DIMENSIONS) {
        vector[dimension] = clampIdeologyValue(Number(data[dimension]));
      }
      return {
        user_id: userId,
        total_weight: Number(data.total_weight) || 0,
        ...vector,
      };
    }

    return await this.syncUserIdeologyProfile(userId);
  }
  
  static async hasCompletedEnhancedQuiz(userId: string): Promise<boolean> {
    if (!supabaseDb) {
      console.log('[hasCompletedEnhancedQuiz] supabaseDb is null');
      return false;
    }

    console.log(`[hasCompletedEnhancedQuiz] Checking for userId: ${userId} (type: ${typeof userId})`);

    // Try UUID format first (Supabase Auth uses UUIDs)
    const { data, error } = await supabaseDb
      .from('political_evolution')
      .select('id, user_id, quiz_version, created_at')
      .eq('user_id', userId)
      .eq('quiz_version', 'enhanced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log(`[hasCompletedEnhancedQuiz] Query result:`, { 
      hasData: !!data, 
      error: error?.message,
      data: data ? { id: data.id, user_id: data.user_id, quiz_version: data.quiz_version } : null
    });

    if (error) {
      console.error('Error checking enhanced quiz completion:', error.message);
      return false;
    }

    const result = !!data;
    console.log(`[hasCompletedEnhancedQuiz] Final result: ${result}`);
    return result;
  }

  static convertEnhancedDimensionsToLegacyAnswers(
    dimensions: Partial<IdeologyVector>
  ): LegacyQuizAnswers {
    const welfareScore = dimensions.welfare ?? 0;
    const socialScore = dimensions.social ?? dimensions.cultural ?? 0;

    return {
      immigration: convertIdeologyToQuizAnswer(dimensions.globalism),
      healthcare: convertIdeologyToQuizAnswer(welfareScore),
      housing: convertIdeologyToQuizAnswer(welfareScore),
      economy: convertIdeologyToQuizAnswer(dimensions.economic),
      environment: convertIdeologyToQuizAnswer(dimensions.environmental),
      social_issues: convertIdeologyToQuizAnswer(socialScore),
      justice: convertIdeologyToQuizAnswer(dimensions.authority),
      education: convertIdeologyToQuizAnswer(dimensions.technocratic),
    };
  }
  
  private static isTdCacheFresh(): boolean {
    if (!this.tdCacheLoadedAt) return false;
    if (!this.tdCacheList.length) return false;
    return Date.now() - this.tdCacheLoadedAt < this.TD_CACHE_TTL_MS;
  }

  private static async ensureTdCache(force = false): Promise<void> {
    if (!supabaseDb) return;
    if (!force && this.isTdCacheFresh()) return;

    if (this.tdCachePending) {
      await this.tdCachePending;
      return;
    }

    this.tdCachePending = (async () => {
      try {
        const { data: tdScoreRows, error: tdScoreError } = await supabaseDb
          .from('td_scores')
          .select('politician_name, party, constituency, national_rank, overall_score, overall_elo, image_url, is_active');

        if (tdScoreError) {
          console.error('Error loading TD scores for cache:', tdScoreError.message);
          return;
        }

        const activeScores = (tdScoreRows || []).filter((row: any) => {
          if (!row?.politician_name) return false;
          if (row.is_active === false) return false;
          return true;
        });

        const { data: ideologyRows, error: ideologyError } = await supabaseDb
          .from('td_ideology_profiles')
          .select('*');

        if (ideologyError) {
          console.error('Error loading TD ideology profiles for cache:', ideologyError.message);
          return;
        }

        const ideologyMap = new Map<string, any>();
        ideologyRows?.forEach((row: any) => {
          if (row?.politician_name) {
            ideologyMap.set(row.politician_name.toLowerCase(), row);
          }
        });

        const cacheList: CachedTDEntry[] = [];
        const cacheMap = new Map<string, CachedTDEntry>();

        for (const scoreRow of activeScores) {
          const politicianName = scoreRow.politician_name;
          if (!politicianName) continue;

          const key = politicianName.toLowerCase();
          const ideologyRow = ideologyMap.get(key);
          const vector = emptyIdeologyVector();
          let totalWeight = 0;
          let party = scoreRow?.party ?? null;
          let constituency = scoreRow?.constituency ?? null;

          if (ideologyRow) {
            totalWeight = Number(ideologyRow.total_weight) || 0;
            for (const dimension of IDEOLOGY_DIMENSIONS) {
              const rawValue = Number(ideologyRow[dimension]);
              if (Number.isFinite(rawValue)) {
                vector[dimension] = clampIdeologyValue(rawValue);
              }
            }

            if (ideologyRow.party) {
              party = ideologyRow.party;
            }
            if (ideologyRow.constituency) {
              constituency = ideologyRow.constituency;
            }
          }

          const entry: CachedTDEntry = {
            key,
            profile: {
              politician_name: politicianName,
              party,
              constituency,
              total_weight: totalWeight,
              ...vector,
            },
            meta: {
              party,
              constituency,
              national_rank:
                scoreRow?.national_rank !== undefined && scoreRow?.national_rank !== null
                  ? Number(scoreRow.national_rank)
                  : null,
              overall_elo:
                scoreRow?.overall_elo !== undefined && scoreRow?.overall_elo !== null
                  ? Number(scoreRow.overall_elo)
                  : null,
              overall_score:
                scoreRow?.overall_score !== undefined && scoreRow?.overall_score !== null
                  ? Number(scoreRow.overall_score)
                  : null,
              image_url: scoreRow?.image_url ?? null,
            },
          };

          cacheList.push(entry);
          cacheMap.set(key, entry);
        }

        this.tdCacheList = cacheList;
        this.tdCache = cacheMap;
        this.tdCacheLoadedAt = Date.now();
      } catch (cacheError) {
        console.error('Unexpected error populating TD cache:', cacheError);
      } finally {
        this.tdCachePending = null;
      }
    })();

    await this.tdCachePending;
  }

  private static async getCachedTdEntries(): Promise<CachedTDEntry[]> {
    await this.ensureTdCache();
    return this.tdCacheList;
  }

  private static async getCachedTdEntry(name: string): Promise<CachedTDEntry | null> {
    await this.ensureTdCache();
    const key = name.toLowerCase();
    return this.tdCache.get(key) ?? null;
  }

  static invalidateTDIdeologyCache(politicianName?: string): void {
    if (politicianName) {
      const key = politicianName.toLowerCase();
      if (this.tdCache.has(key)) {
        this.tdCache.delete(key);
        this.tdCacheList = this.tdCacheList.filter((entry) => entry.key !== key);
      }
    }

    this.tdCacheLoadedAt = null;
  }

  /**
   * Get TD's ideological profile (from party positions)
   */
  static async getTDProfile(politicianName: string): Promise<TDIdeologyProfile | null> {
    if (!supabaseDb) return null;

    const cached = await this.getCachedTdEntry(politicianName);
    if (cached) {
      return cached.profile;
    }

    const { data: ideology, error: ideologyError } = await supabaseDb
      .from('td_ideology_profiles')
      .select('*')
      .eq('politician_name', politicianName)
      .maybeSingle();

    if (ideologyError) {
      console.error('Error loading TD ideology profile:', ideologyError.message);
    }

    const { data: tdMeta } = await supabaseDb
      .from('td_scores')
      .select('party, constituency')
      .ilike('politician_name', politicianName)
      .maybeSingle();

    if (!ideology && !tdMeta) {
      return null;
    }

    const vector = emptyIdeologyVector();
    if (ideology) {
      for (const dimension of IDEOLOGY_DIMENSIONS) {
        vector[dimension] = clampIdeologyValue(Number(ideology[dimension]));
      }
    }

    return {
      politician_name: politicianName,
      party: ideology?.party ?? tdMeta?.party ?? null,
      constituency: ideology?.constituency ?? tdMeta?.constituency ?? null,
      total_weight: Number(ideology?.total_weight) || 0,
      ...vector,
    };
  }
  
  /**
   * Calculate ideology match between user and TD (0-100)
   */
  static calculateIdeologyMatch(user: UserIdeologyProfile, td: TDIdeologyProfile): number {
    const totalDifference = IDEOLOGY_DIMENSIONS.reduce((sum, dimension) => {
      const userScore = user[dimension] ?? 0;
      const tdScore = td[dimension] ?? 0;
      return sum + Math.abs(userScore - tdScore);
    }, 0);

    const averageDifference = totalDifference / IDEOLOGY_DIMENSIONS.length;
    const match = 100 - Math.min(100, (averageDifference / MAX_IDEOLOGY_DISTANCE) * 100);

    // Blend in confidence based on weights
    const combinedWeight = (user.total_weight || 0) * (td.total_weight || 0);
    if (combinedWeight <= 0) {
      return Math.round(match);
    }

    const confidenceMultiplier = Math.min(1, Math.log10(combinedWeight + 1) / 2);
    const adjustedMatch = match * (0.8 + 0.2 * confidenceMultiplier);

    return Math.max(0, Math.min(100, Math.round(adjustedMatch)));
  }
  
  /**
   * Calculate policy agreement rate between user and TD (0-100)
   */
  static async calculatePolicyAgreement(userId: string, politicianName: string): Promise<number> {
    if (!supabaseDb) return 50; // Default neutral
    
    const { data: agreement } = await supabaseDb
      .from('user_td_policy_agreements')
      .select('*')
      .eq('user_id', userId)
      .eq('politician_name', politicianName)
      .single();
    
    if (!agreement || agreement.total_compared === 0) {
      return 50; // Default if no policies compared yet
    }
    
    // Return agreement rate (0-100)
    return Number(agreement.agreement_rate) || 50;
  }
  
  /**
   * Update policy agreement after user votes on an article
   */
  static async updatePolicyAgreementFromVote(
    userId: string,
    articleId: number,
    userRating: number
  ): Promise<void> {
    if (!supabaseDb) return;
    
    console.log(`📊 Updating policy agreements for user ${userId.substring(0, 8)}... on article ${articleId}`);
    
    // Translate user rating to stance
    const userStance = this.ratingToStance(userRating);
    
    // Get all TD stances on this article
    const { data: tdStances, error: stanceError } = await supabaseDb
      .from('td_policy_stances')
      .select('*')
      .eq('article_id', articleId);
    
    if (stanceError) {
      console.error('Error fetching TD stances:', stanceError);
      return;
    }
    
    if (!tdStances || tdStances.length === 0) {
      console.log(`⚠️  No TD stances found for article ${articleId}`);
      return;
    }
    
    console.log(`   Found ${tdStances.length} TD stances to compare`);
    
    // Compare user stance to each TD's stance
    for (const tdStance of tdStances) {
      const agreed = this.stancesMatch(userStance, tdStance.stance);
      
      // Get current agreement record to know their score and vote history
      const { data: current } = await supabaseDb
        .from('user_td_policy_agreements')
        .select('*')
        .eq('user_id', userId)
        .eq('politician_name', tdStance.politician_name)
        .single();
      
      const currentTotal = current?.total_compared || 0;
      
      // Get current compatibility score for this TD
      const { data: rankingData } = await supabaseDb
        .from('user_personal_rankings')
        .select('overall_compatibility')
        .eq('user_id', userId)
        .eq('politician_name', tdStance.politician_name)
        .single();
      
      const currentCompatibility = Number(rankingData?.overall_compatibility) || 50;
      
      // Calculate baseline delta (like ELO system)
      const stanceStrength = tdStance.stance_strength || 3;
      const baseDelta = stanceStrength >= 4 ? 3 : 2; // Strong stance = bigger impact
      const rawDelta = agreed ? baseDelta : -baseDelta;
      
      // 🎯 ADAPTIVE SCORING: Apply diminishing returns and asymmetric penalties
      const adaptiveDelta = AdaptiveScoringEngine.calculateAdaptiveDelta(
        currentCompatibility,
        rawDelta,
        currentTotal
      );
      
      // Update counters
      const newAgreed = (current?.agreed_policies || 0) + (agreed ? 1 : 0);
      const newDisagreed = (current?.disagreed_policies || 0) + (agreed ? 0 : 1);
      const newTotal = currentTotal + 1;
      const agreementRate = (newAgreed / newTotal) * 100;
      
      // Cumulative policy delta (sum of all ADAPTIVE deltas)
      const cumulativeDelta = (current?.cumulative_policy_delta || 0) + adaptiveDelta;
      
      // Upsert agreement record
      await supabaseDb
        .from('user_td_policy_agreements')
        .upsert({
          user_id: userId,
          politician_name: tdStance.politician_name,
          agreed_policies: newAgreed,
          disagreed_policies: newDisagreed,
          total_compared: newTotal,
          agreement_rate: agreementRate,
          cumulative_policy_delta: cumulativeDelta,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,politician_name'
        });
      
      // Show detailed logging
      if (adaptiveDelta !== rawDelta) {
        const explanation = AdaptiveScoringEngine.explainDelta(currentCompatibility, rawDelta, adaptiveDelta, currentTotal);
        console.log(`     ${agreed ? '✅' : '❌'} ${tdStance.politician_name}: ${agreed ? 'Agreed' : 'Disagreed'} (${adaptiveDelta >= 0 ? '+' : ''}${adaptiveDelta} vs ${rawDelta >= 0 ? '+' : ''}${rawDelta} raw) - ${explanation}`);
      } else {
        console.log(`     ${agreed ? '✅' : '❌'} ${tdStance.politician_name}: ${agreed ? 'Agreed' : 'Disagreed'} (${adaptiveDelta >= 0 ? '+' : ''}${adaptiveDelta} points)`);
      }
    }
    
    // Recalculate personal rankings for this user
    await this.recalculatePersonalRankings(userId);
  }
  
  /**
   * Convert user rating (1-5) to stance
   */
  static ratingToStance(rating: number): 'support' | 'oppose' | 'neutral' {
    if (rating <= 2) return 'oppose';
    if (rating >= 4) return 'support';
    return 'neutral';
  }
  
  /**
   * Check if user stance matches TD stance
   */
  static stancesMatch(userStance: string, tdStance: string): boolean {
    // Exact match = agreement
    if (userStance === tdStance) return true;
    
    // If either is neutral, it's partial agreement (count as agree)
    if (userStance === 'neutral' || tdStance === 'neutral') return true;
    
    // Support vs oppose = disagreement
    return false;
  }
  
  /**
   * Recalculate all personal rankings for a user
   */
  static async recalculatePersonalRankings(userId: string): Promise<void> {
    if (!supabaseDb) return;
    
    console.log(`🔄 Recalculating personal rankings for user ${userId.substring(0, 8)}...`);
    
    // Get user's quiz results
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile) {
      console.log('User has not completed quiz yet');
      return;
    }
    
    const tdEntries = await this.getCachedTdEntries();
    if (!tdEntries.length) {
      console.warn('No TD ideology profiles cached; skipping personal ranking recalculation.');
      return;
    }

    const { data: agreementRows, error: agreementError } = await supabaseDb
      .from('user_td_policy_agreements')
      .select('*')
      .eq('user_id', userId);

    if (agreementError) {
      console.error('Error fetching user policy agreements:', agreementError.message);
    }

    const agreementMap = new Map<string, any>();
    agreementRows?.forEach((row) => {
      if (row?.politician_name) {
        agreementMap.set(row.politician_name.toLowerCase(), row);
      }
    });
    
    const rankings = [];
    
    // Calculate compatibility with each TD
    for (const entry of tdEntries) {
      const tdProfile = entry.profile;
      
      // Ideology Baseline (from quiz) - 0-100
      const ideologyBaseline = this.calculateIdeologyMatch(userProfile, tdProfile);
      
      // Get policy agreement data
      const agreementData = agreementMap.get(tdProfile.politician_name.toLowerCase());
      
      // Policy Delta (cumulative agreements/disagreements)
      // Each agreement: +2 to +3 points
      // Each disagreement: -2 to -3 points
      const policyDelta = agreementData?.cumulative_policy_delta || 0;
      
      // Overall Compatibility = Baseline + Policy Deltas (bounded 0-100)
      const overallCompatibility = Math.max(0, Math.min(100, ideologyBaseline + policyDelta));
      
      // Legacy policy agreement rate for display
      const policyAgreementRate = agreementData?.agreement_rate || 50;
      
      rankings.push({
        user_id: userId,
        politician_name: tdProfile.politician_name,
        ideology_match: ideologyBaseline,
        policy_agreement: policyAgreementRate,
        overall_compatibility: overallCompatibility,
        public_rank: entry.meta.national_rank,
        policies_compared: agreementData?.total_compared || 0,
        last_calculated: new Date().toISOString()
      });
    }
    
    // Sort by compatibility (highest first)
    rankings.sort((a, b) => b.overall_compatibility - a.overall_compatibility);
    
    // Assign personal ranks
    rankings.forEach((ranking, index) => {
      ranking.personal_rank = index + 1;
    });
    
    // Save all rankings (batch upsert)
    const { error } = await supabaseDb
      .from('user_personal_rankings')
      .upsert(rankings, {
        onConflict: 'user_id,politician_name'
      });
    
    if (error) {
      console.error('Error saving personal rankings:', error);
    } else {
      console.log(`✅ Recalculated ${rankings.length} personal rankings`);
    }
  }
  
  /**
   * Recalculate rankings for all users who have quiz data or prior rankings
   */
  static async recalculateAllUserRankings(batchSize: number = 50): Promise<{ usersUpdated: number; errors: number }> {
    if (!supabaseDb) {
      return { usersUpdated: 0, errors: 1 };
    }

    const userIds = new Set<string>();

    const { data: quizUsers, error: quizError } = await supabaseDb
      .from('user_quiz_results')
      .select('user_id');

    if (quizError) {
      console.error('Error fetching quiz users for personal rankings:', quizError);
      return { usersUpdated: 0, errors: 1 };
    }

    quizUsers?.forEach((row: any) => {
      if (row?.user_id) userIds.add(row.user_id);
    });

    const { data: rankingUsers, error: rankingError } = await supabaseDb
      .from('user_personal_rankings')
      .select('user_id');

    if (!rankingError) {
      rankingUsers?.forEach((row: any) => {
        if (row?.user_id) userIds.add(row.user_id);
      });
    } else {
      console.warn('Warning fetching existing personal rankings users:', rankingError.message);
    }

    const ids = Array.from(userIds);
    let usersUpdated = 0;
    let errors = 0;

    for (let index = 0; index < ids.length; index += 1) {
      const userId = ids[index];
      try {
        await this.recalculatePersonalRankings(userId);
        usersUpdated += 1;

        if (batchSize > 0 && (index + 1) % batchSize === 0) {
          // Yield briefly to avoid hammering Supabase
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error: any) {
        errors += 1;
        console.error(`Error recalculating rankings for user ${userId}:`, error.message ?? error);
      }
    }

    return { usersUpdated, errors };
  }

  private static async syncUserIdeologyProfile(userId: string): Promise<UserIdeologyProfile | null> {
    const enhancedProfile = await this.buildProfileFromEnhancedQuiz(userId);
    if (enhancedProfile) {
      return enhancedProfile;
    }
    return await this.buildProfileFromLegacyQuiz(userId);
  }

  private static async buildProfileFromEnhancedQuiz(userId: string): Promise<UserIdeologyProfile | null> {
    if (!supabaseDb) return null;

    // First try to get from political_evolution table (primary source for enhanced quiz)
    const { data: evolutionData, error: evolutionError } = await supabaseDb
      .from('political_evolution')
      .select('*')
      .eq('user_id', userId)
      .eq('quiz_version', 'enhanced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!evolutionError && evolutionData) {
      // Use political_evolution data (this is the primary source)
      const vector = emptyIdeologyVector();
      vector.economic = clampIdeologyValue(Number(evolutionData.economic_score) || 0);
      vector.social = clampIdeologyValue(Number(evolutionData.social_score) || 0);
      vector.cultural = clampIdeologyValue(Number(evolutionData.cultural_score) || 0);
      vector.globalism = clampIdeologyValue(Number(evolutionData.globalism_score) || 0);
      vector.environmental = clampIdeologyValue(Number(evolutionData.environmental_score) || 0);
      vector.authority = clampIdeologyValue(Number(evolutionData.authority_score) || 0);
      vector.welfare = clampIdeologyValue(Number(evolutionData.welfare_score) || 0);
      vector.technocratic = clampIdeologyValue(Number(evolutionData.technocratic_score) || 0);

      const payload = {
        user_id: userId,
        ...vector,
        total_weight: 16, // Enhanced quiz has 8 dimensions × 2 (weight)
        updated_at: new Date().toISOString(),
      };

      // Sync to user_ideology_profiles table
      const { error: upsertError } = await supabaseDb
        .from('user_ideology_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Error syncing enhanced quiz profile:', upsertError.message);
      } else {
        console.log(`✅ Synced enhanced quiz profile for user ${userId} to user_ideology_profiles`);
      }

      return {
        user_id: userId,
        ...vector,
        total_weight: 16,
      };
    }

    // Fallback to quiz_results table (legacy)
    const { data, error } = await supabaseDb
      .from('quiz_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching enhanced quiz results:', error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    const dimensionFields: Partial<Record<IdeologyDimension, number>> = {
      economic: Number((data as any).economic_dimension),
      social: Number((data as any).social_dimension),
      cultural: Number((data as any).cultural_dimension),
      globalism: Number((data as any).globalism_dimension),
      environmental: Number((data as any).environmental_dimension),
      authority: Number((data as any).authority_dimension),
      welfare: Number((data as any).welfare_dimension),
      technocratic: Number((data as any).technocratic_dimension),
    };

    const hasEnhancedDimensions = IDEOLOGY_DIMENSIONS.some((dimension) => {
      const value = dimensionFields[dimension];
      return typeof value === 'number' && !Number.isNaN(value);
    });

    if (!hasEnhancedDimensions) {
      return null;
    }

    const vector = emptyIdeologyVector();
    for (const dimension of IDEOLOGY_DIMENSIONS) {
      const value = dimensionFields[dimension];
      vector[dimension] = clampIdeologyValue(typeof value === 'number' && !Number.isNaN(value) ? value : 0);
    }

    const payload = {
      user_id: userId,
      ...vector,
      total_weight: 16,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseDb
      .from('user_ideology_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Error syncing enhanced quiz profile:', upsertError.message);
      return null;
    }

    return payload as UserIdeologyProfile;
  }

  private static async buildProfileFromLegacyQuiz(userId: string): Promise<UserIdeologyProfile | null> {
    if (!supabaseDb) return null;

    const { data, error } = await supabaseDb
      .from('user_quiz_results')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const vector = emptyIdeologyVector();
    vector.economic = convertQuizAnswerToIdeology(Number(data.economy));
    vector.environmental = convertQuizAnswerToIdeology(Number(data.environment));

    const welfareInputs = [data.healthcare, data.housing]
      .map((value: any) => (typeof value === 'number' ? value : Number(value)))
      .filter((value) => Number.isFinite(value));
    if (welfareInputs.length) {
      const average = welfareInputs.reduce((sum, value) => sum + Number(value), 0) / welfareInputs.length;
      vector.welfare = convertQuizAnswerToIdeology(average);
    }

    const socialScore = convertQuizAnswerToIdeology(Number(data.social_issues));
    vector.social = socialScore;
    vector.cultural = socialScore;

    vector.globalism = convertQuizAnswerToIdeology(Number(data.immigration));
    vector.authority = convertQuizAnswerToIdeology(Number(data.justice));
    vector.technocratic = convertQuizAnswerToIdeology(Number(data.education));

    const payload = {
      user_id: userId,
      ...vector,
      total_weight: 8,
      updated_at: new Date().toISOString(),
    };

    await supabaseDb
      .from('user_ideology_profiles')
      .upsert(payload, { onConflict: 'user_id' });

    return payload as UserIdeologyProfile;
  }

  /**
   * Get personal rankings for a user
   */
  static async getPersonalRankings(
    userId: string,
    limit: number = 173
  ): Promise<any[]> {
    if (!supabaseDb) return [];
    const hasEnhanced = await this.hasCompletedEnhancedQuiz(userId);
    if (!hasEnhanced) {
      return [];
    }
    
    // Get user's personal rankings
    const { data: rankings, error } = await supabaseDb
      .from('user_personal_rankings')
      .select('*')
      .eq('user_id', userId)
      .order('personal_rank', { ascending: true })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching personal rankings:', error);
      return [];
    }
    
    if (!rankings || rankings.length === 0) {
      return [];
    }
    
    await this.ensureTdCache();

    const enrichedRankings = [];
    for (const ranking of rankings) {
      const key = ranking.politician_name?.toLowerCase?.();
      let tdData: any = null;

      if (key && this.tdCache.has(key)) {
        const cached = this.tdCache.get(key)!;
        tdData = {
          constituency: cached.meta.constituency || 'Unknown',
          party: cached.meta.party || 'Unknown',
          overall_elo: cached.meta.overall_elo,
          overall_score: cached.meta.overall_score,
          national_rank: cached.meta.national_rank,
          image_url: cached.meta.image_url,
        };
      } else if (supabaseDb) {
        const { data: fallback } = await supabaseDb
          .from('td_scores')
          .select('constituency, party, overall_elo, overall_score, national_rank, image_url')
          .ilike('politician_name', ranking.politician_name)
          .maybeSingle();
        tdData = fallback || null;
      }
      
      enrichedRankings.push({
        ...ranking,
        td_scores: tdData
      });
    }
    
    return enrichedRankings;
  }
  
  static async getPartyMatches(userId: string, limit = 5): Promise<
    Array<{
      party: string;
      match: number;
      ideology: IdeologyVector;
      total_weight: number;
    }>
  > {
    if (!supabaseDb) return [];

    const userProfile = await this.getUserProfile(userId);
    if (!userProfile) {
      return [];
    }

    const { data: partyProfiles, error } = await supabaseDb
      .from('party_ideology_profiles')
      .select('*');

    if (error || !partyProfiles) {
      if (error) {
        console.error('Error fetching party ideology profiles:', error.message);
      }
      return [];
    }

    const matches = partyProfiles
      .map((partyProfile) => {
        const vector = emptyIdeologyVector();
        for (const dimension of IDEOLOGY_DIMENSIONS) {
          vector[dimension] = clampIdeologyValue(Number(partyProfile[dimension]));
        }

        const pseudoProfile: TDIdeologyProfile = {
          politician_name: partyProfile.party,
          party: partyProfile.party,
          constituency: null,
          total_weight: Number(partyProfile.total_weight) || 0,
          ...vector,
        };

        const match = this.calculateIdeologyMatch(userProfile, pseudoProfile);

        return {
          party: partyProfile.party,
          match,
          ideology: vector,
          total_weight: pseudoProfile.total_weight,
        };
      })
      .sort((a, b) => b.match - a.match)
      .slice(0, limit);

    return matches;
  }

  /**
   * Save quiz results and create initial rankings
   */
  static async saveQuizResults(
    userId: string,
    quizAnswers: LegacyQuizAnswers,
    options: { asyncRecalculation?: boolean } = {}
  ): Promise<void> {
    if (!supabaseDb) return;
    
    // Save quiz results
    const { error: quizError } = await supabaseDb
      .from('user_quiz_results')
      .upsert({
        user_id: userId,
        immigration: quizAnswers.immigration,
        healthcare: quizAnswers.healthcare,
        housing: quizAnswers.housing,
        economy: quizAnswers.economy,
        environment: quizAnswers.environment,
        social_issues: quizAnswers.social_issues,
        justice: quizAnswers.justice,
        education: quizAnswers.education,
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (quizError) {
      console.error('Error saving quiz results:', quizError);
      throw quizError;
    }
    
    // Ensure ideology profile reflects the best available quiz data
    await this.syncUserIdeologyProfile(userId);
    
    // Calculate initial personal rankings
    if (options.asyncRecalculation) {
      setTimeout(() => {
        this.recalculatePersonalRankings(userId).catch((error) => {
          console.error(
            'Error recalculating personal rankings asynchronously:',
            error?.message ?? error
          );
        });
      }, 0);
    } else {
      await this.recalculatePersonalRankings(userId);
    }
  }

  /**
   * Placeholder friend insights until social graph backend is ready.
   * Returns structured empty state so the client can render tabs gracefully.
   */
  static async getFriendInsights(_userId: string): Promise<FriendInsightsPayload> {
    if (!this.friendInsightsWarningLogged) {
      console.warn('[friends] Friend insights data source not configured; returning placeholder payload.');
      this.friendInsightsWarningLogged = true;
    }

    return {
      summary: {
        totalFriends: 0,
        activeThisWeek: 0,
        sharedVotes: 0,
        averageCompatibility: null,
        sharedStreaks: 0
      },
      leaderboard: [],
      streaks: [],
      pendingInvites: []
    };
  }
}

