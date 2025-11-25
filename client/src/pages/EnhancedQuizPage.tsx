import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UserResponse } from '@shared/quizTypes';
import { enhancedQuestions } from '@shared/enhanced-quiz-data';
import { useMultidimensionalQuiz } from '@/contexts/MultidimensionalQuizContext';
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/LoadingScreen';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const EnhancedQuizPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { responses: existingResponses, setResponses, calculateResults, resetQuiz, results, isResultsCalculated } = useMultidimensionalQuiz();
  const { toast } = useToast();
  const { trackQuizStart, trackActivity } = useActivityTracker();

  const SESSION_STORAGE_KEY = 'enhancedQuizDraftResponses';
  const isBrowser = typeof window !== 'undefined';

  const { questionsByCategory, categoryOrder } = useMemo(() => {
    const grouped: Record<string, typeof enhancedQuestions> = {};
    const order: string[] = [];

    enhancedQuestions.forEach((question) => {
      const category = question.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
        order.push(category);
      }
      grouped[category].push(question);
    });

    return { questionsByCategory: grouped, categoryOrder: order };
  }, []);

  const initialResponsesMap = useMemo<Record<number, UserResponse>>(() => {
    if (isBrowser) {
      const storedDraft = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (storedDraft) {
        try {
          const parsed = JSON.parse(storedDraft) as Record<string, UserResponse>;
          return Object.entries(parsed).reduce<Record<number, UserResponse>>((acc, [key, value]) => {
            acc[Number(key)] = value;
            return acc;
          }, {});
        } catch (error) {
          console.warn('Unable to parse stored quiz draft:', error);
        }
      }
    }

    if (existingResponses && existingResponses.length > 0) {
      return existingResponses.reduce<Record<number, UserResponse>>((acc, response) => {
        acc[response.questionId] = response;
        return acc;
      }, {});
    }

    return {};
  }, [existingResponses, isBrowser]);

  const [responsesMap, setResponsesMap] = useState<Record<number, UserResponse>>(initialResponsesMap);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(() => categoryOrder[0] ?? null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [customAnswer, setCustomAnswer] = useState('');
  const [showCustomField, setShowCustomField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveIndicatorVisible, setSaveIndicatorVisible] = useState(false);

  const saveIndicatorTimeoutRef = useRef<number | null>(null);
  const hasTrackedStartRef = useRef(false);
  const questionSectionRef = useRef<HTMLDivElement | null>(null);

  const currentCategoryQuestions = useMemo(() => {
    if (!activeCategory) {
      return [] as typeof enhancedQuestions;
    }
    return questionsByCategory[activeCategory] || [];
  }, [activeCategory, questionsByCategory]);

  const currentQuestion = currentCategoryQuestions[currentQuestionIndex];

  const isResponseAnswered = useCallback((response?: UserResponse) => {
    if (!response) return false;
    if (typeof response.answerId === 'number') return true;
    if (response.customAnswer && response.customAnswer.trim() !== '') return true;
    return false;
  }, []);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(responsesMap));
  }, [responsesMap, isBrowser]);

  useEffect(() => {
    setResponses(Object.values(responsesMap));
  }, [responsesMap, setResponses]);

  useEffect(() => {
    if (!currentQuestion) {
      setSelectedAnswerIndex(null);
      setCustomAnswer('');
      setShowCustomField(false);
      return;
    }

    const existingResponse = responsesMap[currentQuestion.id];
    if (!existingResponse) {
      setSelectedAnswerIndex(null);
      setCustomAnswer('');
      setShowCustomField(false);
      return;
    }

    if (typeof existingResponse.answerId === 'number') {
      setSelectedAnswerIndex(existingResponse.answerId);
      setCustomAnswer('');
      setShowCustomField(false);
    } else if (existingResponse.customAnswer) {
      setSelectedAnswerIndex(null);
      setCustomAnswer(existingResponse.customAnswer);
      setShowCustomField(true);
    } else {
      setSelectedAnswerIndex(null);
      setCustomAnswer('');
      setShowCustomField(false);
    }
  }, [currentQuestion, responsesMap]);

  useEffect(() => {
    return () => {
      if (isBrowser && saveIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(saveIndicatorTimeoutRef.current);
      }
    };
  }, [isBrowser]);

  useEffect(() => {
    setCurrentQuestionIndex((index) => {
      if (currentCategoryQuestions.length === 0) {
        return 0;
      }
      return Math.min(index, currentCategoryQuestions.length - 1);
    });
  }, [currentCategoryQuestions]);

  const showSavedIndicator = useCallback(() => {
    if (!isBrowser) {
      return;
    }
    if (saveIndicatorTimeoutRef.current !== null) {
      window.clearTimeout(saveIndicatorTimeoutRef.current);
    }
    setSaveIndicatorVisible(true);
    saveIndicatorTimeoutRef.current = window.setTimeout(() => {
      setSaveIndicatorVisible(false);
      saveIndicatorTimeoutRef.current = null;
    }, 2000);
  }, [isBrowser]);

  const updateResponse = useCallback(
    (questionId: number, response?: UserResponse) => {
      setResponsesMap((prev) => {
        const next = { ...prev };

        const shouldStore =
          response &&
          (typeof response.answerId === 'number' ||
            (response.customAnswer && response.customAnswer.trim() !== ''));

        if (shouldStore && response) {
          next[questionId] = response;
        } else {
          delete next[questionId];
        }

        return next;
      });

      if (
        response &&
        (typeof response.answerId === 'number' ||
          (response.customAnswer && response.customAnswer.trim() !== ''))
      ) {
        if (!hasTrackedStartRef.current) {
          trackQuizStart();
          hasTrackedStartRef.current = true;
        }
        showSavedIndicator();
      }
    },
    [showSavedIndicator, trackQuizStart]
  );
  
  const answeredQuestionCount = useMemo(() => {
    return Object.values(responsesMap).filter((response) => isResponseAnswered(response)).length;
  }, [responsesMap, isResponseAnswered]);

  const totalQuestions = enhancedQuestions.length;

  const categoryCompletion = useMemo(() => {
    return categoryOrder.reduce<Record<string, { answered: number; total: number; complete: boolean }>>(
      (acc, category) => {
        const questions = questionsByCategory[category] || [];
        const answered = questions.filter((question) => isResponseAnswered(responsesMap[question.id])).length;
        acc[category] = {
          answered,
          total: questions.length,
          complete: questions.length > 0 && answered === questions.length
        };
        return acc;
      },
      {}
    );
  }, [categoryOrder, questionsByCategory, responsesMap, isResponseAnswered]);

  const currentCategoryStats =
    activeCategory && categoryCompletion[activeCategory]
      ? categoryCompletion[activeCategory]
      : { answered: 0, total: currentCategoryQuestions.length, complete: false };

  const currentCategoryProgress = currentCategoryStats.total
    ? (currentCategoryStats.answered / currentCategoryStats.total) * 100
    : 0;

  const overallProgress = totalQuestions ? (answeredQuestionCount / totalQuestions) * 100 : 0;

  const currentResponse = currentQuestion ? responsesMap[currentQuestion.id] : undefined;
  const selectedTabValue = activeCategory ?? (categoryOrder[0] ?? '');
  const currentQuestionNumber = currentCategoryQuestions.length ? currentQuestionIndex + 1 : 0;
  const activeCategoryIndex = activeCategory ? categoryOrder.indexOf(activeCategory) : -1;
  const isLastCategory =
    activeCategoryIndex !== -1 && activeCategoryIndex === categoryOrder.length - 1;
  const isFinalQuestion =
    isLastCategory &&
    currentCategoryQuestions.length > 0 &&
    currentQuestionIndex === currentCategoryQuestions.length - 1;
  const nextButtonLabel = isFinalQuestion ? 'Complete Quiz' : 'Next Question';
  const isPreviousDisabled = currentQuestionIndex === 0 && activeCategoryIndex <= 0;
  const isNextDisabled = !isResponseAnswered(currentResponse);
  const radioValue =
    selectedAnswerIndex !== null
      ? selectedAnswerIndex.toString()
      : showCustomField
        ? "custom"
        : "";

  const handleAnswerSelect = (answerIndex: number) => {
    if (!currentQuestion) {
      return;
    }
    setSelectedAnswerIndex(answerIndex);
    setShowCustomField(false);
    setCustomAnswer('');
    updateResponse(currentQuestion.id, {
      questionId: currentQuestion.id,
      answerId: answerIndex
    });
  };

  const handleCustomOption = () => {
    if (!currentQuestion) {
      return;
    }
    setSelectedAnswerIndex(null);
    // Restore existing custom answer if available
    const existingResponse = responsesMap[currentQuestion.id];
    if (existingResponse?.customAnswer) {
      setCustomAnswer(existingResponse.customAnswer);
    } else {
      setCustomAnswer('');
    }
    setShowCustomField(true);
  };

  const resetQuestionUi = () => {
    setSelectedAnswerIndex(null);
    setCustomAnswer('');
    setShowCustomField(false);
  };

  const handleNext = () => {
    if (!currentQuestion) {
      return;
    }

    const response = responsesMap[currentQuestion.id];
    if (!isResponseAnswered(response)) {
      toast({
        title: "Answer required",
        description: "Please choose an option or share a custom view before continuing.",
        variant: "destructive"
      });
      return;
    }

    trackActivity('quiz_answered', {
      category: currentQuestion.category,
      questionId: currentQuestion.id,
      answerType: response?.answerId !== undefined ? 'option' : 'custom'
    });

    if (currentQuestionIndex < currentCategoryQuestions.length - 1) {
      setCurrentQuestionIndex((index) => index + 1);
      resetQuestionUi();
      return;
    }

    const currentCategoryIndex = activeCategory ? categoryOrder.indexOf(activeCategory) : -1;
    if (currentCategoryIndex >= 0 && currentCategoryIndex < categoryOrder.length - 1) {
      const nextCategory = categoryOrder[currentCategoryIndex + 1];
      setActiveCategory(nextCategory);
      setCurrentQuestionIndex(0);
      resetQuestionUi();
      return;
    }

    void handleComplete();
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (!activeCategory) {
      return;
    }

    const currentCategoryIndex = categoryOrder.indexOf(activeCategory);
    if (currentCategoryIndex > 0) {
      const previousCategory = categoryOrder[currentCategoryIndex - 1];
      const previousQuestions = questionsByCategory[previousCategory] || [];
      setActiveCategory(previousCategory);
      setCurrentQuestionIndex(previousQuestions.length > 0 ? previousQuestions.length - 1 : 0);
    }
  };
  
  // Handle quiz completion
  const handleComplete = useCallback(async () => {
    if (answeredQuestionCount === 0) {
      toast({
        title: "No answers yet",
        description: "Please answer at least one question before completing the quiz.",
        variant: "destructive"
      });
      return;
    }

    const incompleteCategories = categoryOrder.filter((category) => {
      const stats = categoryCompletion[category];
      return stats && stats.answered < stats.total;
    });

    if (incompleteCategories.length > 0) {
      const nextCategory = incompleteCategories[0];
      const remaining = categoryCompletion[nextCategory].total - categoryCompletion[nextCategory].answered;
      setActiveCategory(nextCategory);
      setCurrentQuestionIndex(0);
      resetQuestionUi();
      toast({
        title: "Keep going",
        description: `You still have ${remaining} question${remaining === 1 ? '' : 's'} to answer in "${nextCategory}".`,
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      resetQuiz();
      setResponses(Object.values(responsesMap));
      await new Promise((resolve) => setTimeout(resolve, 0));

      const results = calculateResults();

      if (!results) {
        setIsLoading(false);
        toast({
          title: "Calculation error",
          description: "Unable to calculate your results. Please ensure you have answered all questions.",
          variant: "destructive"
        });
        return;
      }

      trackActivity('completed_quiz', {
        category: 'political_engagement',
        totalQuestions,
        answeredQuestions: answeredQuestionCount
      });

      setTimeout(() => {
        setIsLoading(false);

        const simpleDimensions = {
          economic: parseFloat(results.economic.toFixed(1)),
          social: parseFloat(results.social.toFixed(1)),
          cultural: parseFloat(results.cultural.toFixed(1)),
          globalism: parseFloat(results.globalism.toFixed(1)),
          environmental: parseFloat(results.environmental.toFixed(1)),
          authority: parseFloat(results.authority.toFixed(1)),
          welfare: parseFloat(results.welfare.toFixed(1)),
          technocratic: parseFloat(results.technocratic.toFixed(1))
        };

        localStorage.setItem('tempDimensions', JSON.stringify(simpleDimensions));
        if (isBrowser) {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        }

        setLocation('/dimension-weights');
      }, 1000);
    } catch (error) {
      console.error("Error completing quiz:", error);
      toast({
        title: "Error",
        description: "An error occurred while calculating your results. Please try again.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  }, [
    answeredQuestionCount,
    categoryCompletion,
    categoryOrder,
    calculateResults,
    isBrowser,
    resetQuestionUi,
    resetQuiz,
    SESSION_STORAGE_KEY,
    responsesMap,
    setLocation,
    setResponses,
    totalQuestions,
    toast,
    trackActivity
  ]);
  
  // Handle category change
  const handleCategoryChange = (category: string) => {
    const targetIndex = categoryOrder.indexOf(category);
    if (targetIndex === -1) {
      return;
    }

    const lockedCategory = categoryOrder
      .slice(0, targetIndex)
      .find((cat) => (categoryCompletion[cat]?.answered ?? 0) === 0);

    if (lockedCategory) {
      toast({
        title: "Finish earlier sections first",
        description: `Answer the questions in "${lockedCategory}" before jumping ahead.`,
        variant: "destructive"
      });
      return;
    }

    const categoryQuestions = questionsByCategory[category] || [];
    const firstUnansweredIndex = categoryQuestions.findIndex(
      (question) => !isResponseAnswered(responsesMap[question.id])
    );

    setActiveCategory(category);
    setCurrentQuestionIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
    resetQuestionUi();
  };
  
  const roundedOverallProgress = Math.round(overallProgress);

  if (isLoading) {
    return <LoadingScreen message="Analyzing your political profile..." />;
  }

  // Check if quiz is already completed - redirect to results automatically
  useEffect(() => {
    // Only redirect if we're not already on the results page and results exist
    const currentPath = window.location.pathname;
    if (currentPath === '/enhanced-results') {
      return; // Don't redirect if already on results page
    }
    
    // Check if results exist in context
    if (isResultsCalculated && results) {
      setLocation('/enhanced-results');
      return;
    }
    
    // Check if results exist in localStorage
    if (isBrowser) {
      const savedResults = localStorage.getItem('multidimensionalQuizResults');
      const resultsCalculated = localStorage.getItem('multidimensionalResultsCalculated');
      
      if (savedResults && resultsCalculated === 'true') {
        setLocation('/enhanced-results');
        return;
      }
    }
  }, [isResultsCalculated, results, setLocation, isBrowser]);

  // Fallback if no questions loaded
  if (!enhancedQuestions || enhancedQuestions.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Quiz Loading...</h1>
          <p>Unable to load quiz questions. Please refresh the page.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 pb-12 text-slate-100 sm:pb-14">
      <div 
        className="relative z-10 mx-auto w-full max-w-6xl px-2 py-6 sm:px-3 lg:px-4 lg:py-8 bg-transparent-override" 
        data-transparent="true" 
        style={{ 
          backgroundColor: 'transparent', 
          background: 'transparent',
          backgroundImage: 'none'
        }}
      >
        <div 
          className="space-y-4 bg-transparent-override" 
          data-transparent="true" 
          style={{ 
            backgroundColor: 'transparent', 
            background: 'transparent',
            backgroundImage: 'none'
          }}
        >
          {/* Progress Card */}
          <Card className="border-white/10 text-slate-100 shadow-none bg-transparent-override">
            <CardContent className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-300">{answeredQuestionCount} of {totalQuestions} answered</span>
                  <span className="font-semibold text-white">{roundedOverallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="h-2 bg-white/10" />
            </div>
              {activeCategory && (
                <Badge className="rounded-full border-sky-400/40 bg-sky-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sky-200 whitespace-nowrap">
                  {activeCategory}
                </Badge>
              )}
            </CardContent>
          </Card>
          
          {/* Quiz Questions */}
          <div ref={questionSectionRef} className="space-y-1">
            <AnimatePresence mode="wait">
              {currentQuestion ? (
                <motion.div
                  key={currentQuestion.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  <Card className="border-white/10 text-slate-100 shadow-none bg-transparent-override">
                    <CardHeader className="space-y-2 px-4 pt-4 pb-3 sm:px-6">
                      <div className="flex items-start gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevious}
                          disabled={isPreviousDisabled}
                          className={cn(
                            "h-8 w-8 rounded-lg border border-white/20 bg-transparent text-white transition-all hover:bg-white/10 hover:border-white/40",
                            isPreviousDisabled && "opacity-50 cursor-not-allowed"
                          )}
                          aria-label="Previous question"
              >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <CardTitle className="flex-1 text-sm font-semibold leading-tight text-white sm:text-base md:text-lg">
                          {currentQuestion.text}
                        </CardTitle>
        </div>
            </CardHeader>
                    <CardContent className="space-y-3 px-4 pb-4 sm:px-6">
              <RadioGroup 
                        value={radioValue}
                        onValueChange={(value) => {
                          if (value === 'custom') {
                            handleCustomOption();
                            return;
                          }
                          const numericValue = Number.parseInt(value, 10);
                          if (!Number.isNaN(numericValue)) {
                            handleAnswerSelect(numericValue);
                          }
                        }}
                        className="space-y-3"
                      >
                        {(() => {
                          // Create a seeded random icon assignment based on question ID to reduce bias
                          // This ensures same question always has same icons, but different questions have different assignments
                          const getIconsForQuestion = (questionId: number, answerCount: number) => {
                            // Large pool of relevant political/policy icons
                            const iconPool = [
                              '🏗️', '💚', '💰', '🛡️', '🌱', '⚖️', '🎯', '🚀',
                              '📊', '🏛️', '🌍', '👥', '💡', '🔧', '📈', '🎓',
                              '🏥', '🏠', '🚂', '🌐', '🔒', '📜', '⚡', '🌟',
                              '🎨', '🔬', '💼', '🤝', '🌳', '🔔', '📱', '🎪'
                            ];
                            
                            // Use question ID as seed for consistent randomization
                            const seed = questionId * 17 + 31; // Simple hash
                            const shuffled = [...iconPool];
                            
                            // Fisher-Yates shuffle with seed
                            for (let i = shuffled.length - 1; i > 0; i--) {
                              const j = Math.floor((seed + i * 7) % (i + 1));
                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                            }
                            
                            // Return only the number of icons needed for this question
                            return shuffled.slice(0, answerCount);
                          };
                          
                          // Generate icons once for this question
                          const questionIcons = getIconsForQuestion(currentQuestion.id, currentQuestion.answers.length);
                          
                          return currentQuestion.answers.map((answer, index) => {
                            const isSelected = selectedAnswerIndex === index;
                            const icon = questionIcons[index] || '📋';
                          return (
                    <div 
                      key={index}
                              className={cn(
                                "group relative flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all duration-300",
                                "hover:scale-[1.02] hover:shadow-lg",
                                isSelected 
                                  ? "border-sky-400 bg-transparent shadow-[0_8px_32px_rgba(56,189,248,0.3)]" 
                                  : "border-white/20 bg-transparent hover:border-white/40"
                              )}
                      onClick={() => handleAnswerSelect(index)}
                    >
                              <div className="flex-shrink-0">
                                <div className={cn(
                                  "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all duration-300",
                                  isSelected 
                                    ? "bg-sky-400/20 shadow-lg shadow-sky-500/30 scale-110" 
                                    : "bg-white/5 group-hover:bg-white/10"
                                )}>
                                  {icon}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0 text-center">
                        <Label 
                          htmlFor={`answer-${index}`}
                                  className="block cursor-pointer text-sm font-semibold text-white sm:text-base"
                                  style={{ lineHeight: '1.2' }}
                        >
                          {answer.text}
                        </Label>
                        {answer.description && (
                                  <p className="mt-1 text-xs leading-tight text-slate-400 sm:text-sm" style={{ lineHeight: '1.2' }}>
                            {answer.description}
                          </p>
                        )}
                      </div>
                              <div className="flex-shrink-0">
                                <RadioGroupItem
                                  id={`answer-${index}`}
                                  value={index.toString()}
                                  className={cn(
                                    "h-5 w-5 border-2 transition-all duration-300",
                                    isSelected
                                      ? "border-sky-400 bg-sky-400 ring-2 ring-sky-400/30"
                                      : "border-white/30 bg-transparent group-hover:border-white/50"
                                  )}
                                />
                              </div>
                    </div>
                          );
                          });
                        })()}
                  <div 
                          className={cn(
                            "group relative flex flex-col rounded-2xl border-2 border-dashed p-4 transition-all duration-300",
                            "hover:scale-[1.02] hover:shadow-lg",
                      showCustomField
                              ? "border-sky-400 bg-transparent shadow-[0_8px_32px_rgba(56,189,248,0.3)]" 
                              : "border-white/20 bg-transparent hover:border-white/40 cursor-pointer"
                          )}
                          onClick={(e) => {
                            if (!showCustomField) {
                              e.stopPropagation();
                              // Trigger RadioGroup's onValueChange by clicking the RadioGroupItem
                              const radioItem = document.getElementById('custom-answer') as HTMLElement;
                              if (radioItem) {
                                radioItem.click();
                              }
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              <div className={cn(
                                "flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-all duration-300",
                                showCustomField 
                                  ? "bg-sky-400/20 shadow-lg shadow-sky-500/30 scale-110" 
                                  : "bg-white/5 group-hover:bg-white/10"
                              )}>
                                ✍️
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 text-center">
                      <Label 
                        htmlFor="custom-answer"
                                className="block cursor-pointer text-sm font-semibold text-white sm:text-base"
                                style={{ lineHeight: '1.2' }}
                                onClick={(e) => {
                                  if (!showCustomField) {
                                    e.stopPropagation();
                                    // Trigger RadioGroup's onValueChange by clicking the RadioGroupItem
                                    const radioItem = document.getElementById('custom-answer') as HTMLElement;
                                    if (radioItem) {
                                      radioItem.click();
                                    }
                                  }
                                }}
                              >
                                Custom perspective
                      </Label>
                              <p className="mt-1 text-xs leading-tight text-slate-400 sm:text-sm" style={{ lineHeight: '1.2' }}>
                                Share your viewpoint in your own words when the preset options miss the mark.
                              </p>
                            </div>
                            <div className="flex-shrink-0">
                              <RadioGroupItem
                                id="custom-answer"
                                value="custom"
                                checked={showCustomField}
                                className={cn(
                                  "h-5 w-5 border-2 transition-all duration-300",
                                  showCustomField
                                    ? "border-sky-400 bg-sky-400 ring-2 ring-sky-400/30"
                                    : "border-white/30 bg-transparent group-hover:border-white/50"
                                )}
                              />
                            </div>
                          </div>
                      {showCustomField && (
                            <div className="mt-4 w-full" onClick={(e) => e.stopPropagation()}>
                        <Textarea 
                          value={customAnswer}
                          onChange={(e) => {
                            const value = e.target.value;
                            setCustomAnswer(value);
                            if (currentQuestion) {
                              updateResponse(
                                currentQuestion.id,
                                value.trim()
                                  ? {
                                      questionId: currentQuestion.id,
                                      customAnswer: value
                                    }
                                  : undefined
                              );
                            }
                          }}
                                onFocus={(e) => e.stopPropagation()}
                                onBlur={(e) => e.stopPropagation()}
                          placeholder="Describe your position on this issue..."
                                className="w-full rounded-xl border-2 border-white/20 bg-slate-900/50 p-4 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400/30 min-h-[120px] resize-none"
                                autoFocus
                        />
                            </div>
                      )}
                </div>
              </RadioGroup>
            </CardContent>
                    <CardFooter className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
                <span
                          className={cn(
                            "flex items-center gap-2 text-xs font-semibold text-emerald-300 transition-opacity duration-300",
                            saveIndicatorVisible ? "opacity-100" : "opacity-0"
                          )}
                  aria-live="polite"
                >
                          <CheckCircle2 className="h-4 w-4" />
                          Progress saved
                </span>
                <Button 
                  onClick={handleNext}
                  disabled={isNextDisabled}
                          className="group h-11 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 px-8 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,0.4)] transition-all hover:from-sky-300 hover:via-blue-400 hover:to-indigo-500 hover:shadow-[0_12px_32px_rgba(56,189,248,0.5)] hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                          <span>{nextButtonLabel}</span>
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>
            </CardFooter>
          </Card>
                </motion.div>
        ) : (
                <motion.div
                  key="no-question"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                >
                  <Card className="border-white/10 text-slate-100 bg-transparent-override">
                    <CardContent className="p-5 text-center text-slate-300 text-[7px]">
                No questions available for this category.
            </CardContent>
          </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
            </div>
      </div>
    </div>
  );
};

export default EnhancedQuizPage;