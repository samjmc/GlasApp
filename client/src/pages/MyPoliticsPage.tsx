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
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  Loader2,
  Activity,
  Info
} from 'lucide-react';
import { Link } from 'wouter';
import IdeologyTimeSeriesChartEnhanced from '@/components/IdeologyTimeSeriesChartEnhanced';
import { PageHeader } from "@/components/PageHeader";

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
  const [visibleRankingsCount, setVisibleRankingsCount] = useState(5);
  const [isLoading, setIsLoading] = useState(true);
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [partyMatches, setPartyMatches] = useState<PartyMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings' | 'network'>('overview');
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
        const timeoutMs = 90000;
        const intervalMs = 3000;
        const deadline = Date.now() + timeoutMs;
        let lastStatusMessage = '';
        
        while (Date.now() < deadline) {
          const result = await loadUserData({ skipFriends: true, skipLoadingState: true });
          
          if (result.hasProfile) {
            if (result.rankingsCount > 0) {
              setIsProcessingQuiz(false);
              setQuizStatusMessage(null);
              setQuizError(null);
              return true;
            }
            
            const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
            if (elapsed > 30 && lastStatusMessage !== 'long') {
              setQuizStatusMessage('Rankings are still being calculated. This can take up to 90 seconds...');
              lastStatusMessage = 'long';
            } else if (elapsed > 10 && lastStatusMessage !== 'medium') {
              setQuizStatusMessage('Processing your matches... This usually takes 20-30 seconds.');
              lastStatusMessage = 'medium';
            }
          } else {
            const elapsed = Math.floor((Date.now() - (deadline - timeoutMs)) / 1000);
            if (elapsed > 20) {
              setQuizStatusMessage('Saving your quiz results...');
            }
          }
          
          await sleep(intervalMs);
        }
        
        const finalResult = await loadUserData({ skipFriends: true, skipLoadingState: true });
        if (finalResult.hasProfile && finalResult.rankingsCount > 0) {
          setIsProcessingQuiz(false);
          setQuizStatusMessage(null);
          setQuizError(null);
          return true;
        }
        
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

  // ---------------- RENDERING ----------------

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
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 w-full sm:w-auto">
                Sign In to Get Started
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="border-purple-300 w-full sm:w-auto">
                Create Account
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
            <Link href="/" className="hover:text-purple-600">← Continue browsing as guest</Link>
          </p>
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
        </Card>
      </div>
    );
  }

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
            </div>
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

  return (
    <div className={shellClass}>
      <div className="mb-6">
        <PageHeader
          className="mb-2"
          title="My politics"
          tooltipTitle="What this page does for you"
          bullets={[
            "Shows the TDs closest to your views (quiz + daily votes).",
            "Breaks down why: ideology match vs policy agreement.",
            "Lets you compare with friends and track changes over time."
          ]}
        />

        <nav
          className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/60"
          aria-label="Tabs"
        >
          {(['overview', 'rankings', 'network'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const labels = {
              overview: 'Overview',
              rankings: 'My Rankings',
              network: 'Network'
            };

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={[
                  "h-11 w-full rounded-xl px-2 text-xs font-semibold tracking-wide transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
                  isActive
                    ? "bg-purple-600 text-white shadow"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="block truncate">{labels[tab]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          {/* Ideology Snapshot */}
          {profile && (
            <Card className={`${defaultCardClass} bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  Your Ideology
                </h2>
                <Badge variant="outline" className="bg-white/50 dark:bg-black/20">
                  Score: {profile.avgScore}/100
                </Badge>
              </div>
              
              <div className="mb-4">
                <div className={`text-3xl font-bold mb-1 ${getIdeologyColor(profile.avgScore)}`}>
                  {profile.ideologyLabel}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Engagement level: <span className="font-semibold text-gray-900 dark:text-white">{profile.engagement}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {profile.ideology && Object.entries(profile.ideology).slice(0, 4).map(([key, value]) => {
                  const normalized = Math.max(0, Math.min(100, ((value + 10) / 20) * 100));
                  return (
                    <div key={key} className="text-xs">
                      <div className="flex justify-between mb-1 text-gray-600 dark:text-gray-400 capitalize">
                        <span>{key}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500"
                          style={{ width: `${normalized}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-purple-200 hover:bg-purple-100 text-purple-700 dark:border-purple-800 dark:hover:bg-purple-900/30 dark:text-purple-300"
                onClick={() => setActiveTab('rankings')}
              >
                View Full Analysis
              </Button>
            </Card>
          )}

          {/* Top Matches Snapshot */}
          <Card className={defaultCardClass}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Top Matches
            </h2>
            
            <div className="space-y-3">
              {topMatches.slice(0, 3).map((match, idx) => (
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
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        {match.compatibility}%
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-gray-500"
              onClick={() => setActiveTab('rankings')}
            >
              See all rankings <ArrowRight className="ml-1 w-4 h-4" />
            </Button>
          </Card>

          {/* Friend Activity Snapshot */}
          <Card className={defaultCardClass}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Friends Activity
            </h2>
            {friendSummary && friendSummary.totalFriends > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{friendSummary.activeThisWeek}</div>
                    <div className="text-xs text-blue-600/80 dark:text-blue-400/80">Active this week</div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                    <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{friendSummary.sharedStreaks}</div>
                    <div className="text-xs text-orange-600/80 dark:text-orange-400/80">Shared streaks</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setActiveTab('network')}
                >
                  Go to Network
                </Button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">Compare your rankings with friends.</p>
                <Button size="sm" onClick={() => setActiveTab('network')}>Invite Friends</Button>
              </div>
            )}
          </Card>

          {/* Quick Actions */}
          <Card className={`${defaultCardClass} bg-gray-50 dark:bg-gray-800/30 border-dashed`}>
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => setActiveTab('network')}
              >
                <UserPlus2 className="w-5 h-5 text-blue-600" />
                <span className="text-xs">Invite Friend</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'rankings' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Ideology Time Series Chart */}
          {user && hasCompletedQuiz && (
            <IdeologyTimeSeriesChartEnhanced userId={user.id} initialWeeks={12} />
          )}

          {/* Full Personal Rankings */}
          <Card className={defaultCardClass}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                  <Users className="w-6 h-6 text-purple-600" />
                  Complete Rankings
                </h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                      <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs p-4 bg-slate-900 border-slate-800 text-white">
                    <div className="flex flex-col gap-2">
                      <p className="font-semibold text-emerald-400">Improve Your Match Accuracy</p>
                      <p className="text-xs text-gray-300">
                        Your rankings are currently based on the quiz. Vote on policy articles in the news feed to refine your matches!
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1.5 bg-white/10 p-2 rounded-lg mt-1">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        Each vote updates your compatibility with all TDs who took a stance.
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Badge variant="outline" className="text-xs">
                {rankings.length} TDs
              </Badge>
            </div>

            {rankings.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  No rankings yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {rankings.slice(0, visibleRankingsCount).map((ranking) => {
                  const rankDiff = ranking.publicRank - ranking.personalRank;
                  const isHigherThanPublic = rankDiff > 0;
                  
                  return (
                    <Link key={ranking.name} href={`/td/${encodeURIComponent(ranking.name)}`}>
                      <div className="p-4 border rounded-xl bg-white dark:bg-gray-800/50 hover:border-purple-500/30 transition-colors cursor-pointer dark:border-gray-700">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-3">
                            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold text-sm">
                              #{ranking.personalRank}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 dark:text-white leading-tight">
                                {ranking.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {ranking.party} • {ranking.constituency}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 leading-none">
                              {ranking.compatibility}%
                            </div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">Match</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-0.5">Ideology</div>
                            <div className="font-medium text-gray-900 dark:text-gray-200">{ranking.ideologyMatch}%</div>
                          </div>
                          <div className="text-center border-l border-gray-100 dark:border-gray-700/50">
                            <div className="text-xs text-gray-500 mb-0.5">Policy</div>
                            <div className="font-medium text-gray-900 dark:text-gray-200">{ranking.policyAgreement}%</div>
                          </div>
                          <div className="text-center border-l border-gray-100 dark:border-gray-700/50">
                            <div className="text-xs text-gray-500 mb-0.5">Public</div>
                            <div className="font-medium text-gray-900 dark:text-gray-200 flex items-center justify-center gap-1">
                              #{ranking.publicRank}
                              {Math.abs(rankDiff) > 10 && (
                                isHigherThanPublic 
                                  ? <TrendingUp className="w-3 h-3 text-green-500" />
                                  : <TrendingDown className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                
                {visibleRankingsCount < rankings.length && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4"
                    onClick={() => setVisibleRankingsCount((prev) => prev + 10)}
                  >
                    Load more
                  </Button>
                )}
              </div>
            )}
          </Card>

          {/* Party Alignment */}
          <Card className={defaultCardClass}>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Party Alignment
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partyMatches.map((match) => (
                <div
                  key={match.party}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{match.party}</div>
                      <div className="text-xs text-gray-500">{formatConfidence(match.confidence)}</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {match.match}%
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${match.match}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'network' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 mobile-stack">
              <Card className={`${defaultCardClass} bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20`}>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-purple-600" />
                  Invite Friends
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Share your link to compare rankings and see who you align with.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={handleInviteShare}
                  disabled={isFriendsLoading}
                >
                  <Share2 className="w-4 h-4" />
                  {inviteCopied ? 'Link Copied!' : 'Copy Invite Link'}
                </Button>
              </Card>

              {pendingInvites.length > 0 && (
                <Card className={defaultCardClass}>
                  <h3 className="font-semibold mb-3">Pending Invites</h3>
                  <div className="space-y-2">
                    {pendingInvites.map((invite) => (
                      <div key={invite.inviteId} className="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span>{invite.friendName}</span>
                        <Badge variant="outline">{invite.status}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>

            <div className="lg:col-span-2 mobile-stack">
              <Card className={defaultCardClass}>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-500" />
                  Friend Leaderboard
                </h2>
                
                {friendLeaderboard.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No friends connected yet. Invite them to get started!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {friendLeaderboard.map((friend) => (
                      <div
                        key={friend.friendId}
                        className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold">
                            {friend.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white">{friend.name}</div>
                            <div className="text-xs text-gray-500">
                              {friend.sharedVotes} shared votes • {friend.streakDays} day streak
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {friend.compatibility}%
                          </div>
                          <div className="text-xs text-gray-500">match</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}