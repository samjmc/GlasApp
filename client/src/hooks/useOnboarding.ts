/**
 * useOnboarding Hook
 * Manages onboarding state and provides helper methods
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  onboardingCompletedAt: string | null;
  hasSeenTour: boolean;
  hasDismissedBanner: boolean;
  hasCompletedQuiz: boolean;
  isLoading: boolean;
}

interface OnboardingActions {
  markOnboardingComplete: () => Promise<void>;
  markTourComplete: () => void;
  dismissBanner: () => void;
  resetOnboarding: () => Promise<void>;
}

export function useOnboarding(): OnboardingState & OnboardingActions {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    hasSeenOnboarding: false,
    onboardingCompletedAt: null,
    hasSeenTour: false,
    hasDismissedBanner: false,
    hasCompletedQuiz: false,
    isLoading: true,
  });

  useEffect(() => {
    loadOnboardingState();
  }, [isAuthenticated, user]);

  const loadOnboardingState = async () => {
    if (!isAuthenticated || !user) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      // Get onboarding status from user metadata
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const hasSeenOnboarding = supabaseUser?.user_metadata?.has_seen_onboarding || false;
      const onboardingCompletedAt = supabaseUser?.user_metadata?.onboarding_completed_at || null;

      // Get tour status from localStorage
      const hasSeenTour = localStorage.getItem('hasSeenInterfaceTour') === 'true';
      const hasDismissedBanner = localStorage.getItem('welcomeBannerDismissed') === 'true';

      // Check quiz completion
      const { data: quizResults } = await supabase
        .from('user_quiz_results')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      const hasCompletedQuiz = quizResults && quizResults.length > 0;

      setState({
        hasSeenOnboarding,
        onboardingCompletedAt,
        hasSeenTour,
        hasDismissedBanner,
        hasCompletedQuiz,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error loading onboarding state:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const markOnboardingComplete = async () => {
    try {
      await supabase.auth.updateUser({
        data: {
          has_seen_onboarding: true,
          onboarding_completed_at: new Date().toISOString(),
        }
      });
      
      setState(prev => ({
        ...prev,
        hasSeenOnboarding: true,
        onboardingCompletedAt: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
    }
  };

  const markTourComplete = () => {
    localStorage.setItem('hasSeenInterfaceTour', 'true');
    setState(prev => ({ ...prev, hasSeenTour: true }));
  };

  const dismissBanner = () => {
    localStorage.setItem('welcomeBannerDismissed', 'true');
    setState(prev => ({ ...prev, hasDismissedBanner: true }));
  };

  const resetOnboarding = async () => {
    try {
      // Reset user metadata
      await supabase.auth.updateUser({
        data: {
          has_seen_onboarding: false,
          onboarding_completed_at: null,
        }
      });

      // Reset localStorage
      localStorage.removeItem('hasSeenInterfaceTour');
      localStorage.removeItem('welcomeBannerDismissed');

      // Reset state
      setState(prev => ({
        ...prev,
        hasSeenOnboarding: false,
        onboardingCompletedAt: null,
        hasSeenTour: false,
        hasDismissedBanner: false,
      }));
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  return {
    ...state,
    markOnboardingComplete,
    markTourComplete,
    dismissBanner,
    resetOnboarding,
  };
}






















