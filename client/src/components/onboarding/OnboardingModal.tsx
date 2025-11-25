/**
 * Onboarding Modal - First-time user walkthrough
 * Beautiful, engaging, step-by-step introduction to Glas Politics
 */

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Sparkles, TrendingUp, Users, Map, Heart, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  image?: string;
  cta?: {
    text: string;
    action: () => void;
  };
}

export function OnboardingModal() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding
    const checkOnboarding = async () => {
      if (!isAuthenticated || !user) return;

      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      const hasSeenOnboarding = supabaseUser?.user_metadata?.has_seen_onboarding;

      // Show onboarding if user hasn't seen it
      if (!hasSeenOnboarding) {
        // Small delay for smooth animation
        setTimeout(() => setIsOpen(true), 500);
      }
    };

    checkOnboarding();
  }, [isAuthenticated, user]);

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Glas Politics! 🇮🇪',
      description: 'Ireland\'s first AI-powered political accountability platform. We track what politicians say, what they do, and whether they deliver on their promises.',
      icon: <Sparkles className="w-12 h-12 text-emerald-500" />,
    },
    {
      id: 'news-feed',
      title: 'AI-Analyzed News Feed',
      description: 'Every day, we scan 11+ Irish news sources, including Gript and The Ditch. Our AI analyzes each article for TD impact, breaking down transparency, effectiveness, integrity, and consistency scores.',
      icon: <TrendingUp className="w-12 h-12 text-blue-500" />,
    },
    {
      id: 'rankings',
      title: 'Real-Time TD Rankings',
      description: 'See how all 174 TDs rank based on news impact, parliamentary activity, and consistency. Updated automatically as new stories break.',
      icon: <Users className="w-12 h-12 text-purple-500" />,
    },
    {
      id: 'personal-rankings',
      title: 'Your Personal Rankings',
      description: 'Take our political quiz to see which TDs and parties match YOUR values. We compare your political stance with each TD\'s voting record and policy positions.',
      icon: <Heart className="w-12 h-12 text-pink-500" />,
      cta: {
        text: 'Take Quiz Now',
        action: () => {
          window.location.href = '/enhanced-quiz';
        }
      }
    },
    {
      id: 'map',
      title: 'Interactive Constituency Map',
      description: 'Explore all 43 Irish constituencies. Click any area to see your local TDs, party breakdown, and performance metrics.',
      icon: <Map className="w-12 h-12 text-teal-500" />,
    },
    {
      id: 'community',
      title: 'Join the Community',
      description: 'Submit policy ideas, vote on what matters to you, and discuss with other politically engaged Irish citizens. Your voice shapes our democracy.',
      icon: <MessageSquare className="w-12 h-12 text-orange-500" />,
    },
  ];

  const handleClose = async (completed: boolean = false) => {
    setIsClosing(true);
    
    // Mark onboarding as seen
    if (isAuthenticated) {
      await supabase.auth.updateUser({
        data: {
          has_seen_onboarding: true,
          onboarding_completed_at: completed ? new Date().toISOString() : null,
        }
      });
    }

    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose(true);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose(false);
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      <Card 
        className={`relative w-full max-w-2xl mx-4 p-8 bg-white dark:bg-gray-900 shadow-2xl transition-all duration-300 ${
          isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close onboarding"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {Math.round(progress)}% Complete
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl">
            {currentStepData.icon}
          </div>
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            {currentStepData.title}
          </h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        {/* CTA if present */}
        {currentStepData.cta && (
          <div className="mb-6 flex justify-center">
            <Button
              onClick={currentStepData.cta.action}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3 text-lg"
            >
              {currentStepData.cta.text} →
            </Button>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex gap-2">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentStep(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-emerald-500'
                    : index < currentStep
                    ? 'bg-emerald-300'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
                aria-label={`Go to step ${index + 1}`}
              />
            ))}
          </div>

          <Button
            onClick={handleNext}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          >
            {currentStep === steps.length - 1 ? (
              <>
                <Check className="w-4 h-4" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>

        {/* Skip Link */}
        <div className="mt-4 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            Skip tour
          </button>
        </div>
      </Card>
    </div>
  );
}






















