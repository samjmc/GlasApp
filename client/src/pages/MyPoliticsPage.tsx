/**
 * My Politics Page
 * Personalized TD rankings based on user's quiz + policy votes
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Users,
  Building2,
  UserPlus2,
  ArrowRight,
  Lock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Trophy,
  Share2,
  Loader2
} from 'lucide-react';
import { Link } from 'wouter';
import IdeologyTimeSeriesChartEnhanced from '@/components/IdeologyTimeSeriesChartEnhanced';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const convertDimensionScoreToAnswer = (score: number | null | undefined): number => {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 3;
  }
  const raw = (score / 10) * 2 + 3;
  return Math.min(5, Math.max(1, Math.round(raw)));
};

const IDEOLOGY_AXIS_LABELS: Record<string, string> = {
  economic: 'Economic Left - Right',
  social: 'Social Progressive - Conservative',
  cultural: 'Cultural Multicultural - Traditional',
  authority: 'Authority Libertarian - Authoritarian',
  environmental: 'Environmental Ecological - Industrial',
  welfare: 'Welfare Individual - Communitarian',
  globalism: 'Globalism Internationalist - Nationalist',
  technocratic: 'Governance Populist - Technocratic',
};

interface PersonalRanking {
  name: string;
  party: string;
  constituency: string;
  personalRank: number;
  publicRank: number;
  compatibility: number;
  ideologyMatch: number;
  policyAgreement: number;
  policiesCompared: number;
  overallScore: number;
}

interface FriendSummary {
  totalFriends: number;
  activeThisWeek: number;
  sharedVotes: number;
  averageCompatibility: number | null;
  sharedStreaks: number;
}

interface FriendComparison {
  friendId: string;
  name: string;
  compatibility: number;
  compatibilityDelta: number | null;
  sharedVotes: number;
  personalRank: number | null;
  friendRank: number | null;
  streakDays: number;
  lastActive: string | null;
}

interface FriendStreak {
  friendId: string;
  name: string;
  streakDays: number;
  lastSharedAt: string | null;
  message?: string;
}

interface FriendInvite {
  inviteId: string;
  friendName: string;
  status: 'pending' | 'accepted';
  sentAt: string;
}

interface FriendInsightsResponse {
  summary: FriendSummary;
  leaderboard: FriendComparison[];
  streaks: FriendStreak[];
  pendingInvites: FriendInvite[];
}

interface FriendInsightsApiResponse extends FriendInsightsResponse {
  success: boolean;
  message?: string;
}

interface IdeologyProfileResponse {
  ideology: Record<string, number>;
  totalWeight: number;
  avgScore: number;
  ideologyLabel: string;
  intensity: number;
  engagement: string;
}

interface PartyMatch {
  party: string;
  match: number;
  ideology: Record<string, number>;
  confidence: number;
}

const formatConfidence = (weight: number): string => {
  if (!weight || weight <= 0) return 'No signals yet';
  if (weight >= 40) return 'High confidence';
  if (weight >= 15) return 'Moderate confidence';
  return 'Low confidence';
};

export default function MyPoliticsPage() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  const [profile, setProfile] = useState<IdeologyProfileResponse | null>(null);
  const [rankings, setRankings] = useState<PersonalRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [partyMatches, setPartyMatches] = useState<PartyMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'personal' | 'friends'>('personal');
  const [friendSummary, setFriendSummary] = useState<FriendSummary | null>(null);
  const [friendLeaderboard, setFriendLeaderboard] = useState<FriendComparison[]>([]);
  const [friendStreaks, setFriendStreaks] = useState<FriendStreak[]>([]);
  const [pendingInvites, setPendingInvites] = useState<FriendInvite[]>([]);
  const [isFriendsLoading, setIsFriendsLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isProcessingQuiz, setIsProcessingQuiz] = useState(false);
  const [quizStatusMessage, setQuizStatusMessage] = useState<string | null>(null);
  const [quizError, setQuizError] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const formatRelativeDate = (isoString: string | null | undefined) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString(undefined, sameYear
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
    );
  };

  const shellClass = "mobile-shell mobile-stack";
  const defaultCardClass = "mobile-card";

  const resetFriendsState = useCallback(() => {
    setFriendSummary(null);
    setFriendLeaderboard([]);
    setFriendStreaks([]);
    setPendingInvites([]);
    setInviteCopied(false);
  }, []);

  const loadFriendsData = useCallback(async (userId: string) => {
    if (!userId) return;
    setIsFriendsLoading(true);
    setFriendsError(null);
    setInviteCopied(false);

    try {
      const res = await fetch(`/api/personal/friends/${userId}`);
      const data: FriendInsightsApiResponse = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Unable to load friend insights');
      }

      setFriendSummary(data.summary ?? null);
      setFriendLeaderboard(data.leaderboard ?? []);
      setFriendStreaks(data.streaks ?? []);
      setPendingInvites(data.pendingInvites ?? []);
    } catch (error: any) {
      console.error('Error loading friend insights:', error);
      setFriendsError(error?.message || 'Unable to load friend insights right now.');
      resetFriendsState();
    } finally {
      setIsFriendsLoading(false);
    }
  }, []);

  const handleFriendsRetry = useCallback(() => {
    if (user?.id) {
      loadFriendsData(user.id);
    }
  }, [user, loadFriendsData]);

  const handleInviteShare = async () => {
    const inviteLink = typeof window !== 'undefined'
      ? `${window.location.origin}/signup`
      : '';

    setInviteCopied(false);

    if (!inviteLink) return;

    try {
      const nav = navigator as Navigator & {
        share?: (data?: ShareData) => Promise<void>;
      };

      if (nav.share) {
        await nav.share({
          title: 'Join me on Glas Politics',
          text: 'Compare TD rankings with me on Glas Politics.',
          url: inviteLink
        });
        setInviteCopied(true);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        setInviteCopied(true);
      }
    } catch (error) {
      console.error('Invite share failed:', error);
    }
  };

  const loadUserData = useCallback(
    async (options: { skipFriends?: boolean; skipLoadingState?: boolean } = {}) => {
      const { skipFriends = false, skipLoadingState = false } = options;
      
      if (!isAuthenticated || !user) {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
        return { hasProfile: false, rankingsCount: 0, matchesCount: 0 };
      }
      
      if (!skipLoadingState) {
        setIsLoading(true);
      }
      
      try {
        const profileRes = await fetch(`/api/personal/profile/${user.id}`);
        const profileData = await profileRes.json();
        
        // Debug logging
        console.log('Profile API response:', {
          ok: profileRes.ok,
          status: profileRes.status,
          hasCompletedQuiz: profileData.hasCompletedQuiz,
          profile: profileData.profile,
          userId: user.id
        });
        
        if (!profileRes.ok) {
          setHasCompletedQuiz(false);
          setProfile(null);
          setRankings([]);
          setTopMatches([]);
          setPartyMatches([]);
          if (!skipLoadingState) {
            setIsLoading(false);
          }
          return { hasProfile: false, rankingsCount: 0, matchesCount: 0 };
        }
        
        setHasCompletedQuiz(Boolean(profileData.hasCompletedQuiz));
        setProfile(profileData.profile ?? null);
        
        if (!skipFriends) {
          await loadFriendsData(user.id);
        }
        
        let rankingsCount = 0;
        let matchesCount = 0;
        
        if (profileData.hasCompletedQuiz) {
          const rankingsRes = await fetch(`/api/personal/rankings/${user.id}?limit=50`);
          if (rankingsRes.ok) {
            const rankingsData = await rankingsRes.json();
            const nextRankings: PersonalRanking[] = rankingsData.rankings || [];
            rankingsCount = nextRankings.length;
            setRankings(nextRankings);
          } else {
            setRankings([]);
          }
          
          const matchesRes = await fetch(`/api/personal/top-matches/${user.id}`);
          if (matchesRes.ok) {
            const matchesData = await matchesRes.json();
            const nextMatches = matchesData.topMatches || [];
            matchesCount = nextMatches.length;
            setTopMatches(nextMatches);
          } else {
            setTopMatches([]);
          }

          const partyRes = await fetch(`/api/personal/party-matches/${user.id}?limit=8`);
          if (partyRes.ok) {
            const partyData = await partyRes.json();
            setPartyMatches(partyData.matches || []);
          } else {
            setPartyMatches([]);
          }
        } else {
          setRankings([]);
          setTopMatches([]);
          setPartyMatches([]);
        }
        
        return {
          hasProfile: Boolean(profileData.hasCompletedQuiz),
          rankingsCount,
          matchesCount
        };
      } catch (error) {
        console.error('Error loading user data:', error);
        return { hasProfile: false, rankingsCount: 0, matchesCount: 0 };
      } finally {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [isAuthenticated, user, loadFriendsData]
  );

  useEffect(() => {
    const listener = async (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail;
      if (!detail) return;

      if (detail.updatedProfile) {
        setProfile(detail.updatedProfile);
        setHasCompletedQuiz(true);
      }

      if (detail.topMatches) {
        setTopMatches(detail.topMatches);
      }

      if (user?.id) {
        await loadUserData({ skipFriends: true, skipLoadingState: true });
      }
    };

    window.addEventListener('personal-rankings:update', listener as EventListener);

    return () => {
      window.removeEventListener('personal-rankings:update', listener as EventListener);
    };
  }, [loadUserData, user]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserData();
    } else {
      setIsLoading(false);
      setIsFriendsLoading(false);
      setFriendsError(null);
      resetFriendsState();
      setIsProcessingQuiz(false);
      setQuizStatusMessage(null);
      setQuizError(null);
      setHasCompletedQuiz(false);
      setTopMatches([]);
      setRankings([]);
      setPartyMatches([]);
    }
  }, [isAuthenticated, user, loadUserData, resetFriendsState]);

  const pollForRankingData = useCallback(
    async () => {
      if (pollingRef.current) {
        return false;
      }
      pollingRef.current = true;
      try {
        const timeoutMs = 90000; // Increased to 90 seconds
        const intervalMs = 3000; // Increased to 3 seconds to reduce server load
        const deadline = Date.now() + timeoutMs;
        let lastStatusMessage = '';
        
        while (Date.now() < deadline) {
          const result = await loadUserData({ skipFriends: true, skipLoadingState: true });
          
          // Check if profile exists (quiz was saved)
          if (result.hasProfile) {
            // If we have rankings, we're done
            if (result.rankingsCount > 0) {
              setIsProcessingQuiz(false);
              setQuizStatusMessage(null);
              setQuizError(null);
              return true;
            }
            
            // Profile exists but no rankings yet - still processing
            const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
            if (elapsed > 30 && lastStatusMessage !== 'long') {
              setQuizStatusMessage('Rankings are still being calculated. This can take up to 90 seconds...');
              lastStatusMessage = 'long';
            } else if (elapsed > 10 && lastStatusMessage !== 'medium') {
              setQuizStatusMessage('Processing your matches... This usually takes 20-30 seconds.');
              lastStatusMessage = 'medium';
            }
          } else {
            // Profile doesn't exist yet - quiz might still be saving
            const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
            if (elapsed > 20) {
              setQuizStatusMessage('Saving your quiz results...');
            }
          }
          
          await sleep(intervalMs);
        }
        
        // Timeout reached - check one more time
        const finalResult = await loadUserData({ skipFriends: true, skipLoadingState: true });
        if (finalResult.hasProfile && finalResult.rankingsCount > 0) {
          setIsProcessingQuiz(false);
          setQuizStatusMessage(null);
          setQuizError(null);
          return true;
        }
        
        // Still no results after timeout
        setIsProcessingQuiz(false);
        setQuizStatusMessage('Rankings are taking longer than expected. You can refresh the page in a moment to check again.');
        setQuizError(null);
        return false;
      } catch (error: any) {
        console.error('Error polling for ranking data:', error);
        setIsProcessingQuiz(false);
        setQuizError('An error occurred while calculating your matches. Please try refreshing the page.');
        setQuizStatusMessage(null);
        return false;
      } finally {
        pollingRef.current = false;
      }
    },
    [loadUserData]
  );

  const submitQuizAnswers = useCallback(
    async (answers: any, options: { triggeredByEnhanced?: boolean } = {}) => {
      if (!user) {
        setQuizError('You must be logged in to save quiz answers.');
        return false;
      }
      
      setQuizError(null);
      setIsProcessingQuiz(true);
      setQuizStatusMessage(
        options.triggeredByEnhanced
          ? 'Applying your enhanced quiz results...'
          : 'Calculating your matches. This usually takes 20-30 seconds.'
      );
      
      try {
        const res = await fetch('/api/personal/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            answers
          })
        });
        
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          const errorMsg = data?.message || 'Failed to save quiz results.';
          console.error('Quiz submission failed:', errorMsg, data);
          throw new Error(errorMsg);
        }
        
        // Update state immediately with any matches we got
        setHasCompletedQuiz(true);
        if (data.topMatches && data.topMatches.length > 0) {
          setTopMatches(data.topMatches);
        }
        setPartyMatches([]);
        
        // If backend is processing asynchronously, poll for results
        if (data.processing) {
          setQuizStatusMessage('Calculating your personalized rankings... This usually takes 20-30 seconds.');
          const pollSuccess = await pollForRankingData();
          
          if (!pollSuccess) {
            // Polling timed out, but quiz was saved - reload data to show current state
            await loadUserData({ skipFriends: true, skipLoadingState: true });
            // Don't set isProcessingQuiz to false here - let the user see the current state
            setQuizStatusMessage('Rankings are still being calculated. You can refresh the page in a moment.');
          }
        } else {
          // Results are ready immediately
          await loadUserData({ skipFriends: true, skipLoadingState: true });
          setIsProcessingQuiz(false);
          setQuizStatusMessage(null);
        }
        
        return true;
      } catch (error: any) {
        console.error('Error submitting quiz:', error);
        const errorMessage = error?.message || 'Failed to save quiz results. Please try again.';
        setQuizError(errorMessage);
        setIsProcessingQuiz(false);
        setHasCompletedQuiz(false);
        
        // Show user-friendly error
        if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
          setQuizError('You must be logged in to save quiz results. Please log in and try again.');
        } else if (errorMessage.includes('400') || errorMessage.includes('Invalid')) {
          setQuizError('Invalid quiz data. Please retake the quiz.');
        } else {
          setQuizError('Failed to save quiz results. Please check your connection and try again.');
        }
        
        return false;
      }
    },
    [user, loadUserData, pollForRankingData]
  );

  // No auto-sync on page load - only sync when user explicitly retakes quiz
  // The quiz completion flow in EnhancedQuizPage will handle syncing results

  // Not logged in
  if (!isAuthenticated) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
          <Lock className="w-16 h-16 mx-auto mb-4 text-purple-600" />
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Find TDs Who Match Your Values
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
            Take a quick quiz to discover which TDs align with your political beliefs
          </p>
          <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600">
            Log In to Get Started
          </Button>
        </Card>
      </div>
    );
  }

  if (isProcessingQuiz) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
          <Loader2 className="w-12 h-12 mx-auto mb-4 text-purple-600 animate-spin" />
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            Calculating Your Matches
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            We're updating your personalised rankings. This typically takes less than a minute.
          </p>
          {quizStatusMessage && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {quizStatusMessage}
            </p>
          )}
          {quizError && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                {quizError}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsProcessingQuiz(false);
                  setQuizError(null);
                  setQuizStatusMessage(null);
                  await loadUserData();
                }}
                className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
              >
                Dismiss & Check Status
              </Button>
            </div>
          )}
          {topMatches.length > 0 && !quizError && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                Last known top matches
              </h2>
              <div className="grid gap-2">
                {topMatches.slice(0, 3).map((match, idx) => (
                  <div
                    key={`${match.name}-${idx}`}
                    className="flex items-center justify-between bg-white/60 dark:bg-gray-900/40 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-left"
                  >
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {match.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {match.party}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                      {match.compatibility}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!quizError && (
            <div className="mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsProcessingQuiz(false);
                  setQuizStatusMessage(null);
                  await loadUserData();
                }}
              >
                Skip & View Current Status
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // Require enhanced quiz completion before showing rankings
  if (!isProcessingQuiz && !hasCompletedQuiz && !isLoading) {
    return (
      <div className={shellClass}>
        <Card className={`${defaultCardClass} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Unlock Your Personal TD Rankings
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300">
              Complete the enhanced 8-dimension quiz to place yourself on the ideology map and see the TDs closest to your position.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg"
                onClick={() => navigate('/enhanced-quiz')}
              >
                Take the Enhanced Quiz
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate('/enhanced-results')}
              >
                View Quiz Results
              </Button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already took it? Head to results above or refresh after a moment—we sync your profile automatically once the quiz is saved.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your political profile...</p>
        </div>
      </div>
    );
  }

  const getIdeologyColor = (avgScore: number) => {
    if (avgScore >= 80) return 'text-blue-600 dark:text-blue-400';
    if (avgScore >= 60) return 'text-teal-600 dark:text-teal-400';
    if (avgScore >= 40) return 'text-gray-600 dark:text-gray-400';
    if (avgScore >= 20) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getDominantAxisDescription = (ideology: Record<string, number>) => {
    let dominant: { axis: string; value: number } | null = null;
    Object.entries(ideology).forEach(([axis, value]) => {
      const magnitude = Math.abs(Number(value));
      if (!dominant || magnitude > Math.abs(dominant.value)) {
        dominant = { axis, value: Number(value) };
      }
    });

    if (!dominant) return 'Balanced stance';
    const label = IDEOLOGY_AXIS_LABELS[dominant.axis] || dominant.axis;
    const leaning =
      dominant.value > 0 ? 'leans right / establishment' :
      dominant.value < 0 ? 'leans progressive / reformist' :
      'balanced';
    return `${label} • ${leaning}`;
  };

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-600" />
          My Political Profile
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Personalized TD rankings, insights, and friend comparisons based on your values and policy votes.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'personal' | 'friends')}
        className="mobile-stack"
      >
        <TabsList className="mobile-tab-row w-full max-w-md rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80">
          <TabsTrigger
            value="personal"
            className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-purple-300"
          >
            Personal rankings
          </TabsTrigger>
          <TabsTrigger
            value="friends"
            className="flex-1 rounded-lg data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-purple-300"
          >
            Friends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-0 mobile-stack">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 mobile-stack">
              {profile && (
                <Card className={`${defaultCardClass} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Your Ideology
                  </h2>
                  
                  <div className="mb-4">
                    <div className={`text-3xl font-bold mb-1 ${getIdeologyColor(profile.avgScore)}`}>
                      {profile.ideologyLabel}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Overall: {profile.avgScore}/100
                    </div>
                  </div>

                  {profile.ideology && (
                    <div className="space-y-2">
                      {Object.entries(profile.ideology).map(([key, value]) => {
                        const displayLabel = IDEOLOGY_AXIS_LABELS[key as keyof typeof IDEOLOGY_AXIS_LABELS] || key;
                        const normalized = Math.max(0, Math.min(100, ((value + 10) / 20) * 100));
                        return (
                          <div key={key} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300">
                              <span>{displayLabel}</span>
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {value.toFixed(1)}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-600 to-blue-600"
                                style={{ width: `${normalized}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 text-xs text-gray-600 dark:text-gray-400">
                    Engagement level: <span className="font-semibold text-gray-900 dark:text-white">{profile.engagement}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate('/enhanced-quiz')}
                  >
                    Retake Enhanced Quiz
                  </Button>
                </Card>
              )}

              <Card className={defaultCardClass}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Your Top 5 Matches
                </h2>
                
                <div className="space-y-3">
                  {topMatches.slice(0, 5).map((match, idx) => (
                    <Link key={idx} href={`/td/${encodeURIComponent(match.name)}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {match.name}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            {match.party}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {match.compatibility}%
                          </div>
                          <div className="text-xs text-gray-500">
                            #{match.rank}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>

              <Card className={defaultCardClass}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Party Alignment
                </h2>
                {partyMatches.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Vote on a few policy prompts to reveal which parties align closest to your stance.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {partyMatches.map((match) => (
                      <div
                        key={match.party}
                        className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">
                              {match.party}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {getDominantAxisDescription(match.ideology)}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-500 mt-1">
                              {formatConfidence(match.confidence)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                              {match.match}%
                            </div>
                            <div className="text-xs text-gray-500">alignment</div>
                          </div>
                        </div>
                        <div className="mt-2 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600"
                            style={{ width: `${match.match}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className={`${defaultCardClass} bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-2 border-emerald-200`}>
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                  <BarChart3 className="w-4 h-4 text-emerald-600" />
                  Profile Accuracy
                </h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">Policy Votes</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {rankings.reduce((sum, r) => sum + r.policiesCompared, 0) || 0}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    💡 Vote on more policies to improve match accuracy
                  </div>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 mobile-stack">
              {/* Ideology Time Series Chart - Enhanced Version */}
              {user && hasCompletedQuiz && (
                <IdeologyTimeSeriesChartEnhanced userId={user.id} initialWeeks={12} />
              )}

              <Card className={defaultCardClass}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Users className="w-6 h-6 text-purple-600" />
                    Your Personal Rankings
                  </h2>
                  <Badge variant="outline" className="text-xs">
                    {rankings.length} TDs
                  </Badge>
                </div>

                {rankings.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      No rankings yet. Complete the enhanced quiz to get started.
                    </p>
                    <Button onClick={() => navigate('/enhanced-quiz')}>
                      Take Enhanced Quiz
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      <div className="col-span-1">Your #</div>
                      <div className="col-span-4">TD</div>
                      <div className="col-span-2 text-center">Match</div>
                      <div className="col-span-2 text-center">Ideology</div>
                      <div className="col-span-2 text-center">Policy Votes</div>
                      <div className="col-span-1 text-center">Pub #</div>
                    </div>

                    {rankings.map((ranking) => {
                      const rankDiff = ranking.publicRank - ranking.personalRank;
                      const isHigherThanPublic = rankDiff > 0;
                      
                      return (
                        <Link key={ranking.name} href={`/td/${encodeURIComponent(ranking.name)}`}>
                          <div className="grid grid-cols-12 gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700">
                            <div className="col-span-1 flex items-center">
                              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                #{ranking.personalRank}
                              </div>
                            </div>

                            <div className="col-span-4 flex flex-col justify-center min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate">
                                {ranking.name}
                              </div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {ranking.party} • {ranking.constituency}
                              </div>
                            </div>

                            <div className="col-span-2 flex flex-col items-center justify-center">
                              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                                {ranking.compatibility}%
                              </div>
                              <div className="text-xs text-gray-500">match</div>
                            </div>

                            <div className="col-span-2 flex flex-col items-center justify-center">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {ranking.ideologyMatch}%
                              </div>
                              <div className="text-xs text-gray-500">values</div>
                            </div>

                            <div className="col-span-2 flex flex-col items-center justify-center">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {ranking.policyAgreement}%
                              </div>
                              <div className="text-xs text-gray-500">
                                {ranking.policiesCompared} votes
                              </div>
                            </div>

                            <div className="col-span-1 flex items-center justify-center">
                              {Math.abs(rankDiff) > 10 ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-gray-600 dark:text-gray-400">
                                    #{ranking.publicRank}
                                  </span>
                                  {isHigherThanPublic ? (
                                    <TrendingUp className="w-3 h-3 text-green-500" title="You rank them higher than public" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3 text-red-500" title="You rank them lower than public" />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  #{ranking.publicRank}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>

              {rankings.length > 0 && rankings[0].policiesCompared < 10 && (
                <Card className={`${defaultCardClass} bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                        Improve Your Match Accuracy
                      </h3>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        Your rankings are based on the quiz. Vote on policy articles to refine your matches!
                      </p>
                      <Link href="/">
                        <Button variant="outline" size="sm" className="gap-2">
                          Browse News Feed
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="friends" className="mt-0 mobile-stack">
          {friendsError && (
            <Card className="border border-red-200/70 bg-red-50/70 p-5 dark:border-red-900/40 dark:bg-red-900/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-red-700 dark:text-red-300">
                    We hit a snag loading your friend insights
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-200">
                    {friendsError}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFriendsRetry}
                  disabled={isFriendsLoading || !user}
                >
                  Try again
                </Button>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="mobile-stack">
              <Card className={`${defaultCardClass} bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-purple-100/60 dark:border-purple-800/40`}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                  <Users className="w-5 h-5 text-purple-600" />
                  Friend summary
                </h2>
                {isFriendsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : friendSummary && friendSummary.totalFriends > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/5 dark:bg-white/10">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                          Total friends
                          <UserPlus2 className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                          {friendSummary.totalFriends}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {friendSummary.activeThisWeek} active this week
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/5 dark:bg-white/10">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                          Avg compatibility
                          <Trophy className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                          {friendSummary.averageCompatibility !== null
                            ? `${friendSummary.averageCompatibility}%`
                            : '—'}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {friendSummary.sharedVotes} shared votes
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/5 dark:bg-white/10">
                      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Shared streaks
                        <Flame className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                        {friendSummary.sharedStreaks}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Keep voting daily to grow streaks together.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      Build your Glas circle to compare rankings, share votes, and keep streaks alive with friends.
                    </p>
                    <Link href="/daily-session">
                      <Button variant="secondary" size="sm" className="gap-2">
                        Start a daily session
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>

              <Card className={defaultCardClass}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  Invite friends
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Share your invite link so friends can join and compare rankings with you.
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleInviteShare}
                  disabled={isFriendsLoading}
                >
                  <Share2 className="w-4 h-4" />
                  {inviteCopied ? 'Invite link ready!' : 'Copy invite link'}
                </Button>
                {inviteCopied && (
                  <p className="mt-2 text-xs font-medium text-green-600 dark:text-green-400">
                    Link copied—share it with someone who cares about accountability.
                  </p>
                )}

                {pendingInvites.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Pending invites
                    </h4>
                    {pendingInvites.map((invite) => (
                      <div
                        key={invite.inviteId}
                        className="flex items-center justify-between rounded-md border border-dashed border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {invite.friendName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Sent {formatRelativeDate(invite.sentAt)}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">
                          {invite.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="lg:col-span-2 mobile-stack">
              <Card className={defaultCardClass}>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Users className="w-6 h-6 text-purple-600" />
                    Friend leaderboard
                  </h2>
                  {friendSummary && friendSummary.totalFriends > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {friendSummary.totalFriends} friends
                    </Badge>
                  )}
                </div>
                {isFriendsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : friendLeaderboard.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                    <p className="mb-2 font-semibold">No friend comparisons yet</p>
                    <p className="text-sm">
                      Invite friends or connect with Glas users to spark a friendly rivalry.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-12 gap-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <div className="col-span-4">Friend</div>
                      <div className="col-span-2 text-center">Friend match</div>
                      <div className="col-span-2 text-center">Diff vs you</div>
                      <div className="col-span-2 text-center">Shared votes</div>
                      <div className="col-span-2 text-center">Streak</div>
                    </div>
                    {friendLeaderboard.map((friend) => {
                      const diff = friend.compatibilityDelta ?? 0;
                      const diffLabel = diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff}%`;
                      const diffClass =
                        diff > 0
                          ? 'text-green-600 dark:text-green-400'
                          : diff < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400';

                      return (
                        <div
                          key={friend.friendId}
                          className="grid grid-cols-12 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
                        >
                          <div className="col-span-4">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {friend.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Last active {formatRelativeDate(friend.lastActive)}
                            </div>
                          </div>
                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {friend.compatibility}%
                            </div>
                            <div className="text-xs text-gray-500">match</div>
                          </div>
                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <div className={`text-sm font-semibold ${diffClass}`}>
                              {diffLabel}
                            </div>
                            <div className="text-xs text-gray-500">vs you</div>
                          </div>
                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {friend.sharedVotes}
                            </div>
                            <div className="text-xs text-gray-500">shared votes</div>
                          </div>
                          <div className="col-span-2 flex flex-col items-center justify-center">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {friend.streakDays} days
                            </div>
                            <div className="text-xs text-gray-500">shared streak</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className={defaultCardClass}>
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white mb-4">
                  <Flame className="w-6 h-6 text-orange-500" />
                  Shared streaks
                </h2>
                {isFriendsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : friendStreaks.length === 0 ? (
                  <div className="text-center py-10 text-gray-600 dark:text-gray-400">
                    <p className="font-semibold mb-2">No shared streaks yet</p>
                    <p className="text-sm">
                      Complete daily sessions alongside your friends to unlock streak boosts.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {friendStreaks.map((streak) => (
                      <div
                        key={streak.friendId}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/60"
                      >
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {streak.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Last shared {formatRelativeDate(streak.lastSharedAt)}
                          </div>
                          {streak.message && (
                            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                              {streak.message}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                          🔥 {streak.streakDays} days
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}






