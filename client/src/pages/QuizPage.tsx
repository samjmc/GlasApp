import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Compass, RotateCcw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { QUIZ_QUESTIONS, type QuizQuestion } from '@shared/quiz';
import { DIMENSION_POLES, type IdeologyDimension } from '@shared/ideology';
import { DEFAULT_PLAN_CONFIG, answerOrder, isQuizSeed, newQuizSeed, planQuiz, responsesFor } from '@shared/quizPlan';
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/LoadingScreen';
import { EmptyState } from '@/components/pulse/EmptyState';
import { cn } from '@/lib/utils';
import { usePoliticalConsent } from '@/contexts/ConsentContext';
import { submitQuiz } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { loadDeviceSeed, loadDraft, loadStoredQuiz, storeDeviceSeed, storeDraft, storeQuiz } from '@/lib/quizStorage';

const QUIZ_STEPS = [
  { title: 'Answer', body: 'Pick the option closest to your view. Skip nothing; you can go back.' },
  { title: 'See your profile', body: 'Where you sit on each of the 8 dimensions, explained.' },
  { title: 'Find your matches', body: 'The parties and TDs whose positions are closest to yours.' },
];

const BANK = new Map(QUIZ_QUESTIONS.map((q) => [q.id, q]));

/**
 * The quiz's size before any answer: per dimension (bank order) its base questions and how many
 * follow-ups it can add, under DEFAULT_PLAN_CONFIG and this bank.
 */
const QUIZ_SHAPE = (() => {
  const { basePerDimension, followUpsPerDimension, followUpBudget } = DEFAULT_PLAN_CONFIG;
  const sizes = new Map<IdeologyDimension, number>();
  for (const q of QUIZ_QUESTIONS) sizes.set(q.dimension, (sizes.get(q.dimension) ?? 0) + 1);
  const dimensions = Array.from(sizes, ([dimension, n]) => ({
    dimension,
    base: Math.min(basePerDimension, n),
    extra: Math.min(followUpsPerDimension, Math.max(0, n - basePerDimension)),
  }));
  return {
    dimensions,
    base: dimensions.reduce((sum, d) => sum + d.base, 0),
    maxFollowUps: Math.min(followUpBudget, dimensions.reduce((sum, d) => sum + d.extra, 0)),
  };
})();

/** `?seed=` when valid. It applies to this attempt only and never becomes the device seed. */
function seedFromUrl(): number | null {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const seed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;
  return isQuizSeed(seed) ? seed : null;
}

/** A new attempt's seed: `?seed=`, else this device's seed (the same questions on a retake), else a new one. */
function attemptSeed(): number {
  const seed = seedFromUrl() ?? loadDeviceSeed();
  if (seed !== null) return seed;
  const fresh = newQuizSeed();
  storeDeviceSeed(fresh);
  return fresh;
}

/** One screen of the quiz: a question, or the note before the follow-ups. */
type Step = { kind: 'question'; question: QuizQuestion; followUp: boolean } | { kind: 'followUps' };

/** "A", "A and B", "A, B and C". */
const listOf = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** The quiz's first screen: what it is, how long it takes, and start or continue. */
function QuizStart({
  totalQuestions,
  answered,
  hasResult,
  onStart,
  onStartAgain,
}: {
  totalQuestions: number;
  answered: number;
  hasResult: boolean;
  onStart: () => void;
  onStartAgain: () => void;
}) {
  const { dimensions, base, maxFollowUps } = QUIZ_SHAPE;
  const inProgress = answered > 0;
  const [fewest, most] = [base, base + maxFollowUps].map((n) => Math.max(1, Math.round((n * 12) / 60)));
  const minutes = fewest === most ? `${fewest}` : `${fewest}–${most}`;
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-8 overflow-hidden rounded-2xl bg-hero p-6 text-hero-foreground sm:p-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
        <div className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-hero-muted px-3 py-1 text-[13px] font-bold">
            <Compass className="h-4 w-4 text-primary" aria-hidden="true" /> Ideology quiz
          </span>
          <div className="flex flex-col gap-3">
            <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-tight sm:text-6xl">
              Where do <span className="text-primary">you</span> stand?
            </h1>
            <p className="max-w-xl text-base text-hero-soft sm:text-lg">
              {base} questions on today's Irish issues
              {maxFollowUps > 0 && `, plus up to ${maxFollowUps} follow-ups where your answers aren't clear-cut`}. About{' '}
              {minutes} minutes. No sign-in needed, and your answers stay on this device until you choose to save them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={onStart} className="min-w-[200px]">
              {inProgress ? `Continue · ${answered} of ${totalQuestions} done` : 'Start the quiz'} <ArrowRight />
            </Button>
            {inProgress && (
              <Button size="lg" variant="outline" onClick={onStartAgain} className="border-hero-muted text-hero-foreground hover:bg-hero-muted">
                <RotateCcw /> Start again
              </Button>
            )}
            {hasResult && !inProgress && (
              <Button asChild size="lg" variant="outline" className="border-hero-muted text-hero-foreground hover:bg-hero-muted">
                <Link href="/quiz/results">See my last result</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          {[
            { value: maxFollowUps > 0 ? `${base}+` : base, label: 'questions' },
            { value: dimensions.length, label: 'dimensions' },
            { value: `~${minutes}`, label: 'minutes' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col rounded-xl bg-hero-muted p-4">
              <span className="font-display text-3xl font-bold leading-none">{s.value}</span>
              <span className="mt-1 text-sm text-hero-soft">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight">What it measures</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dimensions.map(({ dimension: d, base: n, extra }) => {
            const poles = DIMENSION_POLES[d];
            return (
              <li key={d} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-bold">{poles.label}</span>
                  <span className="text-xs font-semibold text-muted-foreground">{extra > 0 ? `${n}–${n + extra}` : n} Qs</span>
                </div>
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground" aria-label={`From ${poles.negative} to ${poles.positive}`}>
                  <span className="truncate">{poles.negative}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-input" aria-hidden="true">
                    <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
                  </span>
                  <span className="truncate text-right">{poles.positive}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {QUIZ_STEPS.map((step, i) => (
          <div key={step.title} className="flex gap-4 rounded-xl border bg-card p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display font-bold text-primary">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/** The political quiz. Answers are page state; the server scores them (POST /api/quiz). */
const QuizPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { ensure: ensureConsent } = usePoliticalConsent();

  // A draft keeps its seed, so a reload shows the same questions in the same answer order.
  const [initial] = useState(() => loadDraft() ?? { seed: attemptSeed(), answers: {} });
  const [seed, setSeed] = useState(initial.seed);
  // questionId -> chosen answer index
  const [answers, setAnswers] = useState<Record<number, number>>(initial.answers);
  // One absolute position in `steps`.
  const [stepIndex, setStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveIndicatorVisible, setSaveIndicatorVisible] = useState(false);
  const [started, setStarted] = useState(false);
  const [hasStoredResult] = useState(() => loadStoredQuiz() !== null);

  const saveIndicatorTimeoutRef = useRef<number | null>(null);

  const plan = useMemo(() => planQuiz(seed, answers), [seed, answers]);
  // The base, then (once it is answered and a dimension is not clear-cut) a note and the
  // follow-ups. The base depends only on the seed, so this prefix never shifts.
  const steps = useMemo<Step[]>(() => {
    const toStep = (followUp: boolean) => (id: number): Step => ({ kind: 'question', question: BANK.get(id)!, followUp });
    const base = plan.base.map(toStep(false));
    return plan.followUps.length === 0 ? base : [...base, { kind: 'followUps' }, ...plan.followUps.map(toStep(true))];
  }, [plan]);

  const index = Math.min(stepIndex, steps.length - 1);
  const step = steps[index];
  const currentQuestion = step?.kind === 'question' ? step.question : null;
  const selectedAnswerIndex = currentQuestion ? answers[currentQuestion.id] ?? null : null;

  useEffect(() => {
    storeDraft({ seed, answers });
  }, [seed, answers]);

  useEffect(() => {
    return () => {
      if (saveIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(saveIndicatorTimeoutRef.current);
      }
    };
  }, []);

  const showSavedIndicator = useCallback(() => {
    if (saveIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(saveIndicatorTimeoutRef.current);
    }
    setSaveIndicatorVisible(true);
    saveIndicatorTimeoutRef.current = window.setTimeout(() => {
      setSaveIndicatorVisible(false);
      saveIndicatorTimeoutRef.current = null;
    }, 2000);
  }, []);

  // N grows from the base to base + follow-ups once they are known.
  const totalQuestions = plan.base.length + plan.followUps.length;
  const answeredQuestionCount = plan.base.concat(plan.followUps).filter((id) => answers[id] !== undefined).length;
  const overallProgress = totalQuestions ? (answeredQuestionCount / totalQuestions) * 100 : 0;
  const questionNumber = steps.slice(0, index + 1).filter((s) => s.kind === 'question').length;
  const firstOpenStep = steps.findIndex((s) => s.kind === 'question' && answers[s.question.id] === undefined);

  const isLastStep = index === steps.length - 1;
  const isPreviousDisabled = index === 0;
  const isNextDisabled = (currentQuestion !== null && selectedAnswerIndex === null) || isSubmitting;

  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answerIndex }));
    showSavedIndicator();
  };

  const handleComplete = async () => {
    // Every question shown needs an answer; jump to the first gap.
    if (firstOpenStep >= 0) {
      const remaining = totalQuestions - answeredQuestionCount;
      setStepIndex(firstOpenStep);
      toast({ title: "Almost there", description: `${remaining} question${remaining === 1 ? '' : 's'} left.` });
      return;
    }

    // The plan's questions only: an answer to a follow-up that has left the plan is not sent.
    const responses = responsesFor(plan, answers);

    setIsSubmitting(true);
    try {
      // A saved quiz shows political opinions: ask before it is saved. Saying no still scores the
      // quiz; the server just does not keep it (result.id stays null).
      await ensureConsent();
      const result = await submitQuiz(responses, seed);
      storeQuiz(result, responses, seed);
      storeDraft(null);
      if (result.id !== null) {
        // Saved: the user's history and profile both moved.
        await queryClient.invalidateQueries({ queryKey: ["/api/quiz/me"] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.ideology.all() });
      }
      setLocation('/quiz/results');
    } catch (error) {
      console.error("Error completing quiz:", error);
      setIsSubmitting(false);
      toast({ title: "Error", description: "We couldn't score your quiz. Please try again.", variant: "destructive" });
    }
  };

  const handleNext = () => {
    if (!step) return;

    if (currentQuestion && selectedAnswerIndex === null) {
      toast({
        title: "Answer required",
        description: "Please choose an option before continuing.",
        variant: "destructive"
      });
      return;
    }

    // An absolute target from this render, not `setStepIndex((i) => i + 1)`: a double-click
    // must land on the next step, not skip one.
    if (!isLastStep) {
      setStepIndex(index + 1);
      return;
    }

    void handleComplete();
  };

  const handlePrevious = () => {
    if (index > 0) setStepIndex(index - 1);
  };

  /** Jump to the first unanswered question among the matching steps, or the first of them when all are done. */
  const goToFirst = (matches: (s: Step) => boolean) => {
    const open = steps.findIndex((s) => matches(s) && s.kind === 'question' && answers[s.question.id] === undefined);
    const first = steps.findIndex(matches);
    if (open >= 0 || first >= 0) setStepIndex(open >= 0 ? open : first);
  };

  // Answers are authored with the strongest stance first; showing them in that order biases
  // the choice. The order comes from the quiz seed, so a reload shows the same order. Answers
  // stay keyed by their original index, so scoring and a saved draft are unaffected.
  const shownOrder = useMemo(
    () => (currentQuestion ? answerOrder(seed, currentQuestion.id, currentQuestion.answers.length) : []),
    [seed, currentQuestion],
  );

  const startAgain = () => {
    setSeed(attemptSeed());
    setAnswers({});
    storeDraft(null);
    setStepIndex(0);
    setStarted(true);
  };

  const continueQuiz = () => {
    setStepIndex(firstOpenStep >= 0 ? firstOpenStep : steps.length - 1);
    setStarted(true);
  };

  if (!started) {
    return (
      <QuizStart
        totalQuestions={totalQuestions}
        answered={answeredQuestionCount}
        hasResult={hasStoredResult}
        onStart={() => (answeredQuestionCount > 0 ? continueQuiz() : startAgain())}
        onStartAgain={startAgain}
      />
    );
  }

  if (isSubmitting) {
    return <LoadingScreen message="Working out where you stand" />;
  }

  const poles = currentQuestion ? DIMENSION_POLES[currentQuestion.dimension] : null;
  const baseByDimension = QUIZ_SHAPE.dimensions.map(({ dimension }) => ({
    dimension,
    ids: plan.base.filter((id) => BANK.get(id)!.dimension === dimension),
  }));
  const dimensionsDone = baseByDimension.filter(({ ids }) => ids.every((id) => answers[id] !== undefined)).length;
  const isFollowUpStep = (s: Step) => s.kind === 'followUps' || s.followUp;
  const onFollowUps = step !== undefined && isFollowUpStep(step);
  // The sidebar: each dimension's base, then the follow-ups once there are any.
  const progressRows = [
    ...baseByDimension.map(({ dimension, ids }, i) => ({
      key: dimension,
      badge: i + 1,
      label: DIMENSION_POLES[dimension].label,
      done: ids.filter((id) => answers[id] !== undefined).length,
      total: ids.length,
      current: !onFollowUps && currentQuestion?.dimension === dimension,
      go: () => goToFirst((s) => s.kind === 'question' && !s.followUp && s.question.dimension === dimension),
    })),
    ...(plan.followUps.length > 0
      ? [{
          key: 'follow-ups',
          badge: '+',
          label: 'Follow-ups',
          done: plan.followUps.filter((id) => answers[id] !== undefined).length,
          total: plan.followUps.length,
          current: onFollowUps,
          go: () => goToFirst(isFollowUpStep),
        }]
      : []),
  ];
  const followUpLabels = listOf(plan.followUpDimensions.map((d) => DIMENSION_POLES[d].label));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">
            Where do <span className="text-primary">you</span> stand?
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {totalQuestions} questions across {QUIZ_SHAPE.dimensions.length} dimensions. Answers save on this device as you go.
          </p>
        </div>
        <Button asChild variant="outline" className="self-start sm:self-auto">
          <Link href="/">Save and leave</Link>
        </Button>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {(poles || onFollowUps) && (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex h-8 items-center gap-2 rounded-full bg-elevated px-3.5 text-sm font-bold">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    {poles ? poles.label : 'Follow-ups'}
                  </span>
                  {poles && (
                    <span className="truncate text-sm font-semibold text-muted-foreground">
                      {poles.negative} ↔ {poles.positive}
                    </span>
                  )}
                </div>
              )}
              {currentQuestion && (
                <span className="text-sm font-bold">
                  Question {questionNumber} <span className="text-muted-foreground">of {totalQuestions}</span>
                </span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={0}
              aria-valuemax={totalQuestions}
              aria-valuenow={answeredQuestionCount}
              className="h-2 overflow-hidden rounded-full bg-input"
            >
              <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${overallProgress}%` }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {currentQuestion ? (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-6"
                data-testid="quiz-question"
                data-question-id={currentQuestion.id}
              >
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-[34px]">
                  {currentQuestion.text}
                </h2>

                <div role="radiogroup" aria-label="Answers" className="flex flex-col gap-3">
                  {shownOrder.map((answerIndex) => {
                    const answer = currentQuestion.answers[answerIndex];
                    const isSelected = selectedAnswerIndex === answerIndex;
                    return (
                      <button
                        key={answerIndex}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        data-testid="quiz-answer"
                        data-answer-index={answerIndex}
                        onClick={() => handleAnswerSelect(answerIndex)}
                        className={cn(
                          "flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors active:scale-[0.99] sm:p-5",
                          isSelected ? "border-primary bg-primary/10" : "border-transparent bg-elevated hover:border-input"
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          )}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                        </span>
                        <span className="flex flex-col gap-1">
                          <span className="text-base font-bold leading-snug sm:text-[17px]">{answer.text}</span>
                          {answer.description && (
                            <span className="text-sm leading-relaxed text-muted-foreground">{answer.description}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : step?.kind === 'followUps' ? (
              <motion.div
                key="follow-ups"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-3"
                data-testid="quiz-follow-ups"
              >
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-[34px]">A few more questions</h2>
                <p className="text-base text-muted-foreground sm:text-lg">
                  Your first answers on {followUpLabels} weren't clear-cut, so we'll ask {plan.followUps.length} more.
                </p>
              </motion.div>
            ) : (
              <EmptyState title="No questions found" />
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="lg" onClick={handlePrevious} disabled={isPreviousDisabled}>
              <ArrowLeft /> Back
            </Button>
            <span
              aria-live="polite"
              className={cn(
                "ml-auto flex items-center gap-1.5 text-sm font-semibold text-primary transition-opacity",
                saveIndicatorVisible ? "opacity-100" : "opacity-0"
              )}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Saved
            </span>
            <Button size="lg" onClick={handleNext} disabled={isNextDisabled} className="min-w-[140px]">
              {isLastStep ? 'See my results' : currentQuestion ? 'Next' : 'Continue'} <ArrowRight />
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-bold">Your progress</h2>
            <p className="text-sm text-muted-foreground">
              {answeredQuestionCount} of {totalQuestions} answered · {dimensionsDone} of {baseByDimension.length} dimensions done
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {progressRows.map(({ key, badge, label, done, total, current, go }) => {
              const complete = done === total;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={go}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors",
                      current ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold",
                        complete ? "border-primary bg-primary text-primary-foreground" : current ? "border-primary" : "border-input"
                      )}
                    >
                      {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : badge}
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {done}/{total}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
};

export default QuizPage;
