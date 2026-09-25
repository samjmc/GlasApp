import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RotateCcw, Share2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { QuizResult } from '@shared/quiz';
import MultidimensionalIdeologyProfile from '@/components/MultidimensionalIdeologyProfile';
import EnhancedProfileExplanation from '@/components/EnhancedProfileExplanation';
import ContextAnalysis from '@/components/ContextAnalysis';
import PoliticalOpinionChangeTracker from '@/components/PoliticalOpinionChangeTracker';
import LoadingScreen from '@/components/LoadingScreen';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyQuizResults, submitQuiz, type DimensionWeights } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { clearStoredQuiz, loadStoredQuiz, loadWeights, storeQuiz } from '@/lib/quizStorage';

// One save per page load, even under StrictMode's double effects.
let savingAnswers: Promise<QuizResult> | null = null;

const heroButton =
  "flex h-11 w-11 items-center justify-center rounded-full bg-hero-muted text-hero-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
        toast({ title: "Result saved", description: "Your quiz result is saved to your profile." });
      })
      .catch((error) => {
        console.error("Error saving quiz result:", error);
        toast({ title: "Save failed", description: "We couldn't save your result to your profile.", variant: "destructive" });
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

  const handleDownloadImage = async () => {
    try {
      const profileElement = document.querySelector('[data-profile-card="true"]');
      if (!profileElement) {
        toast({ title: "Error", description: "Could not find profile content.", variant: "destructive" });
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      toast({ title: "Capturing…", description: "Creating your image." });

      const canvas = await html2canvas(profileElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `glas-politics-profile-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({ title: "Downloaded", description: "Profile saved as an image." });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({ title: "Download failed", description: "Unable to create image.", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const url = `${window.location.origin}/quiz`;
    const text = `My Glas Politics profile: ${result.ideology}. Where do you stand?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Glas Politics", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: "Link copied", description: "Paste it anywhere." });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return;
      toast({ title: "Could not share", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleRestartQuiz = () => {
    clearStoredQuiz();
    setLocation('/quiz');
  };

  if (!result) {
    return <LoadingScreen message="Loading your political profile…" />;
  }

  return (
    <div className="grid items-start gap-3 py-2 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <div data-profile-card="true">
          <MultidimensionalIdeologyProfile
            dimensions={result.vector}
            ideology={result.ideology}
            description={result.description}
            actions={
              <>
                <button type="button" onClick={handleDownloadImage} aria-label="Download as image" className={heroButton}>
                  <Download className="h-5 w-5" />
                </button>
                <button type="button" onClick={handleShare} aria-label="Share" className={heroButton}>
                  <Share2 className="h-5 w-5" />
                </button>
              </>
            }
          />
        </div>

        <EnhancedProfileExplanation dimensions={result.vector} weights={weights} onWeightsChange={setWeights} />

        <ContextAnalysis dimensions={result.vector} />

        {/* Signed in, two or more saved results */}
        <PoliticalOpinionChangeTracker />
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-display text-[22px] font-bold">Keep this result</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.id !== null
              ? "This result is saved to your profile."
              : isAuthenticated
                ? "Saving this result to your profile…"
                : "Sign in to save this result and track how your views change over time."}
          </p>
          {!isAuthenticated && (
            <Button size="lg" className="h-[52px] w-full text-base font-extrabold" onClick={() => setLocation('/login')}>
              Sign in to save
            </Button>
          )}
          {result.id !== null && (
            <Button asChild size="lg" className="h-[52px] w-full text-base font-extrabold">
              <Link href="/my-politics">Go to My politics</Link>
            </Button>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Share", icon: Share2, onClick: handleShare },
              { label: "Download", icon: Download, onClick: handleDownloadImage },
              { label: "Retake", icon: RotateCcw, onClick: handleRestartQuiz },
            ].map(({ label, icon: Icon, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-[13px] font-bold transition-colors hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export default QuizResultsPage;
