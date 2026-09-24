import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS } from '@shared/ideology';
import type { QuizResult } from '@shared/quiz';
import MultidimensionalIdeologyProfile from '@/components/MultidimensionalIdeologyProfile';
import EnhancedProfileExplanation from '@/components/EnhancedProfileExplanation';
import ContextAnalysis from '@/components/ContextAnalysis';
import PoliticalOpinionChangeTracker from '@/components/PoliticalOpinionChangeTracker';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyQuizResults, submitQuiz, type DimensionWeights } from '@/lib/ideologyApi';
import { DIMENSION_STYLE } from '@/lib/ideologyDisplay';
import { queryKeys } from '@/lib/queryKeys';
import { clearStoredQuiz, loadStoredQuiz, loadWeights, storeQuiz } from '@/lib/quizStorage';

// One save per page load, even under StrictMode's double effects.
let savingAnswers: Promise<QuizResult> | null = null;

/**
 * Quiz results. The result comes from sessionStorage (the quiz page stores what
 * POST /api/quiz returned) or, when signed in, from the newest saved result.
 * An anonymous result is saved once the user signs in.
 */
const QuizResultsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const [stored, setStored] = useState(loadStoredQuiz);
  const [weights, setWeights] = useState<DimensionWeights>(loadWeights);
  const saveAttemptedRef = useRef(false);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.quiz.mine(user?.id),
    queryFn: fetchMyQuizResults,
    enabled: isAuthenticated,
  });

  // Save-after-sign-in: answers scored anonymously are posted once, then replaced by the saved result.
  useEffect(() => {
    if (!isAuthenticated || !stored || stored.result.id !== null || stored.answers.length === 0) return;
    if (saveAttemptedRef.current) return;
    saveAttemptedRef.current = true;

    savingAnswers ??= submitQuiz(stored.answers);
    savingAnswers
      .then(async (saved) => {
        storeQuiz(saved, stored.answers);
        setStored({ result: saved, answers: stored.answers });
        await queryClient.invalidateQueries({ queryKey: ["/api/quiz/me"] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.ideology.all() });
        toast({ title: "Results Saved", description: "Your quiz result has been saved to your profile." });
      })
      .catch((error) => {
        console.error("Error saving quiz result:", error);
        toast({ title: "Save Failed", description: "We couldn't save your result to your profile.", variant: "destructive" });
      })
      .finally(() => {
        savingAnswers = null;
      });
  }, [isAuthenticated, stored, queryClient, toast]);

  const result: QuizResult | null = stored?.result ?? history?.[0] ?? null;

  // Redirect to quiz if there is no result anywhere
  useEffect(() => {
    if (!result && !(isAuthenticated && historyLoading)) {
      setLocation('/quiz');
    }
  }, [result, isAuthenticated, historyLoading, setLocation]);

  // Handle download as image
  const handleDownloadImage = async () => {
    try {
      const profileElement = document.querySelector('[data-profile-card="true"]');
      if (!profileElement) {
        toast({ title: "Error", description: "Could not find profile content.", variant: "destructive" });
        return;
      }

      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;

      toast({ title: "Capturing...", description: "Creating your image." });

      const canvas = await html2canvas(profileElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `glas-politics-profile-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({ title: "Downloaded!", description: "Profile saved as image." });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({ title: "Download Failed", description: "Unable to create image.", variant: "destructive" });
    }
  };

  const handleRestartQuiz = () => {
    clearStoredQuiz();
    setLocation('/quiz');
  };

  if (!result) {
    return <LoadingScreen message="Loading your political profile..." />;
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      <div className="space-y-6">
        {/* Main Profile Card */}
        <div data-profile-card="true">
          <MultidimensionalIdeologyProfile
            dimensions={result.vector}
            ideology={result.ideology}
            description={result.description}
          />
        </div>

        {/* Enhanced Analysis */}
        <EnhancedProfileExplanation
          dimensions={result.vector}
          weights={weights}
          onWeightsChange={setWeights}
        />

        {/* Context Analysis */}
        <div className="w-full">
          <ContextAnalysis dimensions={result.vector} />
        </div>

        {/* Save / export card */}
        <Card className="border-blue-200 dark:border-blue-800 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <span>💾</span> Your Profile
            </CardTitle>
            <CardDescription className="text-xs">
              {result.id !== null
                ? "This result is saved to your profile."
                : isAuthenticated
                  ? "Saving this result to your profile..."
                  : "Sign in to save this result and track how your views change."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {!isAuthenticated && (
              <Button
                onClick={() => setLocation('/login')}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-sm"
                size="sm"
              >
                💾 Sign in to save
              </Button>
            )}

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full text-sm"
                size="sm"
                onClick={handleDownloadImage}
              >
                📥 Download
              </Button>

              <Button
                onClick={handleRestartQuiz}
                variant="outline"
                className="w-full border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm"
                size="sm"
              >
                🔄 Start Over (Retake Quiz)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Opinion Tracker (signed in, two or more saved results) */}
        <PoliticalOpinionChangeTracker />

        {/* Dimensions Explained Card */}
        <Card className="border-purple-200 dark:border-purple-800 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <span>📊</span> Dimensions Explained
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-700 dark:text-gray-300 pt-5">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {IDEOLOGY_DIMENSIONS.map((d) => (
                <li key={d}>
                  <strong>{DIMENSION_STYLE[d].icon} {DIMENSION_POLES[d].label}:</strong>{' '}
                  {DIMENSION_POLES[d].negative} (-10) to {DIMENSION_POLES[d].positive} (+10)
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuizResultsPage;
