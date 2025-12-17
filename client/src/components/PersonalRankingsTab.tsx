/**
 * Personal Rankings Tab Component
 * Shows personalized TD rankings with compatibility breakdown
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from 'wouter';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lock,
  AlertCircle,
  CheckCircle2,
  Heart,
  ChevronDown,
  Info
} from 'lucide-react';
import { PageHeader } from "@/components/PageHeader";

interface PersonalRanking {
  name: string;
  party: string;
  constituency: string;
  image_url?: string;
  personalRank: number;
  publicRank: number;
  compatibility: number;
  ideologyMatch: number;
  policyAgreement: number;
  policiesCompared: number;
  overallScore: number;
}

export function PersonalRankingsTab() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  const [rankings, setRankings] = useState<PersonalRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  const loadData = async () => {
    try {
      // Check if quiz completed
      const profileRes = await fetch(`/api/personal/profile/${user!.id}`);
      const profileData = await profileRes.json();
      
      setHasCompletedQuiz(profileData.hasCompletedQuiz);
      
      if (profileData.hasCompletedQuiz) {
        // Load rankings - get enough to show top and bottom
        const rankingsRes = await fetch(`/api/personal/rankings/${user!.id}?limit=200`);
        const rankingsData = await rankingsRes.json();
        setRankings(rankingsData.rankings || []);
      }
    } catch (error) {
      console.error('Error loading personal rankings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Not logged in
  if (!isAuthenticated) {
    return (
      <Card className="p-12 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200">
        <Lock className="w-16 h-16 mx-auto mb-4 text-purple-600" />
        <h2 className="text-2xl font-bold mb-3 text-gray-900 dark:text-white">
          Discover TDs Who Match Your Values
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-md mx-auto">
          Take a 2-minute quiz to get personalized TD rankings based on your political beliefs
        </p>
        <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600">
          Log In to Get Started
        </Button>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your rankings...</p>
        </div>
      </div>
    );
  }

  const renderRankingCard = (ranking: PersonalRanking, index: number, isBottom: boolean = false) => {
    // For bottom rankings, personalRank might be large, index is local
    return (
      <Link key={ranking.name} href={`/td/${encodeURIComponent(ranking.name)}`}>
        <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:border-purple-500/30 dark:hover:border-purple-500/30 transition-all cursor-pointer shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            {ranking.image_url ? (
              <img 
                src={ranking.image_url} 
                alt={ranking.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-gray-100 dark:border-gray-700 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 font-bold border-2 border-gray-200 dark:border-gray-600 flex-shrink-0">
                {ranking.name.charAt(0)}
              </div>
            )}

            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white leading-tight truncate">
                {ranking.name}
              </h3>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {ranking.party}
              </p>
            </div>
          </div>

          <div className="text-right pl-2 flex-shrink-0">
            <div className={`text-xl font-bold ${isBottom ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} leading-none`}>
              {ranking.compatibility}%
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mt-1">Match</div>
          </div>
        </div>
      </Link>
    );
  };

  const topRankings = rankings.slice(0, visibleCount);
  const bottomRankings = rankings.length > 5 ? rankings.slice(-5).reverse() : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your Rankings"
        tooltipTitle="Improve Your Match Accuracy"
        bullets={[
          "Your rankings are currently based on the quiz.",
          "Vote on policy articles in the news feed to refine your matches!",
          "Each vote updates your compatibility with all TDs who took a stance."
        ]}
      />

      {!hasCompletedQuiz ? (
        <Card className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 border-dashed">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
            Personalized rankings aren’t available yet.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Vote on policy opportunities in the news feed to build your profile and unlock rankings.
          </p>
        </Card>
      ) : rankings.length === 0 ? (
        <Card className="p-8 text-center bg-gray-50 dark:bg-gray-800/50 border-dashed">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-600 dark:text-gray-400">
            No rankings available yet.
          </p>
        </Card>
      ) : (
        <>
          {/* Top Matches Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Top Matches
              </h3>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                Highest Compatibility
              </Badge>
            </div>
            
            <div className="space-y-3">
              {topRankings.map((ranking, i) => renderRankingCard(ranking, i, false))}
            </div>

            {visibleCount < (rankings.length - 5) && (
              <Button
                variant="outline"
                className="w-full rounded-xl border-dashed py-6 text-gray-500 hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => setVisibleCount(prev => prev + 5)}
              >
                <ChevronDown className="w-4 h-4 mr-2" />
                Load more matches
              </Button>
            )}
          </section>

          {/* Least Compatible Section */}
          {bottomRankings.length > 0 && (
            <section className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Least Compatible
                </h3>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
                  Lowest Compatibility
                </Badge>
              </div>
              
              <div className="space-y-3">
                {bottomRankings.map((ranking, i) => renderRankingCard(ranking, i, true))}
              </div>
            </section>
          )}
        </>
      )}

    </div>
  );
}
