import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from '@shared/quiz';
import { DIMENSION_POLES, type IdeologyDimension } from '@shared/ideology';
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/LoadingScreen';
import { EmptyState } from '@/components/pulse/EmptyState';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { cn } from '@/lib/utils';
import { submitQuiz } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { loadDraft, storeDraft, storeQuiz } from '@/lib/quizStorage';

/** The political quiz. Answers are page state; the server scores them (POST /api/quiz). */
const QuizPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { trackQuizStart, trackActivity } = useActivityTracker();

  // Questions grouped by the dimension they measure, in bank order.
  const { questionsByDimension, dimensionOrder } = useMemo(() => {
    const grouped = {} as Record<IdeologyDimension, QuizQuestion[]>;
    const order: IdeologyDimension[] = [];
    QUIZ_QUESTIONS.forEach((question) => {
      if (!grouped[question.dimension]) {
        grouped[question.dimension] = [];
        order.push(question.dimension);
      }
      grouped[question.dimension].push(question);
    });
    return { questionsByDimension: grouped, dimensionOrder: order };
  }, []);

  // questionId -> chosen answer index
  const [answers, setAnswers] = useState<Record<number, number>>(loadDraft);
  const [dimensionIndex, setDimensionIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveIndicatorVisible, setSaveIndicatorVisible] = useState(false);

  const saveIndicatorTimeoutRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);

  const activeDimension = dimensionOrder[dimensionIndex];
  const currentDimensionQuestions = questionsByDimension[activeDimension] ?? [];
  const currentQuestion = currentDimensionQuestions[currentQuestionIndex];
  const selectedAnswerIndex = currentQuestion ? answers[currentQuestion.id] ?? null : null;

  useEffect(() => {
    storeDraft(answers);
  }, [answers]);

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

  const totalQuestions = QUIZ_QUESTIONS.length;
  const answeredQuestionCount = QUIZ_QUESTIONS.filter((q) => answers[q.id] !== undefined).length;
  const overallProgress = totalQuestions ? (answeredQuestionCount / totalQuestions) * 100 : 0;
  const questionNumber = currentQuestion ? QUIZ_QUESTIONS.findIndex((q) => q.id === currentQuestion.id) + 1 : 0;

  const isLastQuestion =
    currentQuestionIndex === currentDimensionQuestions.length - 1 &&
    dimensionIndex === dimensionOrder.length - 1;
  const isPreviousDisabled = currentQuestionIndex === 0 && dimensionIndex === 0;
  const isNextDisabled = selectedAnswerIndex === null || isSubmitting;

  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answerIndex }));
    if (!hasTrackedStartRef.current) {
      trackQuizStart();
      hasTrackedStartRef.current = true;
    }
    showSavedIndicator();
  };

  const handleComplete = async () => {
    // Every question needs an answer; jump to the first gap.
    const firstGap = dimensionOrder.findIndex((d) =>
      questionsByDimension[d].some((q) => answers[q.id] === undefined)
    );
    if (firstGap >= 0) {
      const gapDimension = dimensionOrder[firstGap];
      const gapQuestions = questionsByDimension[gapDimension];
      const remaining = gapQuestions.filter((q) => answers[q.id] === undefined).length;
      setDimensionIndex(firstGap);
      setCurrentQuestionIndex(gapQuestions.findIndex((q) => answers[q.id] === undefined));
      toast({
        title: "Almost there",
        description: `${remaining} question${remaining === 1 ? '' : 's'} left in ${DIMENSION_POLES[gapDimension].label}.`,
      });
      return;
    }

    const responses: QuizResponse[] = QUIZ_QUESTIONS.map((q) => ({ questionId: q.id, answerIndex: answers[q.id] }));

    setIsSubmitting(true);
    try {
      const result = await submitQuiz(responses);
      storeQuiz(result, responses);
      storeDraft(null);
      if (result.id !== null) {
        // Saved: the user's history and profile both moved.
        await queryClient.invalidateQueries({ queryKey: ["/api/quiz/me"] });
        await queryClient.invalidateQueries({ queryKey: queryKeys.ideology.all() });
      }
      trackActivity('completed_quiz', { category: 'political_engagement', totalQuestions, answeredQuestions: answeredQuestionCount });
      setLocation('/quiz/results');
    } catch (error) {
      console.error("Error completing quiz:", error);
      setIsSubmitting(false);
      toast({ title: "Error", description: "We couldn't score your quiz. Please try again.", variant: "destructive" });
    }
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    if (selectedAnswerIndex === null) {
      toast({
        title: "Answer required",
        description: "Please choose an option before continuing.",
        variant: "destructive"
      });
      return;
    }

    trackActivity('quiz_answered', {
      category: currentQuestion.dimension,
      questionId: currentQuestion.id,
      answerType: 'option'
    });

    // Absolute targets, not `index + 1`: a double-click must land on the same question,
    // not skip past the end of the dimension.
    if (currentQuestionIndex < currentDimensionQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      return;
    }

    if (dimensionIndex < dimensionOrder.length - 1) {
      setDimensionIndex(dimensionIndex + 1);
      setCurrentQuestionIndex(0);
      return;
    }

    void handleComplete();
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      return;
    }
    if (dimensionIndex > 0) {
      const previousQuestions = questionsByDimension[dimensionOrder[dimensionIndex - 1]];
      setDimensionIndex(dimensionIndex - 1);
      setCurrentQuestionIndex(Math.max(0, previousQuestions.length - 1));
    }
  };

  /** Jump to a dimension's first unanswered question (or its first question when all are done). */
  const goToDimension = (index: number) => {
    const questions = questionsByDimension[dimensionOrder[index]];
    const firstOpen = questions.findIndex((q) => answers[q.id] === undefined);
    setDimensionIndex(index);
    setCurrentQuestionIndex(firstOpen >= 0 ? firstOpen : 0);
  };

  if (isSubmitting) {
    return <LoadingScreen message="Working out where you stand" />;
  }

  const poles = activeDimension ? DIMENSION_POLES[activeDimension] : null;
  const dimensionsDone = dimensionOrder.filter((d) => questionsByDimension[d].every((q) => answers[q.id] !== undefined)).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight sm:text-5xl">
            Where do <span className="text-primary">you</span> stand?
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            {totalQuestions} questions across {dimensionOrder.length} dimensions. Answers save on this device as you go.
          </p>
        </div>
        <Button asChild variant="outline" className="self-start sm:self-auto">
          <Link href="/">Save and leave</Link>
        </Button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {poles && (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex h-8 items-center gap-2 rounded-full bg-elevated px-3.5 text-sm font-bold">
                    <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    {poles.label}
                  </span>
                  <span className="truncate text-sm font-semibold text-muted-foreground">
                    {poles.negative} ↔ {poles.positive}
                  </span>
                </div>
              )}
              <span className="text-sm font-bold">
                Question {questionNumber} <span className="text-muted-foreground">of {totalQuestions}</span>
              </span>
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
              >
                <h2 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-[34px]">
                  {currentQuestion.text}
                </h2>

                <div role="radiogroup" aria-label="Answers" className="flex flex-col gap-3">
                  {currentQuestion.answers.map((answer, index) => {
                    const isSelected = selectedAnswerIndex === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleAnswerSelect(index)}
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
              {isLastQuestion ? 'See my results' : 'Next'} <ArrowRight />
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-xl font-bold">Your progress</h2>
            <p className="text-sm text-muted-foreground">
              {answeredQuestionCount} of {totalQuestions} answered · {dimensionsDone} of {dimensionOrder.length} dimensions done
            </p>
          </div>
          <ol className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
            {dimensionOrder.map((dimension, index) => {
              const questions = questionsByDimension[dimension];
              const done = questions.filter((q) => answers[q.id] !== undefined).length;
              const complete = done === questions.length;
              const current = index === dimensionIndex;
              return (
                <li key={dimension}>
                  <button
                    type="button"
                    onClick={() => goToDimension(index)}
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
                      {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className="flex-1 truncate">{DIMENSION_POLES[dimension].label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {done}/{questions.length}
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
