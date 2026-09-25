import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ExternalLink, Flame, Landmark, Loader2, Share2, SkipForward, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { MultipleChoiceVoteControl } from "@/components/votes/MultipleChoiceVoteControl";
import { cn } from "@/lib/utils";

type Step = "prompt" | "vote" | "payoff" | "streakShare";
type VoteSubStep = "preview" | "question";

const stepVariants = {
  hidden: { opacity: 0, x: 32 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: "easeOut" } },
  exit: { opacity: 0, x: -32, transition: { duration: 0.15, ease: "easeIn" } },
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

/** "Economic Left - Right" → { name: "Economic", left: "Left", right: "Right" }; also handles "Left/Right". */
function parseAxisLabel(axisLabel: string) {
  if (axisLabel.includes(" - ")) {
    const [leftPart, rightPart] = axisLabel.split(" - ").map((p) => p.trim());
    const words = leftPart.split(" ");
    return {
      name: words.length > 1 ? words.slice(0, -1).join(" ") : leftPart,
      left: words[words.length - 1] || "Left",
      right: rightPart || "Right",
    };
  }
  if (axisLabel.includes("/")) {
    const [l, r] = axisLabel.split("/");
    return { name: axisLabel, left: l?.trim() || "Left", right: r?.trim() || "Right" };
  }
  return { name: axisLabel, left: "Left", right: "Right" };
}

type Chord = { f: number[]; delay?: number; volume: number; decay: number; detune?: number; pan?: number; filter?: number };
const SOUNDS: Record<"start" | "advance" | "card" | "complete" | "share" | "select", Chord[]> = {
  start: [
    { f: [261.63, 329.63, 392], volume: 0.32, decay: 0.72, detune: 4, pan: 0.4, filter: 5 },
    { f: [329.63, 415.3, 523.25], delay: 0.22, volume: 0.28, decay: 0.64, detune: 3, pan: 0.42, filter: 5.2 },
    { f: [392, 523.25, 659.26], delay: 0.42, volume: 0.26, decay: 0.58, detune: 2, pan: 0.45, filter: 5.4 },
  ],
  advance: [
    { f: [523.25, 659.25, 783.99], volume: 0.26, decay: 0.4, detune: 2, pan: 0.32, filter: 5.6 },
    { f: [659.25, 783.99, 987.77], delay: 0.18, volume: 0.24, decay: 0.36, detune: 2, pan: 0.34, filter: 5.8 },
  ],
  card: [{ f: [440, 554.37, 659.26], volume: 0.2, decay: 0.32, detune: 1.5, pan: 0.3, filter: 5.4 }],
  complete: [
    { f: [261.63, 329.63, 392, 523.25], volume: 0.34, decay: 0.88, detune: 4, pan: 0.5, filter: 5.4 },
    { f: [392, 493.88, 587, 659.26], delay: 0.32, volume: 0.3, decay: 0.76, detune: 3, pan: 0.48, filter: 5.6 },
    { f: [659.26, 783.99, 987.77], delay: 0.64, volume: 0.26, decay: 0.68, detune: 2, pan: 0.52, filter: 5.8 },
  ],
  share: [
    { f: [329.63, 415.3, 523.25], volume: 0.24, decay: 0.52, detune: 2, pan: 0.36, filter: 5.2 },
    { f: [392, 523.25, 659.26], delay: 0.22, volume: 0.22, decay: 0.5, detune: 2, pan: 0.38, filter: 5.4 },
  ],
  select: [{ f: [880], volume: 0.14, decay: 0.22, detune: 0, pan: 0.18, filter: 6.2 }],
};

export default function DailySessionPage() {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState<Step>("prompt");
  const [voteSubStep, setVoteSubStep] = useState<VoteSubStep>("preview");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingOption, setPendingOption] = useState<string | null>(null);
  const [localSummary, setLocalSummary] = useState<DailySessionCompletion | null>(null);
  const [savedDimension, setSavedDimension] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isCompletionPending, setIsCompletionPending] = useState(false);
  const [isDevSkipping, setIsDevSkipping] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [localVotesCompleted, setLocalVotesCompleted] = useState(0);

  const sessionQuery = useDailySession(isAuthenticated);
  const voteMutation = useDailySessionVote();
  const completeMutation = useCompleteDailySession();
  const { toast } = useToast();

  const session = sessionQuery.data as unknown as DailySessionState | undefined;
  const isLoading = sessionQuery.isLoading || sessionQuery.isFetching;

  const play = useCallback((name: keyof typeof SOUNDS) => {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioContextRef.current) audioContextRef.current = new Ctor();
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    for (const { f, delay = 0, volume, decay, detune = 4, pan = 0.25, filter: filterMul = 5 } of SOUNDS[name]) {
      const base = ctx.currentTime + delay;
      f.forEach((freq, index) => {
        const t = base + index * 0.012;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(freq * filterMul, t);
        filter.Q.setValueAtTime(0.9, t);
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const cents = detune === 0 ? 0 : (Math.random() - 0.5) * detune * 2;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * Math.pow(2, cents / 1200), t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(volume * Math.max(0.4, 1 - index * 0.12), t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay + index * 0.05);
        osc.connect(filter);
        if (panner) {
          panner.pan.setValueAtTime((Math.random() * 2 - 1) * Math.min(1, pan), t);
          filter.connect(panner);
          panner.connect(gain);
        } else {
          filter.connect(gain);
        }
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + decay + 0.4);
      });
    }
  }, []);

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
    setVoteSubStep("preview"); // Reset to preview when moving to a new item
  }, [currentIndex, step]);

  const currentItem: DailySessionItem | undefined = useMemo(() => session?.items?.[currentIndex], [session, currentIndex]);

  const totalItems = session?.items.length ?? 0;
  const votesCompleted =
    session?.status === "completed" ? totalItems : Math.max(localVotesCompleted, session?.voteCount ?? 0);

  const isProcessing =
    voteMutation.isPending || completeMutation.isPending || isAdvancing || isCompletionPending || isDevSkipping;
  const isDevMode = import.meta.env.DEV;

  const completionSummary = localSummary ?? session?.completion ?? null;
  const currentStreakCount = completionSummary?.streakCount ?? session?.streakCount ?? 0;
  const previousStreakCount = Math.max(0, currentStreakCount - 1);

  const handleStart = () => {
    play("start");
    setStep("vote");
    setCurrentIndex(0);
    setSavedDimension(null);
    setPendingOption(session?.items[0]?.selectedOption ?? null);
    play("card");
  };

  const handleVoteNext = async () => {
    if (!currentItem || pendingOption === null || isAdvancing) return;
    const optionKey = pendingOption;
    setIsAdvancing(true);
    play("advance");

    let updatedSession: DailySessionState | null = null;

    try {
      let attempt = 0;
      while (attempt < 2) {
        try {
          updatedSession = await voteMutation.mutateAsync({
            sessionItemId: currentItem.sessionItemId,
            optionKey,
          });
          break;
        } catch (mutationError: unknown) {
          const message = (mutationError as { message?: string } | null)?.message || "";
          const shouldRetry = attempt === 0 && message.toLowerCase().includes("failed to fetch");
          if (!shouldRetry) throw mutationError;
          await new Promise((resolve) => setTimeout(resolve, 250));
          attempt += 1;
        }
      }

      if (!updatedSession) throw new Error("Vote request failed");

      setSavedDimension(mapDimensionLabel(currentItem.policyDimension));
    } catch (error: unknown) {
      setIsAdvancing(false);
      toast({
        variant: "destructive",
        title: "Vote not recorded",
        description: (error as { message?: string } | null)?.message || "Please try that stance again.",
      });
      return;
    }

    const itemCount = updatedSession?.items.length ?? session?.items.length ?? 0;
    const hasMorePending =
      updatedSession?.items.some((item) => !item.hasVoted || item.sessionItemId === currentItem.sessionItemId) ?? false;
    const isFinalVote = itemCount === 0 || currentIndex + 1 >= itemCount || !hasMorePending;
    const nextIndex = itemCount > 0 ? Math.min(currentIndex + 1, itemCount - 1) : 0;

    if (isFinalVote) setIsCompletionPending(true);

    setTimeout(async () => {
      setPendingOption(null);
      setSavedDimension(null);
      setIsAdvancing(false);

      if (!isFinalVote) {
        const nextCount = updatedSession?.voteCount ?? votesCompleted + 1;
        setLocalVotesCompleted(Math.min(nextCount, itemCount));
        setCurrentIndex(nextIndex);
        play("card");
        return;
      }

      try {
        const summary = await completeMutation.mutateAsync();
        setLocalSummary(summary);
        const finalCount = updatedSession?.voteCount ?? itemCount;
        setLocalVotesCompleted(Math.min(finalCount, itemCount));
        play("complete");
        setStep("payoff");
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Could not finish the session",
          description: (error as { message?: string } | null)?.message || "We couldn’t finish the session. Please retry.",
        });
      } finally {
        setIsCompletionPending(false);
      }
    }, 720);
  };

  const handleShare = useCallback(async () => {
    const url = window.location.origin;
    const text = `I'm on a ${currentStreakCount}-day streak on Glas Politics.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Glas Politics", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast({ title: "Link copied", description: "Paste it anywhere." });
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return;
      toast({ variant: "destructive", title: "Could not share", description: "Please try again." });
    }
  }, [currentStreakCount, toast]);

  const handleShowStreakBoost = () => {
    play("share");
    setStep("streakShare");
  };

  const handleDevSkipSession = useCallback(async () => {
    if (!isDevMode || !session || session.items.length === 0) return;

    try {
      setIsDevSkipping(true);
      setIsCompletionPending(true);
      setIsAdvancing(true);
      setSavedDimension(null);

      // Dev only: answer each remaining question with its first option.
      let latestSession = session;
      for (const item of session.items) {
        const firstOption = Object.keys(item.answerOptions)[0];
        if (item.hasVoted || !firstOption) continue;
        latestSession = await voteMutation.mutateAsync({
          sessionItemId: item.sessionItemId,
          optionKey: firstOption,
        });
      }

      const summary = await completeMutation.mutateAsync();
      setLocalSummary(summary);
      setLocalVotesCompleted(latestSession.items.length);
      setStep("payoff");
      toast({ title: "Session skipped", description: "Marked as completed (dev mode)." });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Skip failed",
        description: (error as { message?: string } | null)?.message || "Could not skip the session.",
      });
    } finally {
      setIsAdvancing(false);
      setIsDevSkipping(false);
      setIsCompletionPending(false);
    }
  }, [isDevMode, session, voteMutation, completeMutation, toast]);

  const devSkip =
    isDevMode && (step === "prompt" || step === "vote") ? (
      <Button size="icon-sm" variant="ghost" onClick={handleDevSkipSession} disabled={isProcessing} aria-label="Skip session (dev only)">
        <SkipForward className="h-4 w-4" />
      </Button>
    ) : null;

  if (!isAuthenticated) {
    return (
      <Shell>
        <TopBar left={<CloseLink />} title="Daily vote" />
        <div className="flex flex-1 flex-col justify-center gap-4 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Sign in for your daily vote</h1>
          <p className="text-muted-foreground">Three quick stances a day keep your profile and TD matches up to date.</p>
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (sessionQuery.isError && !session) {
    return (
      <Shell>
        <TopBar left={<CloseLink />} title="Daily vote" />
        <div className="flex flex-1 flex-col justify-center gap-4 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Your daily vote did not load</h1>
          <p className="text-muted-foreground">Check your connection, then try again.</p>
          <Button size="lg" onClick={() => sessionQuery.refetch()} disabled={sessionQuery.isFetching}>
            {sessionQuery.isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
            {sessionQuery.isFetching ? "Loading…" : "Try again"}
          </Button>
        </div>
      </Shell>
    );
  }

  if (isLoading || !session) {
    return (
      <Shell>
        <TopBar left={<CloseLink />} title="Daily vote" />
        <div className="flex flex-1 flex-col gap-4 pt-3" aria-busy="true" aria-label="Loading your daily session">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="mt-auto h-14 w-full rounded-lg" />
        </div>
      </Shell>
    );
  }

  if (totalItems === 0) {
    return (
      <Shell>
        <TopBar left={<CloseLink />} title="Daily vote" />
        <div className="flex flex-1 flex-col justify-center gap-4 text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">No questions today</h1>
          <p className="text-muted-foreground">There is nothing to vote on yet. Check back later today.</p>
          <Button asChild size="lg">
            <Link href="/">Back home</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  const progressDone = step === "vote" ? currentIndex + (savedDimension ? 1 : 0) : totalItems;

  return (
    <Shell>
      {step === "prompt" && (
        <IntroScreen
          streak={session.streakCount}
          items={session.items}
          onStart={handleStart}
          isStarting={voteMutation.isPending || completeMutation.isPending}
          devSkip={devSkip}
        />
      )}

      {step === "vote" && (
        <>
          <TopBar
            left={
              voteSubStep === "question" && !isProcessing ? (
                <RoundButton onClick={() => setVoteSubStep("preview")} label="Back to the question">
                  <ChevronLeft className="h-5 w-5" />
                </RoundButton>
              ) : (
                <CloseLink />
              )
            }
            center={<ProgressSegments total={totalItems} done={progressDone} current={currentIndex} />}
            right={
              <span className="flex items-center gap-1">
                {devSkip}
                <span className="text-sm font-bold text-muted-foreground tabular-nums">
                  {currentIndex + 1} of {totalItems}
                </span>
              </span>
            }
          />
          <AnimatePresence mode="wait">
            {isCompletionPending ? (
              <CompletionTransition key="completion-transition" />
            ) : savedDimension ? (
              <SavedScreen key="saved" dimension={savedDimension} />
            ) : (
              currentItem &&
              (voteSubStep === "preview" ? (
                <ArticlePreviewScreen
                  key={`${currentItem.sessionItemId}-preview`}
                  item={currentItem}
                  remaining={totalItems - currentIndex - 1}
                  onNext={() => setVoteSubStep("question")}
                />
              ) : (
                <VoteScreen
                  key={`${currentItem.sessionItemId}-question`}
                  item={currentItem}
                  isLast={currentIndex + 1 === totalItems}
                  onNext={handleVoteNext}
                  isNextDisabled={isProcessing || pendingOption === null}
                  isProcessing={isProcessing}
                  pendingOption={pendingOption}
                  setPendingOption={setPendingOption}
                  playSelectSound={() => play("select")}
                />
              ))
            )}
          </AnimatePresence>
        </>
      )}

      {step === "payoff" && completionSummary && (
        <PayoffScreen
          summary={completionSummary}
          total={totalItems}
          onNext={handleShowStreakBoost}
          isCompleting={completeMutation.isPending}
        />
      )}

      {step === "streakShare" && completionSummary && (
        <StreakBoostScreen
          previousStreak={previousStreakCount}
          currentStreak={currentStreakCount}
          onBack={() => setStep("payoff")}
          onShare={handleShare}
        />
      )}
    </Shell>
  );
}

/* ---------- Layout pieces ---------- */

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-background text-foreground">
      <main className="flex min-h-[100dvh] w-full max-w-md flex-col px-4 pb-6 pt-2">{children}</main>
    </div>
  );
}

function TopBar({ left, center, right, title }: { left: ReactNode; center?: ReactNode; right?: ReactNode; title?: string }) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-3.5">
      <div className="shrink-0">{left}</div>
      <div className="flex min-w-0 flex-1 justify-center">
        {center ?? (title && <span className="text-[15px] font-bold">{title}</span>)}
      </div>
      <div className="flex min-w-11 shrink-0 justify-end">{right}</div>
    </div>
  );
}

const roundClass =
  "flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function CloseLink() {
  return (
    <Link href="/" aria-label="Close daily vote" className={roundClass}>
      <X className="h-5 w-5" />
    </Link>
  );
}

function RoundButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={roundClass}>
      {children}
    </button>
  );
}

function ProgressSegments({ total, done, current }: { total: number; done: number; current: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Question progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(done, total)}
      className="grid w-full gap-1.5"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-colors duration-200",
            i < done ? "bg-primary" : i === current ? "bg-foreground" : "bg-elevated"
          )}
        />
      ))}
    </div>
  );
}

function StepPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={cn("flex flex-1 flex-col", className)}
      variants={stepVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

function PrimaryAction({ children, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button size="lg" className="h-14 w-full text-[17px] font-extrabold" {...props}>
      {children}
    </Button>
  );
}

/* ---------- Steps ---------- */

function IntroScreen({
  streak,
  items,
  onStart,
  isStarting,
  devSkip,
}: {
  streak: number;
  items: DailySessionItem[];
  onStart: () => void;
  isStarting: boolean;
  devSkip: ReactNode;
}) {
  const today = new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <TopBar left={<CloseLink />} title="Daily vote" right={devSkip} />
      <StepPanel className="gap-5 pt-3">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-bold text-primary">{today}</span>
          <h1 className="font-display text-[40px] font-extrabold leading-none tracking-tight sm:text-[44px]">
            {items.length === 1 ? "One quick stance." : `${items.length} quick stances.`} About 30 seconds.
          </h1>
          <p className="text-[17px] leading-relaxed text-muted-foreground">
            Today&apos;s issues come from the news you follow. Your answers shape your profile and your TD matches.
          </p>
        </div>

        <section className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-elevated text-warn">
            <Flame className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-muted-foreground">Your streak</span>
            <span className="font-display text-[22px] font-bold">
              {streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} running` : "Start your streak"}
            </span>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-muted-foreground">Today</h2>
          <ol className="flex flex-col gap-2">
            {items.map((item, i) => (
              <li key={item.sessionItemId} className="flex min-h-[52px] items-center gap-3 rounded-lg bg-card px-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elevated text-[13px] font-extrabold">
                  {item.hasVoted ? <Check className="h-4 w-4 text-primary" aria-label="Answered" /> : i + 1}
                </span>
                <span className="truncate text-[15px] font-bold">{mapDimensionLabel(item.policyDimension)}</span>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-auto">
          <PrimaryAction onClick={onStart} disabled={isStarting}>
            Start
          </PrimaryAction>
        </div>
      </StepPanel>
    </>
  );
}

function ArticlePreviewScreen({ item, remaining, onNext }: { item: DailySessionItem; remaining: number; onNext: () => void }) {
  return (
    <StepPanel className="gap-4 pt-4">
      <div className="relative flex flex-1 flex-col pb-6">
        {remaining >= 2 && (
          <div aria-hidden="true" className="absolute inset-x-7 bottom-0 h-16 rounded-2xl border bg-card opacity-50" />
        )}
        {remaining >= 1 && (
          <div aria-hidden="true" className="absolute inset-x-3.5 bottom-2.5 h-16 rounded-2xl border bg-card opacity-75" />
        )}
        <article className="relative flex flex-1 flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 sm:p-6">
          <span className="inline-flex h-[30px] w-fit items-center gap-1.5 rounded-full bg-elevated px-3 text-[13px] font-bold">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            {mapDimensionLabel(item.policyDimension)}
          </span>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="aspect-video w-full rounded-xl bg-elevated object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <h1 className="font-display text-[28px] font-extrabold leading-[1.08] tracking-tight sm:text-[32px]">{item.headline}</h1>
          {item.summary && <p className="text-base leading-relaxed text-muted-foreground">{item.summary}</p>}
          {item.articleUrl && (
            <a
              href={item.articleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              Read the full article
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </article>
      </div>
      <PrimaryAction onClick={onNext}>
        Vote on this
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </PrimaryAction>
    </StepPanel>
  );
}

function VoteScreen({
  item,
  isLast,
  onNext,
  isNextDisabled,
  isProcessing,
  pendingOption,
  setPendingOption,
  playSelectSound,
}: {
  item: DailySessionItem;
  isLast: boolean;
  onNext: () => void;
  isNextDisabled: boolean;
  isProcessing: boolean;
  pendingOption: string | null;
  setPendingOption: (option: string | null) => void;
  playSelectSound: () => void;
}) {
  const promptCopy = item.prompt || `Do you support or oppose: ${item.headline}?`;
  const contextNote = item.contextNote && !/^focus:/i.test(item.contextNote.trim()) ? item.contextNote : null;

  return (
    <StepPanel className="gap-4 pt-5">
      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-primary">{mapDimensionLabel(item.policyDimension)} stance check</span>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.1] tracking-tight">{promptCopy}</h1>
        {contextNote && (
          <p className="flex gap-2.5 rounded-lg bg-elevated p-3 text-sm leading-snug text-muted-foreground">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {contextNote}
          </p>
        )}
      </div>

      <MultipleChoiceVoteControl
        options={item.answerOptions}
        selectedOption={pendingOption ?? item.selectedOption ?? null}
        onSelect={(optionKey) => {
          setPendingOption(optionKey);
          playSelectSound();
        }}
        disabled={isProcessing}
      />

      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        <PrimaryAction onClick={onNext} disabled={isNextDisabled}>
          {isProcessing && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {isProcessing ? "Saving…" : isLast ? "Save and finish" : "Save answer"}
        </PrimaryAction>
        <span className="text-center text-[13px] text-muted-foreground">
          {pendingOption === null ? "Pick one answer to continue." : "You can change this later in My politics."}
        </span>
      </div>
    </StepPanel>
  );
}

function SavedScreen({ dimension }: { dimension: string }) {
  return (
    <motion.div
      role="status"
      className="flex flex-1 flex-col items-center gap-3 pt-12 text-center"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full border-[3px] border-primary bg-primary/15 text-primary">
        <Check className="h-11 w-11" strokeWidth={2.6} aria-hidden="true" />
      </span>
      <h1 className="font-display text-[38px] font-extrabold leading-none tracking-tight">Answer saved</h1>
      <p className="text-base text-muted-foreground">
        This shapes your <strong className="text-foreground">{dimension.toLowerCase()}</strong> profile.
      </p>
    </motion.div>
  );
}

function CompletionTransition() {
  return (
    <motion.div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p className="font-display text-xl font-bold">Adding up today&apos;s answers…</p>
    </motion.div>
  );
}

function StreakHero({ streak, compact }: { streak: number; compact?: boolean }) {
  return (
    <section className="flex flex-col items-center gap-1 rounded-2xl bg-hero px-4 pb-6 pt-5 text-center text-hero-foreground">
      <span className="text-sm font-bold text-hero-soft">Session complete</span>
      <motion.div
        className="flex items-center gap-2.5"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
      >
        <Flame className={cn("text-warn", compact ? "h-10 w-10" : "h-12 w-12")} aria-hidden="true" />
        <span className={cn("font-display font-extrabold leading-none tracking-tighter", compact ? "text-[88px]" : "text-[112px]")}>
          {streak}
        </span>
      </motion.div>
      <span className="font-display text-2xl font-bold">day streak</span>
      <span className="pt-2.5 text-sm text-hero-soft">Come back tomorrow for day {streak + 1}</span>
    </section>
  );
}

function PayoffScreen({
  summary,
  total,
  onNext,
  isCompleting,
}: {
  summary: DailySessionCompletion;
  total: number;
  onNext: () => void;
  isCompleting: boolean;
}) {
  const dimensionShifts = (summary.dimensionShifts || []).slice(0, 3);

  return (
    <>
      <TopBar left={<CloseLink />} center={<span className="text-sm font-bold text-primary">{total} of {total} answered</span>} />
      <StepPanel className="gap-4">
        <h1 className="sr-only">Session complete</h1>
        <StreakHero streak={summary.streakCount} />

        {summary.ideologySummary && <p className="text-sm leading-relaxed text-muted-foreground">{summary.ideologySummary}</p>}

        <section className="flex flex-col gap-3.5 rounded-xl border bg-card p-4">
          <h2 className="font-display text-xl font-bold">What moved today</h2>
          {dimensionShifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Your answers kept every dimension stable today.</p>
          ) : (
            dimensionShifts.map((shift) => <ShiftRow key={shift.ideologyDimension} shift={shift} />)
          )}
        </section>

        {summary.regionSummary && (
          <p className="rounded-xl bg-elevated px-4 py-3 text-sm text-muted-foreground">{summary.regionSummary}</p>
        )}

        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <PrimaryAction onClick={onNext} disabled={isCompleting}>
            See my streak
          </PrimaryAction>
          <Button asChild variant="ghost" className="h-11 w-full">
            <Link href="/my-politics">See my politics</Link>
          </Button>
        </div>
      </StepPanel>
    </>
  );
}

function ShiftRow({ shift }: { shift: DailySessionCompletion["dimensionShifts"][number] }) {
  const axis = parseAxisLabel(shift.axisLabel);
  const pos = (v: number) => `${((Math.min(Math.max(v, -10), 10) + 10) / 20) * 100}%`;
  const delta = shift.after - shift.before;
  const toward = shift.direction === "left" ? axis.left : shift.direction === "right" ? axis.right : "centre";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-bold">{axis.name}</span>
        <span className="text-[13px] font-bold text-primary">
          {delta >= 0 ? "+" : "−"}
          {Math.abs(delta).toFixed(1)} toward {toward}
        </span>
      </div>
      <div
        className="relative h-2 rounded-full bg-elevated"
        role="img"
        aria-label={`${axis.name}: moved from ${shift.before.toFixed(1)} to ${shift.after.toFixed(1)}`}
      >
        <span className="absolute -top-[3px] left-1/2 h-3.5 w-0.5 bg-input" />
        <span
          className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-muted-foreground bg-card"
          style={{ left: pos(shift.before) }}
        />
        <motion.span
          className="absolute -top-[3px] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-primary"
          initial={{ left: pos(shift.before) }}
          animate={{ left: pos(shift.after) }}
          transition={{ duration: 0.6, ease: "easeInOut", delay: 0.3 }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{axis.left}</span>
        <span>{axis.right}</span>
      </div>
    </div>
  );
}

function StreakBoostScreen({
  previousStreak,
  currentStreak,
  onBack,
  onShare,
}: {
  previousStreak: number;
  currentStreak: number;
  onBack: () => void;
  onShare: () => void;
}) {
  const streakDelta = Math.max(0, currentStreak - previousStreak);

  return (
    <>
      <TopBar
        left={
          <RoundButton onClick={onBack} label="Back to results">
            <ChevronLeft className="h-5 w-5" />
          </RoundButton>
        }
        title="Streak"
      />
      <StepPanel className="gap-6 pt-2">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-display text-[38px] font-extrabold leading-none tracking-tight">Streak boosted</h1>
          <div className="flex items-center gap-3">
            <span className="flex h-12 items-center rounded-full bg-elevated px-4 text-lg font-bold text-muted-foreground">
              {previousStreak} day{previousStreak === 1 ? "" : "s"}
            </span>
            <ArrowRight className="h-7 w-7 text-primary" aria-hidden="true" />
            <motion.span
              className="flex h-16 items-center gap-2 rounded-full bg-primary px-6 text-primary-foreground"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 240, damping: 16, delay: 0.15 }}
            >
              <Flame className="h-6 w-6" aria-hidden="true" />
              <span className="font-display text-4xl font-extrabold">{currentStreak}</span>
              <span className="text-lg font-bold">day{currentStreak === 1 ? "" : "s"}</span>
            </motion.span>
          </div>
          {streakDelta > 0 && (
            <span className="text-[15px] text-muted-foreground">
              +{streakDelta} day{streakDelta === 1 ? "" : "s"} locked in
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <PrimaryAction onClick={onShare}>
            <Share2 className="h-5 w-5" aria-hidden="true" />
            Share my streak
          </PrimaryAction>
          <Button asChild variant="ghost" className="h-11 w-full">
            <Link href="/">Finish</Link>
          </Button>
        </div>
      </StepPanel>
    </>
  );
}
