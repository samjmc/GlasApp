/**
 * Welcome Banner - Shows on homepage for new users
 * Highlights key features and CTA for quiz
 */

import { useState, useEffect } from 'react';
import { X, Sparkles, Heart, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export function WelcomeBanner() {
  const { user, isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [hasCompletedQuiz, setHasCompletedQuiz] = useState(false);

  useEffect(() => {
    const checkWelcomeBanner = async () => {
      if (!isAuthenticated || !user) return;

      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const hasSeenOnboarding = supabaseUser?.user_metadata?.has_seen_onboarding;
      const hasDismissedBanner = localStorage.getItem('welcomeBannerDismissed');

      // Check if user has completed quiz
      const { data: quizResults } = await supabase
        .from('user_quiz_results')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      setHasCompletedQuiz(quizResults && quizResults.length > 0);

      // Show banner if onboarding seen but quiz not completed
      if (hasSeenOnboarding && !hasDismissedBanner && !(quizResults && quizResults.length > 0)) {
        setIsVisible(true);
      }
    };

    checkWelcomeBanner();
  }, [isAuthenticated, user]);

  const handleDismiss = () => {
    localStorage.setItem('welcomeBannerDismissed', 'true');
    setIsVisible(false);
  };

  const handleTakeQuiz = () => {
    window.location.href = '/enhanced-quiz';
  };

  if (!isVisible || hasCompletedQuiz) return null;

  return (
    <Card className="mb-6 p-6 bg-gradient-to-r from-purple-50 via-pink-50 to-blue-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-800 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/30 dark:bg-purple-800/20 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-200/30 dark:bg-blue-800/20 rounded-full blur-3xl -z-10"></div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>

      <div className="flex items-start gap-6">
        {/* Icon */}
        <div className="hidden md:flex items-center justify-center p-4 bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-800 dark:to-blue-800 rounded-2xl">
          <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-300" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            👋 Welcome to Glas Politics!
          </h3>
          <p className="text-gray-700 dark:text-gray-300 mb-4 text-lg">
            You're all set! Now take our 2-minute quiz to get personalized TD rankings based on YOUR political values.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
              <Heart className="w-5 h-5 text-pink-500 mt-1 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm mb-1">Personal Matches</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">See which TDs align with your values</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-500 mt-1 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm mb-1">Policy Breakdown</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Compare on 8 key policy areas</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
              <Sparkles className="w-5 h-5 text-purple-500 mt-1 flex-shrink-0" />
              <div>
                <div className="font-semibold text-sm mb-1">Updated Daily</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Rankings evolve with real news</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleTakeQuiz}
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              <Heart className="w-5 h-5 mr-2" />
              Take the Quiz
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Just 2 minutes • Your results are private
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}






















