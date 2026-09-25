/**
 * Welcome banner: after onboarding, nudges signed-in users who have not taken the quiz.
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, Compass, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchMyQuizResults } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';

const DISMISS_KEY = 'welcomeBannerDismissed';

function isDismissed(): boolean {
  try {
    return !!window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return false;
  }
}

/** Dismissible welcome banner shown to authenticated users. */
export function WelcomeBanner() {
  const { user, isAuthenticated } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  const { data: quizResults, isSuccess: quizResultsLoaded } = useQuery({
    queryKey: queryKeys.quiz.mine(user?.id),
    queryFn: () => fetchMyQuizResults(),
    enabled: isAuthenticated && !!user,
  });
  const hasCompletedQuiz = (quizResults?.length ?? 0) > 0;

  useEffect(() => {
    if (!isAuthenticated || !user || !quizResultsLoaded) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data: { user: supabaseUser } }) => {
      const hasSeenOnboarding = supabaseUser?.user_metadata?.has_seen_onboarding;
      if (!cancelled && hasSeenOnboarding && !isDismissed() && !hasCompletedQuiz) setIsVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user, quizResultsLoaded, hasCompletedQuiz]);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Storage blocked: hide for this visit only.
    }
    setIsVisible(false);
  };

  if (!isVisible || hasCompletedQuiz) return null;

  return (
    <aside className="relative flex flex-col gap-4 rounded-2xl bg-primary p-5 text-primary-foreground sm:flex-row sm:items-center md:p-6">
      <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10 sm:flex">
        <Compass className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pr-8 sm:pr-0">
        <h2 className="font-display text-xl font-bold leading-tight">Find your matches</h2>
        <p className="text-sm">Take the 2-minute quiz to see which TDs and parties share your views. Your answers are private.</p>
      </div>
      <Button asChild variant="inverse" size="lg" className="shrink-0">
        <Link href="/quiz">
          Take the quiz
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/10"
      >
        <X className="h-4 w-4" />
      </button>
    </aside>
  );
}
