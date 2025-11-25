/**
 * Personal Rankings Tab Component
 * Shows personalized TD rankings with compatibility breakdown
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lock,
  AlertCircle,
  CheckCircle2,
  Heart
} from 'lucide-react';
import { PoliticalQuiz } from './PoliticalQuiz';

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
  const [showQuiz, setShowQuiz] = useState(false);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);
  const [rankings, setRankings] = useState<PersonalRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
        // Load rankings
        const rankingsRes = await fetch(`/api/personal/rankings/${user!.id}?limit=20`);
        const rankingsData = await rankingsRes.json();
        setRankings(rankingsData.rankings || []);
      }
    } catch (error) {
      console.error('Error loading personal rankings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizComplete = async (answers: any) => {
    try {
      const res = await fetch('/api/personal/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user!.id,
          answers
        })
      });
      
      if (res.ok) {
        setShowQuiz(false);
        await loadData();
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
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

  // Show quiz
  if (showQuiz || (!hasCompletedQuiz && !isLoading)) {
    return (
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Find Your Political Matches
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Answer 8 questions to discover which TDs align with your values
          </p>
        </div>
        <PoliticalQuiz 
          onComplete={handleQuizComplete}
          onSkip={hasCompletedQuiz ? () => setShowQuiz(false) : undefined}
        />
      </div>
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

  return (
    <div className="space-y-6">
      {/* Header with Retake Option */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-6 h-6 text-purple-600 fill-purple-600" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Your Personalized Rankings
          </h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQuiz(true)}
        >
          Retake Quiz
        </Button>
      </div>


      {/* Rankings Table */}
      <Card className="overflow-hidden">
        {/* Table Header */}
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-12 gap-3 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">TD</div>
            <div className="col-span-2 text-center">Match %</div>
            <div className="col-span-2 text-center">Ideology</div>
            <div className="col-span-2 text-center">Policy Votes</div>
            <div className="col-span-1 text-center">vs Public</div>
          </div>
        </div>

        {/* Rankings List */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {rankings.map((ranking) => {
            const rankDiff = ranking.publicRank - ranking.personalRank;
            const isHigherThanPublic = rankDiff > 0;
            const isSignificantDiff = Math.abs(rankDiff) > 10;
            
            return (
              <Link key={ranking.name} href={`/td/${encodeURIComponent(ranking.name)}`}>
                <div className="grid grid-cols-12 gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer">
                  {/* Rank */}
                  <div className="col-span-1 flex items-center">
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      #{ranking.personalRank}
                    </div>
                  </div>

                  {/* TD Info */}
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    {ranking.image_url ? (
                      <img 
                        src={ranking.image_url} 
                        alt={ranking.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold border-2 border-purple-200 flex-shrink-0">
                        {ranking.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">
                        {ranking.name}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {ranking.party} • {ranking.constituency}
                      </div>
                    </div>
                  </div>

                  {/* Overall Match */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {ranking.compatibility}%
                    </div>
                    <div className="text-xs text-gray-500">total match</div>
                  </div>

                  {/* Ideology Match */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {ranking.ideologyMatch}%
                    </div>
                    <div className="text-xs text-gray-500">values</div>
                  </div>

                  {/* Policy Agreement */}
                  <div className="col-span-2 flex flex-col items-center justify-center">
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {ranking.policyAgreement}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {ranking.policiesCompared} policies
                    </div>
                  </div>

                  {/* Public Rank Comparison */}
                  <div className="col-span-1 flex items-center justify-center">
                    {isSignificantDiff ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          #{ranking.publicRank}
                        </span>
                        {isHigherThanPublic ? (
                          <TrendingUp className="w-4 h-4 text-green-500" title="You rank them higher than public" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-500" title="You rank them lower than public" />
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">
                        #{ranking.publicRank}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Engagement Prompt */}
      {rankings.length > 0 && rankings[0].policiesCompared < 10 && (
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">
                Improve Your Match Accuracy
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Your rankings are currently based on the quiz. Vote on policy articles in the news feed to refine your matches!
              </p>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                💡 Each vote updates your compatibility with all TDs who took a stance on that policy
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}


