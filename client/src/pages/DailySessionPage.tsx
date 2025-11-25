import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCompleteDailySession,
  useDailySession,
  useDailySessionVote,
} from "@/hooks/useDailySession";
import type {
  DailySessionItem,
  DailySessionCompletion,
  DailySessionState,
} from "@/services/dailySessionService";
import { SliderVoteControl } from "@/components/votes/SliderVoteControl";
import { MultipleChoiceVoteControl } from "@/components/votes/MultipleChoiceVoteControl";
import { Loader2, Send, SkipForward } from "lucide-react";

type Step = "prompt" | "vote" | "payoff" | "streakShare";
type VoteSubStep = "preview" | "question";

const ratingLabels: Record<number, string> = {
  1: "Strongly oppose",
  2: "Oppose",
  3: "Neutral",
  4: "Support",
  5: "Strongly support",
};

const voteCardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const voteItemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.05 * i,
      type: "spring",
      stiffness: 220,
      damping: 22,
    },
  }),
};

type CelebrationPayload = {
  emoji: string;
  headline: string;
  subline: string;
};

const dimensionLabels: Record<string, string> = {
  housing: "Housing",
  immigration: "Immigration",
  environment: "Climate & Energy",
  healthcare: "Healthcare",
  economy: "Economy",
  social_issues: "Social Policy",
  justice: "Justice & Security",
  education: "Education",
};

function mapDimensionLabel(dimension?: string | null): string {
  if (!dimension) return "Policy";
  return dimensionLabels[dimension] ?? dimension.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildPromptCopy(item: DailySessionItem): string {
  if (item.prompt) return item.prompt;
  return `Do you support or oppose: ${item.headline}?`;
}

function buildContextNote(item: DailySessionItem): string | null {
  if (item.contextNote) return item.contextNote;
  const dimension = mapDimensionLabel(item.policyDimension);
  const direction = item.policyDirection
    ? item.policyDirection === "progressive"
      ? "pushes the policy forward"
      : item.policyDirection === "conservative"
      ? "rolls the policy back"
      : "keeps the policy balanced"
    : "adjusts this policy";
  return `${dimension} update: this proposal ${direction}.`;
}

function getCelebrationPayload(rating: number, item: DailySessionItem): CelebrationPayload {
  if (rating >= 5) {
    return {
      emoji: "🔥",
      headline: "Big energy!",
      subline: `You went all-in on ${mapDimensionLabel(item.policyDimension).toLowerCase()}.`,
    };
  }
  if (rating === 4) {
    return {
      emoji: "✨",
      headline: "Strong support logged",
      subline: `We’ll factor this into your personal rankings instantly.`,
    };
  }
  if (rating === 3) {
    return {
      emoji: "🧭",
      headline: "Neutral check-in saved",
      subline: "Keeping your stance steady still boosts your streak.",
    };
  }
  if (rating === 2) {
    return {
      emoji: "⚠️",
      headline: "Not convinced",
      subline: "We’ll flag this for your TD comparisons.",
    };
  }
  return {
    emoji: "🚫",
    headline: "Hard pass recorded",
    subline: "Your opposition informs your ideological shift for tomorrow.",
  };
}

export default function DailySessionPage() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>("prompt");
  const [voteSubStep, setVoteSubStep] = useState<VoteSubStep>("preview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingRating, setPendingRating] = useState<number | null>(null);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [localSummary, setLocalSummary] =
    useState<DailySessionCompletion | null>(null);
  const [celebration, setCelebration] = useState<CelebrationPayload | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isCompletionPending, setIsCompletionPending] = useState(false);
  const [isDevSkipping, setIsDevSkipping] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);
  const lastSliderBeepValueRef = useRef<number | null>(null);
  const [localVotesCompleted, setLocalVotesCompleted] = useState(0);

  const sessionQuery = useDailySession(isAuthenticated);
  const voteMutation = useDailySessionVote();
  const completeMutation = useCompleteDailySession();
  const { toast } = useToast();

  const session = sessionQuery.data;
  const isLoading = sessionQuery.isLoading || sessionQuery.isFetching;

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }

    audioUnlockedRef.current = true;
    return audioContextRef.current;
  }, []);

  const playPianoChord = useCallback(
    (
      frequencies: number[],
      options: {
        delay?: number;
        volume?: number;
        decay?: number;
        detuneCents?: number;
        panSpread?: number;
        wave?: OscillatorType;
        filterFreqMultiplier?: number;
      } = {}
    ) => {
      const ctx = ensureAudioContext();
      if (!ctx || frequencies.length === 0) return;

      const {
        delay = 0,
        volume = 0.22,
        decay = 0.55,
        detuneCents = 4,
        panSpread = 0.25,
        wave = "sine",
        filterFreqMultiplier = 5,
      } = options;

      const startTimeBase = ctx.currentTime + delay;

      frequencies.forEach((freq, index) => {
        const startTime = startTimeBase + index * 0.012;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(
          freq * filterFreqMultiplier,
          startTime
        );
        filter.Q.setValueAtTime(0.9, startTime);

        const panner = ctx.createStereoPanner
          ? ctx.createStereoPanner()
          : null;

        const cents =
          detuneCents === 0
            ? 0
            : (Math.random() - 0.5) * detuneCents * 2;
        const detuneRatio = Math.pow(2, cents / 1200);
        osc.type = wave;
        osc.frequency.setValueAtTime(freq * detuneRatio, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        const targetVolume = volume * Math.max(0.4, 1 - index * 0.12);
        gain.gain.linearRampToValueAtTime(
          targetVolume,
          startTime + 0.02
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          startTime + decay + index * 0.05
        );

        osc.connect(filter);
        if (panner) {
          const panAmount =
            (Math.random() * 2 - 1) * Math.min(1, panSpread);
          panner.pan.setValueAtTime(panAmount, startTime);
          filter.connect(panner);
          panner.connect(gain);
        } else {
          filter.connect(gain);
        }
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + decay + 0.4);
      });
    },
    [ensureAudioContext]
  );

  const playStartSound = useCallback(() => {
    playPianoChord([261.63, 329.63, 392], {
      volume: 0.32,
      decay: 0.72,
      detuneCents: 4,
      panSpread: 0.4,
      wave: "sine",
      filterFreqMultiplier: 5,
    });
    playPianoChord([329.63, 415.3, 523.25], {
      delay: 0.22,
      volume: 0.28,
      decay: 0.64,
      detuneCents: 3,
      panSpread: 0.42,
      wave: "sine",
      filterFreqMultiplier: 5.2,
    });
    playPianoChord([392, 523.25, 659.26], {
      delay: 0.42,
      volume: 0.26,
      decay: 0.58,
      detuneCents: 2,
      panSpread: 0.45,
      wave: "sine",
      filterFreqMultiplier: 5.4,
    });
  }, [playPianoChord]);

  const playAdvanceSound = useCallback(() => {
    playPianoChord([523.25, 659.25, 783.99], {
      volume: 0.26,
      decay: 0.4,
      detuneCents: 2,
      panSpread: 0.32,
      wave: "sine",
      filterFreqMultiplier: 5.6,
    });
    playPianoChord([659.25, 783.99, 987.77], {
      delay: 0.18,
      volume: 0.24,
      decay: 0.36,
      detuneCents: 2,
      panSpread: 0.34,
      wave: "sine",
      filterFreqMultiplier: 5.8,
    });
  }, [playPianoChord]);

  const playCardTransitionSound = useCallback(() => {
    playPianoChord([440, 554.37, 659.26], {
      volume: 0.2,
      decay: 0.32,
      detuneCents: 1.5,
      panSpread: 0.3,
      wave: "sine",
      filterFreqMultiplier: 5.4,
    });
  }, [playPianoChord]);

  const playCompletionSound = useCallback(() => {
    playPianoChord([261.63, 329.63, 392, 523.25], {
      volume: 0.34,
      decay: 0.88,
      detuneCents: 4,
      panSpread: 0.5,
      wave: "sine",
      filterFreqMultiplier: 5.4,
    });
    playPianoChord([392, 493.88, 587, 659.26], {
      delay: 0.32,
      volume: 0.3,
      decay: 0.76,
      detuneCents: 3,
      panSpread: 0.48,
      wave: "sine",
      filterFreqMultiplier: 5.6,
    });
    playPianoChord([659.26, 783.99, 987.77], {
      delay: 0.64,
      volume: 0.26,
      decay: 0.68,
      detuneCents: 2,
      panSpread: 0.52,
      wave: "sine",
      filterFreqMultiplier: 5.8,
    });
  }, [playPianoChord]);

  const playSharePromptSound = useCallback(() => {
    playPianoChord([329.63, 415.3, 523.25], {
      volume: 0.24,
      decay: 0.52,
      detuneCents: 2,
      panSpread: 0.36,
      wave: "sine",
      filterFreqMultiplier: 5.2,
    });
    playPianoChord([392, 523.25, 659.26], {
      delay: 0.22,
      volume: 0.22,
      decay: 0.5,
      detuneCents: 2,
      panSpread: 0.38,
      wave: "sine",
      filterFreqMultiplier: 5.4,
    });
  }, [playPianoChord]);

  const playSliderBeep = useCallback(() => {
    playPianoChord([880], {
      volume: 0.14,
      decay: 0.22,
      detuneCents: 0,
      panSpread: 0.18,
      wave: "sine",
      filterFreqMultiplier: 6.2,
    });
  }, [playPianoChord]);

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (session?.status === "completed" && session.completion) {
      setLocalSummary(session.completion);
      setLocalVotesCompleted(session.items.length);
      setStep("payoff");
    } else if (session && session.status === "pending") {
      if (session.voteCount > 0) {
        setLocalVotesCompleted(session.voteCount);
        setStep("vote");
        setCurrentIndex(Math.min(session.voteCount, session.items.length - 1));
      } else {
        setLocalVotesCompleted(0);
      }
    }
  }, [session]);

  useEffect(() => {
    lastSliderBeepValueRef.current = null;
    setVoteSubStep("preview"); // Reset to preview when moving to a new item
  }, [currentIndex, step]);

  const currentItem: DailySessionItem | undefined = useMemo(() => {
    if (!session || !session.items) return undefined;
    return session.items[currentIndex];
  }, [session, currentIndex]);

  const currentValue = pendingRating ?? currentItem?.rating ?? 3;
  const currentSelectedOption = pendingOption ?? currentItem?.selectedOption ?? null;
  const totalItems = session?.items.length ?? 0;
  const votesCompleted = session?.status === "completed"
    ? totalItems
    : Math.max(localVotesCompleted, session?.voteCount ?? 0);
  const effectiveCompleted = step === "payoff"
    ? totalItems
    : step === "streakShare"
    ? totalItems
    : Math.min(votesCompleted, totalItems);

  const answeredDuringVote =
    step === "vote" && totalItems > 0
      ? Math.min(Math.max(currentIndex, 0), totalItems - 1)
      : 0;

  const activeProgressCount =
    totalItems > 0
      ? step === "vote"
        ? answeredDuringVote
        : effectiveCompleted
      : 0;

  const progressPercent =
    totalItems > 0
      ? Math.min(100, Math.round((activeProgressCount / totalItems) * 100))
      : 0;
  const progressLabel = totalItems
    ? step === "vote"
      ? `${activeProgressCount}/${totalItems} answered`
      : `${effectiveCompleted}/${totalItems} complete`
    : "";
  const isProcessing =
    voteMutation.isPending ||
    completeMutation.isPending ||
    isAdvancing ||
    isCompletionPending ||
    isDevSkipping;

  const isDevMode = import.meta.env.DEV;

  const hasCompletedAll =
    session?.status === "completed" ||
    (session?.voteCount ?? 0) >= (session?.items.length ?? 0);

  const completionSummary =
    localSummary ?? session?.completion ?? null;
  const currentStreakCount =
    completionSummary?.streakCount ?? session?.streakCount ?? 0;
  const previousStreakCount = Math.max(0, currentStreakCount - 1);

  const handleSliderValueChange = useCallback(
    (newValue: number) => {
      setPendingRating(newValue);
      if (lastSliderBeepValueRef.current !== newValue) {
        playSliderBeep();
        lastSliderBeepValueRef.current = newValue;
      }
    },
    [playSliderBeep, setPendingRating]
  );

  const handleStart = () => {
    playStartSound();
    setStep("vote");
    setCurrentIndex(0);
    setCelebration(null);
    const first = session?.items[0];
    setPendingRating(first?.rating ?? null);
    setPendingOption(first?.selectedOption ?? null);
    playCardTransitionSound();
  };

  const handleVoteNext = async () => {
    // For multiple choice: require option selection
    // For slider: require rating
    const hasAnswer = currentItem?.answerOptions 
      ? pendingOption !== null 
      : pendingRating !== null;
    
    if (!currentItem || !hasAnswer || isAdvancing) return;
    setIsAdvancing(true);
    playAdvanceSound();

    let updatedSession: DailySessionState | null = null;

    try {
      let attempt = 0;
      while (attempt < 2) {
        try {
          // For multiple choice: send optionKey, for slider: send rating
          if (currentItem.answerOptions && pendingOption) {
            updatedSession = await voteMutation.mutateAsync({
              sessionItemId: currentItem.sessionItemId,
              optionKey: pendingOption,
            });
          } else {
            updatedSession = await voteMutation.mutateAsync({
              sessionItemId: currentItem.sessionItemId,
              rating: pendingRating,
            });
          }
          break;
        } catch (mutationError: any) {
          const message = mutationError?.message || "";
          const shouldRetry =
            attempt === 0 && message.toLowerCase().includes("failed to fetch");

          if (!shouldRetry) {
            throw mutationError;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
          attempt += 1;
        }
      }

      if (!updatedSession) {
        throw new Error("Vote request failed");
      }

      // For multiple choice, use a neutral celebration (or map option to rating)
      const celebrationRating = currentItem.answerOptions ? 3 : pendingRating;
      setCelebration(getCelebrationPayload(celebrationRating ?? 3, currentItem));
    } catch (error: any) {
      setIsAdvancing(false);
      toast({
        variant: "destructive",
        title: "Vote not recorded",
        description: error?.message || "Please try that stance again.",
      });
      return;
    }

    const totalItems =
      updatedSession?.items.length ?? session?.items.length ?? 0;
    const hasMorePending =
      updatedSession?.items.some(
        (item) => !item.hasVoted || item.sessionItemId === currentItem.sessionItemId
      ) ?? false;
    const isFinalVote =
      totalItems === 0 || currentIndex + 1 >= totalItems || !hasMorePending;
    const nextIndex =
      totalItems > 0 ? Math.min(currentIndex + 1, totalItems - 1) : 0;

    if (isFinalVote) {
      setIsCompletionPending(true);
    }

    setTimeout(async () => {
      setPendingRating(null);
      setPendingOption(null);
      setCelebration(null);
      setIsAdvancing(false);

      if (!isFinalVote) {
        const nextCount = updatedSession?.voteCount ?? votesCompleted + 1;
        setLocalVotesCompleted(Math.min(nextCount, totalItems));
        setCurrentIndex(nextIndex);
        playCardTransitionSound();
        return;
      }

      try {
        const summary = await completeMutation.mutateAsync();
        setLocalSummary(summary);
        const finalCount = updatedSession?.voteCount ?? totalItems;
        setLocalVotesCompleted(Math.min(finalCount, totalItems));
        playCompletionSound();
        setStep("payoff");
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Something broke",
          description:
            error?.message || "We couldn’t finish the session. Please retry.",
        });
        setIsCompletionPending(false);
      } finally {
        setIsCompletionPending(false);
      }
    }, 720);
  };

  const handleShareAction = useCallback(
    (action: "share" | "challenge" | "connect") => {
      const messages: Record<typeof action, { title: string; description: string }> =
        {
          share: {
            title: "Share sent!",
            description: "We copied a shareable message to your clipboard.",
          },
          challenge: {
            title: "Challenge ready!",
            description: "We’ll open the challenge composer when hooked up.",
          },
          connect: {
            title: "Friend invite queued!",
            description: "Soon you’ll be able to connect directly.",
          },
        };
      const payload = messages[action];
      toast({
        title: payload.title,
        description: payload.description,
      });
    },
    [toast]
  );

  const handleNudgeFriend = useCallback(
    (friendName: string) => {
      playPianoChord([587.33, 739.99, 880], {
        volume: 0.22,
        decay: 0.4,
        detuneCents: 2,
        panSpread: 0.3,
        wave: "sine",
        filterFreqMultiplier: 5.6,
      });
      playPianoChord([659.26, 880, 987.77], {
        delay: 0.18,
        volume: 0.2,
        decay: 0.36,
        detuneCents: 2,
        panSpread: 0.32,
        wave: "sine",
        filterFreqMultiplier: 5.8,
      });
      toast({
        title: `Nudge sent to ${friendName}!`,
        description: "We’ll ping them to complete their daily streak.",
      });
    },
    [toast, playPianoChord]
  );

  const handleShowStreakBoost = () => {
    playSharePromptSound();
    setStep("streakShare");
  };

  const handleFinish = () => {
    navigate("/");
  };

  const isVotePending =
    step === "vote" &&
    (!currentItem || 
     (currentItem?.answerOptions ? pendingOption === null : pendingRating === null) || 
     isProcessing);

  const handleDevSkipSession = useCallback(async () => {
    if (!isDevMode || !session || session.items.length === 0) {
      return;
    }

    try {
      setIsDevSkipping(true);
      setIsCompletionPending(true);
      setIsAdvancing(true);
      setPendingRating(null);
      setCelebration(null);

      let latestSession = session;
      for (const item of session.items) {
        if (item.hasVoted) continue;
        latestSession = await voteMutation.mutateAsync({
          sessionItemId: item.sessionItemId,
          rating: 3,
        });
      }

      const summary = await completeMutation.mutateAsync();
      setLocalSummary(summary);
      setLocalVotesCompleted(latestSession.items.length);
      setStep("payoff");
      toast({
        title: "Session skipped",
        description: "Marked as completed (dev mode).",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Skip failed",
        description: error?.message || "Could not skip the session.",
      });
    } finally {
      setIsAdvancing(false);
      setIsDevSkipping(false);
      setIsCompletionPending(false);
    }
  }, [
    isDevMode,
    session,
    voteMutation,
    completeMutation,
    toast,
    setLocalVotesCompleted,
  ]);

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        <div className="mobile-card mobile-stack max-w-sm border border-slate-800/50 bg-black/40 text-center shadow-[0_20px_40px_-18px_rgba(15,23,42,0.9)]">
          <h1 className="text-2xl font-semibold">
            Sign in to access your daily session.
          </h1>
          <p className="text-muted-foreground">
            Daily voting keeps your insights fresh. Log in to jump back in.
          </p>
          <Button onClick={() => navigate("/login")}>Go to login</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        <div className="mobile-card mobile-stack animate-pulse border border-slate-800/50 bg-black/40 text-center text-muted-foreground">
          <p>Loading your daily session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-0.5 py-4 text-white sm:px-1">
      <div className="daily-session-shell relative w-full overflow-hidden text-white">
        <main className="flex flex-1 flex-col items-center justify-center w-full" style={{ maxWidth: '100%' }}>
          {step === "prompt" && (
            <PromptScreen
              streak={session.streakCount}
              onStart={handleStart}
              isStarting={voteMutation.isPending || completeMutation.isPending}
              onSkip={handleDevSkipSession}
              isDevMode={isDevMode}
            />
          )}

          {step === "vote" && (
            <AnimatePresence mode="wait">
              {isCompletionPending ? (
                <CompletionTransition key="completion-transition" />
              ) : (
                currentItem && (
                  voteSubStep === "preview" ? (
                    <ArticlePreviewScreen
                      key={`${currentItem.sessionItemId}-preview`}
                      item={currentItem}
                      totalItems={totalItems}
                      currentIndex={currentIndex}
                      completedCount={votesCompleted}
                      onNext={() => setVoteSubStep("question")}
                      onSkip={handleDevSkipSession}
                      isDevMode={isDevMode}
                    />
                  ) : (
                    <VoteScreen
                      key={`${currentItem.sessionItemId}-question`}
                      item={currentItem}
                      totalItems={totalItems}
                      currentIndex={currentIndex}
                      value={currentValue}
                      setValue={handleSliderValueChange}
                      onNext={handleVoteNext}
                      isNextDisabled={isVotePending}
                      isProcessing={isProcessing}
                      completedCount={votesCompleted}
                      onSkip={handleDevSkipSession}
                      isDevMode={isDevMode}
                      pendingOption={pendingOption}
                      setPendingOption={setPendingOption}
                      pendingRating={pendingRating}
                      playSliderBeep={playSliderBeep}
                      onBack={() => setVoteSubStep("preview")}
                    />
                  )
                )
              )}
            </AnimatePresence>
          )}

          {step === "payoff" && completionSummary && (
            <PayoffScreen
              summary={completionSummary}
              onNext={handleShowStreakBoost}
              isCompleting={completeMutation.isPending}
            />
          )}

          {step === "streakShare" && completionSummary && (
            <StreakBoostScreen
              previousStreak={previousStreakCount}
              currentStreak={currentStreakCount}
              onShare={handleShareAction}
              onNudge={handleNudgeFriend}
              onFinish={handleFinish}
            />
          )}
        </main>
        <AnimatePresence>
          {celebration && (
            <motion.div
              className="pointer-events-none fixed inset-0 flex items-center justify-center bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="mobile-card mobile-stack mx-4 w-full max-w-sm border border-emerald-400/40 bg-slate-900/90 text-center text-emerald-50 shadow-[0_25px_70px_-20px_rgba(16,185,129,0.7)]"
                initial={{ scale: 0.8, rotate: -3, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 18 }}
              >
                <div className="text-5xl">{celebration.emoji}</div>
                <h3 className="mt-3 text-xl font-semibold">
                  {celebration.headline}
                </h3>
                <p className="mt-2 text-sm text-emerald-200/80">
                  {celebration.subline}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface PromptScreenProps {
  streak: number;
  onStart: () => void;
  isStarting: boolean;
  onSkip?: () => void;
  isDevMode?: boolean;
}

function PromptScreen({ streak, onStart, isStarting, onSkip, isDevMode }: PromptScreenProps) {
  return (
    <div className="flex w-full justify-center">
      <div className="mobile-card mobile-stack relative w-full max-w-[320px] border border-slate-800 bg-black/60 p-6 text-center shadow-[0_20px_40px_-10px_rgba(15,23,42,0.65)] sm:max-w-[360px] sm:p-7">
        <div className="mobile-section items-center">
          {isDevMode && onSkip && (
            <div className="absolute top-2 right-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                onClick={onSkip}
                disabled={isStarting}
                title="Skip session (dev only)"
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex flex-col items-center gap-[var(--mobile-stack-gap)]">
            <h2 className="text-2xl font-semibold">
              Ready for your daily update?
            </h2>
            <p className="text-sm text-slate-300 sm:text-base leading-snug">
              Today&apos;s issues are tuned to what mattered to you yesterday.
              Three quick stances — under 30 seconds — and you&apos;re done.
            </p>
          </div>

          <div className="mobile-card-tight flex items-center gap-[var(--mobile-inline-gap)] border border-slate-800 bg-slate-900/60">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/80 text-xl sm:h-12 sm:w-12 sm:text-2xl">
              🔥
            </div>
            <div className="text-start">
              <p className="text-xs uppercase tracking-wide text-emerald-300">
                Streak
              </p>
              <p className="text-base font-semibold sm:text-lg">
                {streak > 0 ? `${streak} days running` : "Start your streak"}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full bg-white/90 text-slate-900 hover:bg-white"
            onClick={onStart}
            disabled={isStarting}
          >
            Start
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ArticlePreviewScreenProps {
  item: DailySessionItem;
  totalItems: number;
  currentIndex: number;
  completedCount: number;
  onNext: () => void;
  onSkip?: () => void;
  isDevMode?: boolean;
}

function ArticlePreviewScreen({
  item,
  totalItems,
  currentIndex,
  completedCount,
  onNext,
  onSkip,
  isDevMode,
}: ArticlePreviewScreenProps) {
  const progressLabel = `${completedCount}/${totalItems} completed`;
  let animationIndex = 0;

  return (
    <motion.div
      className="mobile-card relative flex w-full min-h-[520px] flex-col gap-[var(--mobile-section-spacing)] border border-slate-800/70 bg-slate-950/80 shadow-[0_24px_50px_-15px_rgba(15,23,42,0.7)] transition-colors sm:p-7"
      variants={voteCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      {isDevMode && onSkip && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            onClick={onSkip}
            title="Skip session (dev only)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      )}

      <motion.div
        className="flex items-center gap-2 text-sm font-semibold text-emerald-300"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        <span>{item.emoji ?? "📰"}</span>
        <span>Issue {currentIndex + 1} of {totalItems}</span>
      </motion.div>

      {item.imageUrl && (
        <motion.div
          className="w-full aspect-video rounded-lg overflow-hidden bg-slate-800"
          variants={voteItemVariants}
          custom={animationIndex++}
        >
          <img
            src={item.imageUrl}
            alt={item.headline}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image if it fails to load
              e.currentTarget.style.display = 'none';
            }}
          />
        </motion.div>
      )}

      <motion.h2
        className="text-2xl font-bold leading-tight text-white"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        {item.headline}
      </motion.h2>

      <motion.p
        className="text-base leading-relaxed text-slate-300"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        {item.summary}
      </motion.p>

      {item.articleUrl && (
        <motion.div
          variants={voteItemVariants}
          custom={animationIndex++}
        >
          <Button
            asChild
            variant="outline"
            className="w-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500/50"
          >
            <a
              href={item.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2"
            >
              <span>📖</span>
              <span>Read full article</span>
            </a>
          </Button>
        </motion.div>
      )}

      <motion.div
        className="mt-auto flex flex-col gap-3"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        <div className="text-center text-xs text-slate-400">
          {progressLabel}
        </div>
        <Button
          onClick={onNext}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 py-6 text-lg font-semibold"
        >
          Vote Opportunity →
        </Button>
      </motion.div>
    </motion.div>
  );
}

interface VoteScreenProps {
  item: DailySessionItem;
  totalItems: number;
  currentIndex: number;
  value: number;
  setValue: (value: number) => void;
  onNext: () => void;
  isNextDisabled: boolean;
  isProcessing: boolean;
  completedCount: number;
  onSkip?: () => void;
  isDevMode?: boolean;
  pendingOption: string | null;
  setPendingOption: (option: string | null) => void;
  pendingRating: number | null;
  playSliderBeep: () => void;
  onBack?: () => void;
}

function VoteScreen({
  item,
  totalItems,
  currentIndex,
  value,
  setValue,
  onNext,
  isNextDisabled,
  isProcessing,
  completedCount,
  onSkip,
  isDevMode,
  pendingOption,
  setPendingOption,
  pendingRating,
  playSliderBeep,
  onBack,
}: VoteScreenProps) {
  const promptCopy = buildPromptCopy(item);
  const contextNote = buildContextNote(item);
  const displayContextNote =
    contextNote && /^focus:/i.test(contextNote.trim())
      ? null
      : contextNote;
  const progressLabel = `${completedCount}/${totalItems} completed`;
  let animationIndex = 0;

  return (
    <motion.div
      className="mobile-card relative flex w-full max-h-[667px] flex-col gap-3 border border-slate-800/70 bg-slate-950/80 shadow-[0_24px_50px_-15px_rgba(15,23,42,0.7)] transition-colors sm:p-7 overflow-hidden"
      variants={voteCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      {isDevMode && onSkip && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 rounded-full p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            onClick={onSkip}
            disabled={isProcessing}
            title="Skip session (dev only)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex items-center justify-between">
        {onBack && (
          <motion.button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            variants={voteItemVariants}
            custom={animationIndex++}
          >
            <span>←</span>
            <span>Back</span>
          </motion.button>
        )}

        <motion.div
          className="flex items-center gap-2 text-xs font-semibold text-emerald-300 ml-auto"
          variants={voteItemVariants}
          custom={animationIndex++}
        >
          <span>{item.emoji ?? "🗳️"}</span>
          <span>Issue {currentIndex + 1} of {totalItems}</span>
        </motion.div>
      </div>

      <motion.div
        className="flex flex-col gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-lg"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        <div className="flex items-start gap-2">
          <span className="text-xl flex-shrink-0">{item.emoji ?? "💡"}</span>
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-emerald-200 uppercase tracking-wide">
              {mapDimensionLabel(item.policyDimension)} stance check
            </p>
            <p className="text-sm font-medium leading-tight text-white">
              {promptCopy}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Show multiple choice if answerOptions exist, otherwise show slider */}
      {item.answerOptions && Object.keys(item.answerOptions).length > 0 ? (
        <motion.div
          className="flex flex-col gap-2 border border-slate-800 bg-black/40 p-3 rounded-lg w-full min-w-0 flex-1 overflow-y-auto"
          variants={voteItemVariants}
          custom={animationIndex++}
        >
          <MultipleChoiceVoteControl
            options={item.answerOptions}
            selectedOption={pendingOption ?? item.selectedOption ?? null}
            onSelect={(optionKey) => {
              setPendingOption(optionKey);
              playSliderBeep();
            }}
            disabled={isProcessing}
          />
        </motion.div>
      ) : (
        <motion.div
          className="flex flex-col gap-2 border border-slate-800 bg-black/40 p-3 rounded-lg"
          variants={voteItemVariants}
          custom={animationIndex++}
        >
          <motion.div
            key={value}
            initial={{ scale: 0.97, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
          >
            <SliderVoteControl
              value={value}
              onValueChange={(newValue) => setValue(newValue)}
              disabled={isProcessing}
            />
          </motion.div>
          <div className="text-center text-xs font-semibold text-emerald-200">
            {ratingLabels[value as keyof typeof ratingLabels] ||
              "Select your stance"}
          </div>
        </motion.div>
      )}

      <motion.div
        className="mt-auto pt-2"
        variants={voteItemVariants}
        custom={animationIndex++}
      >
        <Button
          onClick={onNext}
          disabled={isNextDisabled || (item.answerOptions ? pendingOption === null : pendingRating === null)}
          className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 py-5 text-base font-semibold"
        >
          {currentIndex + 1 === totalItems ? "Reveal my insights" : "Next issue"}
        </Button>
      </motion.div>
    </motion.div>
  );
}

interface PayoffScreenProps {
  summary: DailySessionCompletion;
  onNext: () => void;
  isCompleting: boolean;
}

function CompletionTransition() {
  return (
    <motion.div
      className="mobile-card flex w-full max-w-[360px] sm:max-w-xl min-h-[520px] flex-col items-center justify-center gap-4 border border-emerald-500/30 bg-slate-900/70 text-center text-emerald-50 shadow-[0_25px_50px_-20px_rgba(16,185,129,0.45)] sm:p-8"
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Crunching your insights…</h2>
        <p className="text-sm text-emerald-200/80 leading-snug">
          We’re locking in your final stance and preparing your payoff screen.
        </p>
      </div>
    </motion.div>
  );
}

const payoffVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 * i, type: "spring", stiffness: 200, damping: 20 },
  }),
};

function PayoffScreen({ summary, onNext, isCompleting }: PayoffScreenProps) {
  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;
  const dimensionShifts = (summary.dimensionShifts || []).slice(0, 3);
  const describeDirection = (direction: "left" | "right" | "neutral", axisLabel: string) => {
    // Extract dimension name and endpoints from format: "Dimension LeftLabel - RightLabel"
    // e.g., "Authority Libertarian - Authoritarian" or "Economic Left - Right"
    let leftLabel = "Left";
    let rightLabel = "Right";
    
    if (axisLabel.includes(" - ")) {
      const parts = axisLabel.split(" - ");
      if (parts.length === 2) {
        // Left part might be "Authority Libertarian" or just "Economic Left"
        // Right part is "Authoritarian" or "Right"
        const leftPart = parts[0].trim();
        const rightPart = parts[1].trim();
        
        // Extract the last word from left part as the left endpoint
        const leftWords = leftPart.split(" ");
        leftLabel = leftWords[leftWords.length - 1] || "Left";
        rightLabel = rightPart || "Right";
      }
    } else if (axisLabel.includes("/")) {
      const parts = axisLabel.split("/");
      leftLabel = parts[0]?.trim() || "Left";
      rightLabel = parts[1]?.trim() || "Right";
    }
    
    // Negative values go left, positive values go right
    if (direction === "left") return leftLabel;
    if (direction === "right") return rightLabel;
    return "centre";
  };
  
  const getDimensionName = (axisLabel: string) => {
    // Extract just the dimension name from "Dimension LeftLabel - RightLabel"
    // e.g., "Authority Libertarian - Authoritarian" -> "Authority"
    // e.g., "Economic Left - Right" -> "Economic"
    if (axisLabel.includes(" - ")) {
      const leftPart = axisLabel.split(" - ")[0].trim();
      const words = leftPart.split(" ");
      // If there are multiple words, the first word(s) before the last are the dimension name
      if (words.length > 1) {
        return words.slice(0, -1).join(" ");
      }
      return leftPart;
    }
    return axisLabel;
  };
  const regionalLine =
    summary.regionComparison ??
    "Regional shift unavailable — add your county or constituency to unlock this insight.";

  return (
    <motion.div
      className="mobile-card flex w-full max-w-[360px] sm:max-w-xl max-h-[667px] flex-col gap-3 border border-slate-800/70 bg-slate-950/70 text-emerald-50 shadow-[0_30px_60px_-20px_rgba(15,23,42,0.8)] sm:p-8 overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className="text-2xl font-semibold">🔥 Session complete!</h2>
        <p className="text-xs uppercase tracking-wider text-emerald-200/80">
          Streak {summary.streakCount} day{summary.streakCount === 1 ? "" : "s"}
        </p>
        {summary.ideologySummary && (
          <p className="text-xs text-emerald-100/80 leading-snug">
            {summary.ideologySummary}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 text-sm flex-1 overflow-y-auto">
        {dimensionShifts.length === 0 && (
          <div className="rounded-lg border border-slate-700/70 bg-white/5 px-3 py-2 text-xs text-emerald-100/80">
            Your answers kept every dimension stable today.
          </div>
        )}

        {dimensionShifts.map((shift, idx) => (
          <div
            key={shift.ideologyDimension}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2"
          >
            <p className="text-xs uppercase tracking-wider text-emerald-200/80 font-semibold">
              {getDimensionName(shift.axisLabel)}
            </p>
            <p className="text-sm font-semibold text-white">
              {formatPercent(shift.deltaPercent)} (
              {shift.before.toFixed(2)} → {shift.after.toFixed(2)})
            </p>
            <p className="text-xs text-emerald-200/80">
              Drifted toward {describeDirection(shift.direction, shift.axisLabel)}
            </p>
            <AxisShiftScale
              axisLabel={shift.axisLabel}
              before={shift.before}
              after={shift.after}
            />
          </div>
        ))}

        <div className="rounded-lg border border-slate-700/70 bg-white/5 px-3 py-2 text-xs text-emerald-100/80">
          {regionalLine}
        </div>
      </div>

      <div className="mt-auto pt-2">
        <Button
          onClick={onNext}
          disabled={isCompleting}
          className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 py-5 text-base font-semibold"
        >
          See streak boost
        </Button>
      </div>
    </motion.div>
  );
}

interface StreakBoostScreenProps {
  previousStreak: number;
  currentStreak: number;
  onShare: (action: "share" | "challenge" | "connect") => void;
  onNudge: (friend: string) => void;
  onFinish: () => void;
}

type FriendStreakStatus = "completed" | "pending";

interface FriendStreak {
  name: string;
  previous: number;
  target: number;
  status: FriendStreakStatus;
}

function StreakBoostScreen({
  previousStreak,
  currentStreak,
  onShare,
  onNudge,
  onFinish,
}: StreakBoostScreenProps) {
  const [displayStreak, setDisplayStreak] = useState(
    Math.max(0, previousStreak)
  );
  const friends = useMemo<FriendStreak[]>(
    () => [
      { name: "Aaron", previous: 1, target: 2, status: "completed" },
      { name: "Dmitri", previous: 1, target: 2, status: "pending" },
    ],
    []
  );
  const [friendDisplayStreaks, setFriendDisplayStreaks] = useState<
    Record<string, number>
  >(() =>
    friends.reduce<Record<string, number>>((acc, friend) => {
      acc[friend.name] = friend.previous;
      return acc;
    }, {})
  );
  const [nudgingFriend, setNudgingFriend] = useState<string | null>(null);

  useEffect(() => {
    if (currentStreak <= previousStreak) {
      setDisplayStreak(currentStreak);
      return;
    }

    let current = Math.max(0, previousStreak);
    setDisplayStreak(current);

    const interval = setInterval(() => {
      current += 1;
      setDisplayStreak((prev) =>
        prev < currentStreak ? current : currentStreak
      );
      if (current >= currentStreak) {
        clearInterval(interval);
      }
    }, 320);

    return () => clearInterval(interval);
  }, [previousStreak, currentStreak]);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setInterval>> = [];

    friends.forEach((friend, index) => {
      if (friend.status === "completed") {
        let current = friend.previous;
        setFriendDisplayStreaks((prev) => ({
          ...prev,
          [friend.name]: current,
        }));

        const interval = setInterval(() => {
          current = Math.min(friend.target, current + 1);
          setFriendDisplayStreaks((prev) => ({
            ...prev,
            [friend.name]: current,
          }));
          if (current >= friend.target) {
            clearInterval(interval);
          }
        }, 320 + index * 40);

        timers.push(interval);
      } else {
        setFriendDisplayStreaks((prev) => ({
          ...prev,
          [friend.name]: friend.previous,
        }));
      }
    });

    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
  }, [friends]);

  const streakDelta = Math.max(0, currentStreak - previousStreak);

  const handleFriendNudge = (friendName: string) => {
    if (nudgingFriend) return;
    setNudgingFriend(friendName);
    onNudge(friendName);
    setTimeout(() => setNudgingFriend(null), 1200);
  };

  const shareButtons: Array<{
    action: "share" | "challenge" | "connect";
    emoji: string;
    label: string;
  }> = [
    { action: "share", emoji: "🚀", label: "Share" },
    { action: "challenge", emoji: "⚔️", label: "Challenge" },
    { action: "connect", emoji: "🤝", label: "Connect" },
  ];

  return (
    <motion.div
      className="mobile-card flex w-full max-w-[360px] flex-col gap-[var(--mobile-section-spacing)] border border-slate-800/70 bg-slate-950/80 text-emerald-50 shadow-[0_35px_55px_-18px_rgba(15,23,42,0.5)] sm:p-8"
      initial={{ opacity: 0, scale: 0.96, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -10 }}
      transition={{ type: "spring", stiffness: 200, damping: 24 }}
    >
      <div className="flex flex-col gap-[var(--mobile-stack-gap)] text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">🔥 Streak boosted!</h2>
        <p className="text-xs text-emerald-100/80 sm:text-sm">
          Keep the momentum going—one tap away from a friendly rivalry.
        </p>
      </div>

      <div className="mobile-card-tight border border-slate-700/60 bg-slate-900/60 sm:p-6">
        <div className="flex flex-col items-center gap-[var(--mobile-stack-gap)] text-emerald-50 sm:flex-row sm:justify-center">
          <motion.div
            key={`streak-${displayStreak}`}
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="flex items-center gap-3 text-3xl font-semibold sm:text-5xl"
          >
            <span className="rounded-full bg-slate-800/70 px-4 py-1 text-slate-100 text-lg">
              {previousStreak}
              <span className="ml-1 text-sm text-emerald-100/70">days</span>
            </span>
            <motion.span
              key={`arrow-${displayStreak}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="text-3xl sm:text-4xl text-emerald-200"
            >
              ➜
            </motion.span>
            <motion.div
              key={`streak-target-${displayStreak}`}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 240, damping: 18 }}
              className="relative flex items-center gap-2 sm:gap-3"
            >
              <motion.span
                initial={{ opacity: 0.4, scale: 1.1 }}
                animate={{
                  opacity: [0.4, 1, 0.4],
                  scale: [1.05, 1, 1.05],
                  rotate: [0, 1.5, -1.5, 0],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="pointer-events-none absolute inset-0 blur-3xl bg-amber-200/30"
              />
              <span className="relative z-[1] rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 px-4 py-1 text-sm font-semibold uppercase tracking-[0.18em] text-amber-900 shadow-[0_0_35px_rgba(251,191,36,0.45)]">
                streak
              </span>
              <span className="relative z-[1] text-4xl font-bold bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(251,191,36,0.55)] sm:text-6xl">
                {displayStreak}
              </span>
              <span className="relative z-[1] text-lg font-semibold text-amber-100/80">
                days
              </span>
            </motion.div>
          </motion.div>
        </div>
        {streakDelta > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-3 text-center text-xs font-semibold text-emerald-200 sm:text-sm"
          >
            +{streakDelta} day streak bonus locked in.
          </motion.p>
        )}
      </div>

      <motion.div
        className="mobile-card-tight border border-slate-700/60 bg-slate-900/60"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 24 }}
      >
        <div className="text-xs uppercase tracking-[0.3em] text-emerald-200/70 mb-2">Friend streaks</div>
        <div className="space-y-2">
          {friends.map((friend, index) => {
            const isCompleted = friend.status === "completed";
            const displayValue = friendDisplayStreaks[friend.name] ?? friend.previous;
            const streakColor = isCompleted ? "text-emerald-100" : "text-slate-400";
            return (
              <motion.div
                key={friend.name}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  isCompleted ? "bg-amber-400/10" : "bg-slate-900/50"
                }`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + index * 0.04 }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔥</span>
                  <div>
                    <div className="font-semibold text-emerald-50">{friend.name}</div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-200/70">
                      {isCompleted ? "synced" : "waiting"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-lg font-semibold">
                  <span className={streakColor}>{friend.previous}</span>
                  <span className="text-emerald-200">➜</span>
                  <span className={isCompleted ? "text-amber-200" : "text-slate-500"}>
                    {isCompleted ? displayValue : friend.target}
                  </span>
                </div>
                {friend.status === "pending" && (
                  <motion.button
                    type="button"
                    onClick={() => handleFriendNudge(friend.name)}
                    disabled={nudgingFriend === friend.name}
                    className="ml-3 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 to-emerald-400/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 transition-all hover:border-emerald-500/50 hover:from-emerald-500/25 hover:to-emerald-400/20 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-emerald-500/30 disabled:hover:from-emerald-500/15 disabled:hover:to-emerald-400/10 disabled:hover:shadow-none"
                    whileHover={{ scale: nudgingFriend === friend.name ? 1 : 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + index * 0.04 }}
                  >
                    {nudgingFriend === friend.name ? (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          ✓
                        </motion.div>
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3" strokeWidth={2.5} />
                        <span>Nudge</span>
                      </>
                    )}
                  </motion.button>
                )}
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-3 gap-2 w-full"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 24 }}
      >
        {shareButtons.map((button, index) => (
          <motion.button
            key={button.action}
            type="button"
            onClick={() => onShare(button.action)}
            className="flex flex-col items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2 py-3 text-center text-xs text-emerald-50 transition hover:border-slate-500 hover:bg-slate-800/70"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 + index * 0.05 }}
          >
            <span className="text-xl">{button.emoji}</span>
            <span className="font-semibold">{button.label}</span>
          </motion.button>
        ))}
      </motion.div>

      <motion.div
        className="flex justify-center pt-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Button
          onClick={onFinish}
          className="min-w-[200px] bg-white/90 text-slate-900 hover:bg-white"
        >
          Finish
        </Button>
      </motion.div>
    </motion.div>
  );
}

function AxisShiftScale({
  axisLabel,
  before,
  after,
}: {
  axisLabel: string;
  before: number;
  after: number;
}) {
  const clamp = (value: number) => Math.min(Math.max(value, -1), 1);
  const beforeClamped = clamp(before);
  const afterClamped = clamp(after);

  const span = 0.5;
  let min = Math.max(-1, beforeClamped - span / 2);
  let max = min + span;
  if (max > 1) {
    max = 1;
    min = Math.max(-1, max - span);
  }
  const normalize = (value: number) =>
    Math.min(Math.max((clamp(value) - min) / (max - min), 0), 1);

  const beforePercent = normalize(beforeClamped);
  const afterPercent = normalize(afterClamped);
  const progressLeft = Math.min(beforePercent, afterPercent);
  const progressWidth = Math.abs(afterPercent - beforePercent);

  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => index / (tickCount - 1));
  
  // Parse axis label: "Economic Left - Right" -> ["Left", "Right"]
  // or "Social Progressive - Conservative" -> ["Progressive", "Conservative"]
  // or old format: "Left/Right" -> ["Left", "Right"]
  let leftLabel = "Left";
  let rightLabel = "Right";
  
  if (axisLabel.includes(" - ")) {
    const parts = axisLabel.split(" - ");
    if (parts.length === 2) {
      const leftPart = parts[0].trim();
      const rightPart = parts[1].trim();
      // Extract the last word from left part (e.g., "Economic Left" -> "Left", "Social Progressive" -> "Progressive")
      const leftWords = leftPart.split(" ");
      leftLabel = leftWords[leftWords.length - 1] || "Left";
      rightLabel = rightPart || "Right";
    }
  } else if (axisLabel.includes("/")) {
    const parts = axisLabel.split("/");
    leftLabel = parts[0]?.trim() || "Left";
    rightLabel = parts[1]?.trim() || "Right";
  }

  return (
    <div className="mt-3 space-y-2 text-emerald-100">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-200/70">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-900/70">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-600/70" />
        {/* Progress bar showing the range of movement */}
        <div
          className="absolute inset-y-0 rounded-full bg-slate-700/60"
          style={{
            left: `${progressLeft * 100}%`,
            width: `${progressWidth * 100}%`,
          }}
        />
        {/* Animated gradient bar that grows from before position to after position */}
        <motion.div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-emerald-500 via-lime-400 to-cyan-400"
          initial={{ 
            left: `${beforePercent * 100}%`,
            width: '0%'
          }}
          animate={{ 
            left: `${progressLeft * 100}%`,
            width: `${progressWidth * 100}%`
          }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        {/* Animated pointer that moves from before to after */}
        <motion.div
          className="absolute -top-2 h-5 w-5 rounded-full border-2 border-slate-950 bg-white shadow-lg"
          initial={{ left: `calc(${beforePercent * 100}% - 10px)` }}
          animate={{ left: `calc(${afterPercent * 100}% - 10px)` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        {ticks.map((tick) => (
          <div
            key={tick}
            className="absolute -bottom-2 h-2 w-px bg-slate-500/60"
            style={{ left: `${tick * 100}%` }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-emerald-200/70">
        {ticks.map((tick) => {
          const value = min + tick * (max - min);
          const label =
            Math.abs(value) < 0.001
              ? "0"
              : value > 0
              ? `+${value.toFixed(2)}`
              : value.toFixed(2);
          return (
            <span key={tick} className="w-8 text-center">
              {label}
            </span>
          );
        })}
      </div>
      <p className="text-xs text-emerald-200/80">
        Position moved from {before.toFixed(2)} to {after.toFixed(2)}
      </p>
    </div>
  );
}

