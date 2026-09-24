import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { QUIZ_QUESTIONS, type QuizQuestion, type QuizResponse } from '@shared/quiz';
import { DIMENSION_POLES, type IdeologyDimension } from '@shared/ideology';
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/LoadingScreen';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronLeft, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitQuiz } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';
import { loadDraft, storeDraft, storeQuiz } from '@/lib/quizStorage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICON_POOL = [
  '🏗️', '💚', '💰', '🛡️', '🌱', '⚖️', '🎯', '🚀',
  '📊', '🏛️', '🌍', '👥', '💡', '🔧', '📈', '🎓',
  '🏥', '🏠', '🚂', '🌐', '🔒', '📜', '⚡', '🌟',
  '🎨', '🔬', '💼', '🤝', '🌳', '🔔', '📱', '🎪'
];

// Consistent per-question emojis
const getIconsForQuestion = (questionId: number, answerCount: number) => {
  const seed = questionId * 17 + 31;
  const shuffled = [...ICON_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor((seed + i * 7) % (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, answerCount);
};

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

  const questionIcons = useMemo(() => {
    if (!currentQuestion) return [];
    return getIconsForQuestion(currentQuestion.id, currentQuestion.answers.length);
  }, [currentQuestion]);

  // Answers are authored with the strongest stance first; showing them in that order biases
  // the choice. Shuffle once per visit and per question. Answers stay keyed by their original
  // index, so scoring and a saved draft are unaffected.
  const visitSeed = useRef(Math.floor(Math.random() * 2 ** 31));
  const answerOrder = useMemo(() => {
    if (!currentQuestion) return [];
    const order = currentQuestion.answers.map((_, i) => i);
    let s = (visitSeed.current ^ (currentQuestion.id * 2654435761)) >>> 0;
    for (let i = order.length - 1; i > 0; i--) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const j = s % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }, [currentQuestion]);

  if (isSubmitting) {
    return <LoadingScreen message="Analyzing profile..." />;
  }

  const dimensionAnswered = currentDimensionQuestions.filter((q) => answers[q.id] !== undefined).length;

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-500">Quiz</span>
              <span className="text-gray-400">/</span>
              {activeDimension ? DIMENSION_POLES[activeDimension].label : ''}
              <span className="text-xs font-normal text-gray-400">
                {dimensionAnswered}/{currentDimensionQuestions.length}
              </span>
            </h1>
            <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
              {answeredQuestionCount} / {totalQuestions}
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-1.5" />
        </div>

        {/* Question Area */}
        <AnimatePresence mode="wait">
          {currentQuestion ? (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <h2 className="text-xl md:text-2xl font-semibold leading-snug text-gray-900 dark:text-white">
                {currentQuestion.text}
              </h2>

              <RadioGroup
                value={selectedAnswerIndex !== null ? selectedAnswerIndex.toString() : ""}
                onValueChange={(value) => {
                  const numericValue = Number.parseInt(value, 10);
                  if (!Number.isNaN(numericValue)) handleAnswerSelect(numericValue);
                }}
                className="space-y-3"
              >
                {answerOrder.map((index) => {
                  const answer = currentQuestion.answers[index];
                  const isSelected = selectedAnswerIndex === index;
                  const icon = questionIcons[index] || '📋';

                  return (
                    <div
                      key={index}
                      className={cn(
                        "relative flex items-center justify-between rounded-xl border p-4 transition-all cursor-pointer",
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm"
                          : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                      )}
                      onClick={() => handleAnswerSelect(index)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <RadioGroupItem
                          value={index.toString()}
                          id={`answer-${index}`}
                          className={cn(
                            "border-gray-400 text-emerald-500 mt-0.5",
                            isSelected && "border-emerald-500"
                          )}
                        />
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-2xl shrink-0 leading-none">{icon}</span>
                          <Label
                            htmlFor={`answer-${index}`}
                            className="cursor-pointer text-sm md:text-base font-medium text-gray-900 dark:text-gray-100 leading-normal"
                          >
                            {answer.text}
                          </Label>
                        </div>
                      </div>

                      {/* Info Tooltip */}
                      {answer.description && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-full shrink-0 ml-2"
                                onClick={(e) => e.stopPropagation()} // Prevent selection when clicking info
                              >
                                <HelpCircle className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              className="max-w-[280px] bg-gray-900 dark:bg-gray-800 border-gray-800 text-white p-3 text-xs leading-relaxed z-[1050]"
                            >
                              {answer.description}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  );
                })}
              </RadioGroup>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-6">
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={isPreviousDisabled}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <div className="flex items-center gap-4">
                  <span className={cn(
                    "text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-opacity",
                    saveIndicatorVisible ? "opacity-100" : "opacity-0"
                  )}>
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </span>

                  <Button
                    onClick={handleNext}
                    disabled={isNextDisabled}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                  >
                    {isLastQuestion ? 'Complete Quiz' : 'Next'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

            </motion.div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No questions found.
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default QuizPage;
