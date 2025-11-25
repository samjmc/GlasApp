/**
 * Policy Voting Component
 * Allows users to vote on ideological policies with slider rating
 * Shows neutral facts and different perspectives
 */

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Info } from 'lucide-react';
import { SliderVoteControl } from "@/components/votes/SliderVoteControl";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface PolicyFacts {
  action: string;
  who_affected?: string;
  amount?: string;
  timeline?: string;
  estimated_people?: number;
  stated_reason?: string;
}

interface Perspectives {
  supporters_say: string;
  critics_say: string;
  expert_view?: string;
}

interface VoteStats {
  total_votes: number;
  five_stars: number;
  four_stars: number;
  three_stars: number;
  two_stars: number;
  one_star: number;
  average_rating: number;
  policy_impact_score: number;
}

interface PolicyVotingProps {
  articleId: number;
  politicianName: string;
  policyFacts?: PolicyFacts;
  perspectives?: Perspectives;
  userId?: string;
  isIdeologicalPolicy: boolean;
  policyDirection?: 'progressive' | 'conservative' | 'centrist' | 'technical';
  tdStance?: string; // 'support' | 'oppose' | 'neutral'
  tdStanceEvidence?: string; // What the TD said/did
}

export function PolicyVoting({
  articleId,
  politicianName,
  policyFacts,
  perspectives,
  userId: _unusedUserId, // Deprecated prop - now using auth context
  isIdeologicalPolicy,
  policyDirection,
  tdStance,
  tdStanceEvidence
}: PolicyVotingProps) {
  const { user, isAuthenticated } = useAuth();
  const [userVote, setUserVote] = useState<number | null>(null);
  const [voteStats, setVoteStats] = useState<VoteStats | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [justVoted, setJustVoted] = useState(false);
  const [pendingRating, setPendingRating] = useState<number>(3);

  // If not an ideological policy, don't show voting
  if (!isIdeologicalPolicy || !policyFacts) {
    return null;
  }

  useEffect(() => {
    loadVoteData();
  }, [articleId, user?.id]);

  useEffect(() => {
    setPendingRating(userVote ?? 3);
  }, [userVote]);

  const loadVoteData = async () => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Load vote statistics
      const statsRes = await fetch(`/api/policy-votes/article/${articleId}`);
      const statsData = await statsRes.json();
      
      if (statsData.success && statsData.stats.length > 0) {
        const tdStats = statsData.stats.find((s: any) => s.politician_name === politicianName);
        if (tdStats) {
          setVoteStats(tdStats);
        }
      }

      // Load user's vote if logged in
      if (user?.id && token) {
        const userRes = await fetch(`/api/policy-votes/user/me/article/${articleId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const userData = await userRes.json();
        
        if (userData.success && userData.votes.length > 0) {
          const tdVote = userData.votes.find((v: any) => v.politician_name === politicianName);
          if (tdVote) {
            setUserVote(tdVote.support_rating);
          }
        }
      }
    } catch (error) {
      console.error('Error loading vote data:', error);
    }
  };

  const handleVote = async (rating: number) => {
    if (!isAuthenticated || !user) {
      alert('Please log in to vote on policies');
      return;
    }

    if (userVote !== null && userVote === rating) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }

      const res = await fetch('/api/policy-votes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          articleId,
          politicianName,
          supportRating: rating
        })
      });

      const data = await res.json();

      if (data.success) {
        setPendingRating(rating);
        setUserVote(rating);
        setJustVoted(true);
        await loadVoteData(); // Refresh stats
        
        // Update personal rankings based on this vote
        try {
          const personalRes = await fetch('/api/personal/vote', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              userId: user.id,
              articleId,
              rating
            })
          });
          const personalData = await personalRes.json().catch(() => null);
          if (personalRes.ok && personalData?.success) {
            console.log('✅ Personal rankings updated from policy vote');
            const event = new CustomEvent('personal-rankings:update', {
              detail: {
                updatedProfile: personalData.updatedProfile ?? null,
                topMatches: personalData.topMatches ?? [],
              },
            });
            window.dispatchEvent(event);
          } else {
            console.warn('⚠️ Personal rankings update returned non-OK status', personalData);
          }
        } catch (personalRankError) {
          // Don't fail the whole vote if personal rankings update fails
          console.error('⚠️  Personal rankings update failed:', personalRankError);
        }
      } else {
        throw new Error(data.error || 'Failed to submit vote');
      }
    } catch (error: any) {
      console.error('Error submitting vote:', error);
      alert(error.message || 'Failed to submit vote. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStarLabel = (rating: number): string => {
    const labels: Record<number, string> = {
      5: 'Strongly Support',
      4: 'Support',
      3: 'Neutral',
      2: 'Oppose',
      1: 'Strongly Oppose'
    };
    return labels[rating];
  };

  const getPercentage = (count: number): number => {
    if (!voteStats || voteStats.total_votes === 0) return 0;
    return Math.round((count / voteStats.total_votes) * 100);
  };

  const getProgressBar = (percentage: number): string => {
    const bars = Math.round(percentage / 10);
    return '▓'.repeat(bars) + '░'.repeat(10 - bars);
  };

  const getPolicyDirectionBadge = () => {
    const badges: Record<string, { color: string; label: string }> = {
      progressive: { color: 'bg-blue-100 text-blue-800', label: 'Progressive Policy' },
      conservative: { color: 'bg-red-100 text-red-800', label: 'Conservative Policy' },
      centrist: { color: 'bg-purple-100 text-purple-800', label: 'Centrist Policy' },
      technical: { color: 'bg-gray-100 text-gray-800', label: 'Technical Policy' }
    };

    const badge = policyDirection ? badges[policyDirection] : null;
    if (!badge) return null;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          🗳️ Policy Vote
          {getPolicyDirectionBadge()}
        </h4>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
        >
          <Info size={14} />
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Policy Facts (Neutral) */}
      {showDetails && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 mb-3 space-y-2 text-sm">
          <div>
            <span className="font-medium text-gray-300">What Happened:</span>
            <p className="text-gray-400 mt-1">{policyFacts.action}</p>
          </div>

          {policyFacts.who_affected && (
            <div>
              <span className="font-medium text-gray-300">Who's Affected:</span>
              <p className="text-gray-400">{policyFacts.who_affected}</p>
            </div>
          )}

          {policyFacts.amount && (
            <div>
              <span className="font-medium text-gray-300">Amount:</span>
              <p className="text-gray-400">{policyFacts.amount}</p>
            </div>
          )}

          {policyFacts.estimated_people && (
            <div>
              <span className="font-medium text-gray-300">People Affected:</span>
              <p className="text-gray-400">~{policyFacts.estimated_people.toLocaleString()}</p>
            </div>
          )}

          {policyFacts.stated_reason && (
            <div>
              <span className="font-medium text-gray-300">Stated Reason:</span>
              <p className="text-gray-400 italic">"{policyFacts.stated_reason}"</p>
            </div>
          )}
        </div>
      )}

      {/* Different Perspectives */}
      {showDetails && perspectives && (
        <div className="space-y-2 mb-3 text-sm">
          <div className="flex items-start gap-2 bg-green-900/20 border border-green-700/30 rounded-lg p-3">
            <ThumbsUp size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-green-300">Supporters say:</span>
              <p className="text-gray-300 mt-1">{perspectives.supporters_say}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-lg p-3">
            <ThumbsDown size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-red-300">Critics say:</span>
              <p className="text-gray-300 mt-1">{perspectives.critics_say}</p>
            </div>
          </div>

          {perspectives.expert_view && (
            <div className="flex items-start gap-2 bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
              <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-blue-300">Expert view:</span>
                <p className="text-gray-300 mt-1">{perspectives.expert_view}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TD's Stance - Make it crystal clear what we're voting on */}
      {tdStance && (
        <div className={`rounded-lg p-4 mb-4 border-2 ${
          tdStance === 'support' ? 'bg-green-900/20 border-green-700/50' :
          tdStance === 'oppose' ? 'bg-red-900/20 border-red-700/50' :
          'bg-gray-800/30 border-gray-700/50'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              tdStance === 'support' ? 'bg-green-600/30' : tdStance === 'oppose' ? 'bg-red-600/30' : 'bg-gray-600/30'
            }`}>
              {tdStance === 'support' ? '✓' : tdStance === 'oppose' ? '✗' : '−'}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-300 mb-1">
                {politicianName}'s Position:
              </div>
              <div className={`text-base font-bold mb-2 ${
                tdStance === 'support' ? 'text-green-300' : tdStance === 'oppose' ? 'text-red-300' : 'text-gray-300'
              }`}>
                {tdStance === 'support' ? '✓ SUPPORTS' : tdStance === 'oppose' ? '✗ OPPOSES' : 'NEUTRAL'}
                {' '}this policy
              </div>
              {tdStanceEvidence && (
                <p className="text-sm text-gray-400 italic">
                  "{tdStanceEvidence}"
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voting Interface */}
      <div className="space-y-4">
        {/* Show confirmation message if just voted */}
        {justVoted && userVote ? (
          <div className="bg-gradient-to-br from-emerald-900/40 via-green-900/30 to-teal-900/30 border-2 border-emerald-600/50 rounded-xl p-6 text-center shadow-lg backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-emerald-600/30 rounded-full flex items-center justify-center border-2 border-emerald-500/50 shadow-lg">
                <span className="text-4xl">✓</span>
              </div>
              <div>
                <p className="font-bold text-emerald-100 text-xl mb-1">
                  Thanks for voting! 🎉
                </p>
                <p className="text-emerald-300 text-sm">
                  Your personalized rankings have been updated
                </p>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm ${
                userVote === 5 ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                userVote === 4 ? 'bg-green-900/30 text-green-400 border border-green-700/30' :
                userVote === 3 ? 'bg-gray-800/50 text-gray-300 border border-gray-700/50' :
                userVote === 2 ? 'bg-red-900/30 text-red-400 border border-red-700/30' :
                'bg-red-900/50 text-red-300 border border-red-700/50'
              }`}>
                {userVote === 5 ? '🟢' : userVote === 4 ? '🟢' : userVote === 3 ? '⚪' : userVote === 2 ? '🔴' : '🔴'}
                <span>Your Vote: {getStarLabel(userVote)}</span>
              </div>
              <button
                onClick={() => setJustVoted(false)}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline mt-2"
              >
                Change my vote
              </button>
            </div>
          </div>
        ) : userVote && !justVoted ? (
          /* Already voted previously - show simple confirmation with change button */
          <div className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">You voted:</span>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium text-sm ${
                  userVote === 5 ? 'bg-green-900/50 text-green-300 border border-green-700/50' :
                  userVote === 4 ? 'bg-green-900/30 text-green-400 border border-green-700/30' :
                  userVote === 3 ? 'bg-gray-800/50 text-gray-300 border border-gray-700/50' :
                  userVote === 2 ? 'bg-red-900/30 text-red-400 border border-red-700/30' :
                  'bg-red-900/50 text-red-300 border border-red-700/50'
                }`}>
                  {userVote === 5 ? '🟢' : userVote === 4 ? '🟢' : userVote === 3 ? '⚪' : userVote === 2 ? '🔴' : '🔴'}
                  <span>{getStarLabel(userVote)}</span>
                </div>
              </div>
              <button
                onClick={() => setUserVote(null)}
                className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                🔄 Change my vote
              </button>
            </div>
          </div>
        ) : (
          /* Show slider if haven't voted yet */
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-200 text-center py-2 px-4 bg-purple-900/30 border border-purple-700/50 rounded-lg">
              ❓ What's YOUR stance on this policy?
            </p>
            
            {/* Slider Voting */}
            <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
              <div className="space-y-4">
                <SliderVoteControl
                  value={pendingRating}
                  onValueChange={(newValue) => setPendingRating(newValue)}
                  onValueCommit={(newValue) => {
                    const rounded = Math.round(newValue);
                    setPendingRating(rounded);
                    void handleVote(rounded);
                  }}
                  disabled={isSubmitting}
                />
                <div className="text-center text-sm text-gray-300">
                  Current stance: <span className="font-semibold text-emerald-300">{getStarLabel(pendingRating)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vote to Reveal - Show teaser if user hasn't voted yet */}
        {!userVote && !justVoted && voteStats && voteStats.total_votes > 0 && (
          <div className="bg-gradient-to-br from-emerald-900/30 via-blue-900/30 to-purple-900/30 border-2 border-emerald-700/50 rounded-xl p-6 text-center shadow-sm backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-emerald-900/50 rounded-full flex items-center justify-center border border-emerald-700/50">
                <span className="text-2xl">🗳️</span>
              </div>
              <div>
                <p className="font-semibold text-gray-100 text-lg">
                  {voteStats.total_votes} {voteStats.total_votes === 1 ? 'person has' : 'people have'} voted
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Vote now to unlock community results
                </p>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-900/60 backdrop-blur-sm rounded-full border border-emerald-700/40">
                <span className="text-sm font-medium text-gray-300">Average:</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-4 rounded-full ${
                          i <= Math.round(voteStats.average_rating)
                            ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                            : 'bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-bold text-emerald-400">
                    {voteStats.average_rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vote Statistics - Show after user votes (including just voted) */}
        {userVote && !justVoted && voteStats && voteStats.total_votes > 0 && (
          <div className="bg-gray-900/40 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600/80 to-blue-600/80 px-4 py-3">
              <div className="flex items-center justify-between text-white">
                <span className="font-semibold flex items-center gap-2">
                  <span className="text-lg">🎉</span>
                  Community Results Unlocked
                </span>
                <span className="text-emerald-100 text-sm">{voteStats.total_votes} votes</span>
              </div>
            </div>
            
            <div className="p-4 space-y-2.5">
              {[
                { rating: 5, count: voteStats.five_stars, label: 'Strongly Support', gradient: 'from-green-500 to-green-600' },
                { rating: 4, count: voteStats.four_stars, label: 'Support', gradient: 'from-green-400 to-green-500' },
                { rating: 3, count: voteStats.three_stars, label: 'Neutral', gradient: 'from-gray-400 to-gray-500' },
                { rating: 2, count: voteStats.two_stars, label: 'Oppose', gradient: 'from-orange-400 to-orange-500' },
                { rating: 1, count: voteStats.one_star, label: 'Strongly Oppose', gradient: 'from-red-500 to-red-600' }
              ].map(({ rating, count, label, gradient }) => {
                const percentage = getPercentage(count);
                return (
                  <div key={rating} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-300 w-6">{rating}</span>
                        <span className="text-gray-400">{label}</span>
                      </div>
                      <span className="font-semibold text-gray-200">{percentage}%</span>
                    </div>
                    <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              
              <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Net Community Score:</span>
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-bold ${
                  voteStats.policy_impact_score > 0 ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
                  voteStats.policy_impact_score < 0 ? 'bg-red-900/50 text-red-400 border border-red-700/50' :
                  'bg-gray-800/50 text-gray-400 border border-gray-700/50'
                }`}>
                  {voteStats.policy_impact_score > 0 ? '+' : ''}{voteStats.policy_impact_score}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PolicyVoting;

