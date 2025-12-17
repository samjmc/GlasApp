import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowRight, CheckCircle2, ChevronLeft, Info, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from "@/components/PageHeader";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  useEffect(() => {
    const currentPath = window.location.pathname;
    if (currentPath === '/enhanced-results') {
      return;
    }
    
    if (isResultsCalculated && results) {
      setLocation('/enhanced-results');
      return;
    }
    
    if (isBrowser) {
      const savedResults = localStorage.getItem('multidimensionalQuizResults');
      const resultsCalculated = localStorage.getItem('multidimensionalResultsCalculated');
      
      if (savedResults && resultsCalculated === 'true') {
        setLocation('/enhanced-results');
        return;
      }
    }
  }, [isResultsCalculated, results, setLocation, isBrowser]);

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

  const overallProgress = totalQuestions ? (answeredQuestionCount / totalQuestions) * 100 : 0;

  const currentResponse = currentQuestion ? responsesMap[currentQuestion.id] : undefined;
  const nextButtonLabel = currentQuestionIndex === currentCategoryQuestions.length - 1 && 
    (activeCategory ? categoryOrder.indexOf(activeCategory) === categoryOrder.length - 1 : false)
    ? 'Complete Quiz' 
    : 'Next';
  const isPreviousDisabled = currentQuestionIndex === 0 && (activeCategory ? categoryOrder.indexOf(activeCategory) === 0 : true);
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
    if (!currentQuestion) return;

    if (!isResponseAnswered(responsesMap[currentQuestion.id])) {
      toast({
        title: "Answer required",
        description: "Please choose an option before continuing.",
        variant: "destructive"
      });
      return;
    }

    trackActivity('quiz_answered', {
      category: currentQuestion.category,
      questionId: currentQuestion.id,
      answerType: responsesMap[currentQuestion.id]?.answerId !== undefined ? 'option' : 'custom'
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

    if (!activeCategory) return;

    const currentCategoryIndex = categoryOrder.indexOf(activeCategory);
    if (currentCategoryIndex > 0) {
      const previousCategory = categoryOrder[currentCategoryIndex - 1];
      const previousQuestions = questionsByCategory[previousCategory] || [];
      setActiveCategory(previousCategory);
      setCurrentQuestionIndex(previousQuestions.length > 0 ? previousQuestions.length - 1 : 0);
    }
  };
  
  const handleComplete = useCallback(async () => {
    if (answeredQuestionCount === 0) {
      toast({ title: "No answers yet", description: "Answer at least one question.", variant: "destructive" });
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
      toast({ title: "Almost there", description: `${remaining} questions left in ${nextCategory}.` });
      return;
    }

    setIsLoading(true);

    try {
      const finalResponses = Object.values(responsesMap);
      resetQuiz();
      setResponses(finalResponses);
      const results = calculateResults(finalResponses);

      if (!results) {
        setIsLoading(false);
        toast({ title: "Error", description: "Calculation failed.", variant: "destructive" });
        return;
      }

      trackActivity('completed_quiz', { category: 'political_engagement', totalQuestions, answeredQuestions: answeredQuestionCount });

      setTimeout(() => {
        setIsLoading(false);
        if (isBrowser) sessionStorage.removeItem(SESSION_STORAGE_KEY);
        setLocation('/enhanced-results');
      }, 1000);
    } catch (error) {
      console.error("Error completing quiz:", error);
      setIsLoading(false);
    }
  }, [answeredQuestionCount, categoryCompletion, categoryOrder, calculateResults, isBrowser, responsesMap, setLocation, setResponses, totalQuestions, toast, trackActivity, resetQuiz, SESSION_STORAGE_KEY]);
  
  // Helper to generate consistent emojis
  const getIconsForQuestion = useCallback((questionId: number, answerCount: number) => {
    const iconPool = [
      '🏗️', '💚', '💰', '🛡️', '🌱', '⚖️', '🎯', '🚀',
      '📊', '🏛️', '🌍', '👥', '💡', '🔧', '📈', '🎓',
      '🏥', '🏠', '🚂', '🌐', '🔒', '📜', '⚡', '🌟',
      '🎨', '🔬', '💼', '🤝', '🌳', '🔔', '📱', '🎪'
    ];
    const seed = questionId * 17 + 31;
    const shuffled = [...iconPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor((seed + i * 7) % (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, answerCount);
  }, []);

  const questionIcons = useMemo(() => {
    if (!currentQuestion) return [];
    return getIconsForQuestion(currentQuestion.id, currentQuestion.answers.length);
  }, [currentQuestion, getIconsForQuestion]);

  const roundedOverallProgress = Math.round(overallProgress);

  if (isLoading) {
    return <LoadingScreen message="Analyzing profile..." />;
  }

  if (!enhancedQuestions || enhancedQuestions.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading quiz...</div>;
  }
  
  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-3xl mx-auto px-4 py-6">
        
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-emerald-500">Quiz</span> 
              <span className="text-gray-400">/</span> 
              {activeCategory}
            </h1>
            <Badge variant="outline" className="text-xs border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
              {answeredQuestionCount} / {totalQuestions}
            </Badge>
          </div>
          <Progress value={overallProgress} className="h-1.5" indicatorClassName="bg-emerald-500" />
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
                value={radioValue}
                onValueChange={(value) => {
                  if (value === 'custom') {
                    handleCustomOption();
                  } else {
                    const numericValue = Number.parseInt(value, 10);
                    if (!Number.isNaN(numericValue)) handleAnswerSelect(numericValue);
                  }
                }}
                className="space-y-3"
              >
                {currentQuestion.answers.map((answer, index) => {
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

                {/* Custom Option */}
                <div 
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition-all cursor-pointer",
                    showCustomField
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm" 
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  onClick={(e) => {
                    if (!showCustomField) handleCustomOption();
                  }}
                >
                  <div className="flex items-center gap-4">
                    <RadioGroupItem
                      value="custom"
                      id="custom-answer"
                      className={cn(
                        "border-gray-400 text-emerald-500 mt-0.5",
                        showCustomField && "border-emerald-500"
                      )}
                    />
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl shrink-0 leading-none">✍️</span>
                      <Label 
                        htmlFor="custom-answer"
                        className="cursor-pointer text-sm md:text-base font-medium text-gray-900 dark:text-gray-100"
                      >
                        Other / Custom View
                      </Label>
                    </div>
                  </div>
                  
                  {showCustomField && (
                    <div className="mt-3 pl-11 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Textarea 
                        value={customAnswer}
                        onChange={(e) => {
                          setCustomAnswer(e.target.value);
                          updateResponse(currentQuestion.id, {
                            questionId: currentQuestion.id,
                            customAnswer: e.target.value
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Share your perspective..."
                        className="min-h-[80px] border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 focus:border-emerald-500 resize-none text-sm"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
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
                    {nextButtonLabel}
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

export default EnhancedQuizPage;
