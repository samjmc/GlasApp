/**
 * Political Ideology Quiz Component
 * 8 questions across key political dimensions
 * Creates baseline profile for personalized TD rankings
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';

interface QuizQuestion {
  id: string;
  dimension: string;
  question: string;
  leftLabel: string;
  rightLabel: string;
  description: string;
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'immigration',
    dimension: 'Immigration & Integration',
    question: 'Ireland should accept more refugees and asylum seekers',
    leftLabel: 'Strongly Disagree',
    rightLabel: 'Strongly Agree',
    description: 'Your view on immigration policy and refugee acceptance'
  },
  {
    id: 'healthcare',
    dimension: 'Healthcare',
    question: 'Healthcare should be fully public and free at point of use',
    leftLabel: 'Private Model',
    rightLabel: 'Fully Public',
    description: 'Public vs private healthcare system preference'
  },
  {
    id: 'housing',
    dimension: 'Housing',
    question: 'Government should build social housing and control rents',
    leftLabel: 'Free Market',
    rightLabel: 'State Intervention',
    description: 'Government role in housing and rent control'
  },
  {
    id: 'economy',
    dimension: 'Economy & Tax',
    question: 'Wealthy individuals and corporations should pay higher taxes',
    leftLabel: 'Low Tax',
    rightLabel: 'Redistribute Wealth',
    description: 'Tax policy and wealth distribution'
  },
  {
    id: 'environment',
    dimension: 'Environment',
    question: 'Climate action should be prioritized even if it costs jobs',
    leftLabel: 'Economy First',
    rightLabel: 'Climate First',
    description: 'Balancing climate action with economic concerns'
  },
  {
    id: 'social_issues',
    dimension: 'Social Welfare',
    question: 'Government should increase social welfare and support programs',
    leftLabel: 'Self-Reliance',
    rightLabel: 'Strong Safety Net',
    description: 'Government role in social support'
  },
  {
    id: 'justice',
    dimension: 'Justice & Policing',
    question: 'Focus should be on rehabilitation rather than punishment',
    leftLabel: 'Tough on Crime',
    rightLabel: 'Restorative Justice',
    description: 'Approach to criminal justice'
  },
  {
    id: 'education',
    dimension: 'Education',
    question: 'Education should be free at all levels including university',
    leftLabel: 'User Pays',
    rightLabel: 'Fully Funded',
    description: 'Funding model for education'
  }
];

interface PoliticalQuizProps {
  onComplete: (results: any) => void;
  onSkip?: () => void;
}

export function PoliticalQuiz({ onComplete, onSkip }: PoliticalQuizProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const question = QUIZ_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUIZ_QUESTIONS.length) * 100;
  const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length - 1;
  const hasAnswer = answers[question.id] !== undefined;

  const handleSliderChange = (value: number[]) => {
    setAnswers({ ...answers, [question.id]: value[0] });
  };

  const handleNext = () => {
    if (!hasAnswer) return;
    
    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onComplete(answers);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-800">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Find Your Political Matches
              </h2>
            </div>
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Skip for now
              </button>
            )}
          </div>
          
          {/* Progress Bar */}
          <div className="relative w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Question {currentQuestion + 1} of {QUIZ_QUESTIONS.length}
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-2">
            {question.dimension}
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            {question.question}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {question.description}
          </p>
        </div>

        {/* Slider */}
        <div className="mb-8">
          <div className="mb-4">
            <Slider
              value={[answers[question.id] || 3]}
              onValueChange={handleSliderChange}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
          
          {/* Labels */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 text-left">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {question.leftLabel}
              </div>
              <div className={`text-xs transition-opacity ${
                (answers[question.id] || 3) <= 2 ? 'opacity-100 font-semibold text-purple-600 dark:text-purple-400' : 'opacity-50 text-gray-500'
              }`}>
                {(answers[question.id] || 3) === 1 ? '● Strongly' : (answers[question.id] || 3) === 2 ? '● Somewhat' : ''}
              </div>
            </div>
            
            <div className="text-center flex-shrink-0">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {answers[question.id] || 3}
              </div>
              <div className="text-xs text-gray-500">
                {(answers[question.id] || 3) === 3 ? 'Neutral' : ''}
              </div>
            </div>
            
            <div className="flex-1 text-right">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                {question.rightLabel}
              </div>
              <div className={`text-xs transition-opacity ${
                (answers[question.id] || 3) >= 4 ? 'opacity-100 font-semibold text-purple-600 dark:text-purple-400' : 'opacity-50 text-gray-500'
              }`}>
                {(answers[question.id] || 3) === 5 ? 'Strongly ●' : (answers[question.id] || 3) === 4 ? 'Somewhat ●' : ''}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentQuestion === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          
          <div className="flex gap-1">
            {QUIZ_QUESTIONS.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx < currentQuestion ? 'bg-purple-600 dark:bg-purple-400' :
                  idx === currentQuestion ? 'bg-purple-400 dark:bg-purple-300 w-8' :
                  'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          
          <Button
            onClick={handleNext}
            disabled={!hasAnswer || isSubmitting}
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Processing...
              </>
            ) : isLastQuestion ? (
              <>
                <Check className="w-4 h-4" />
                See My Matches
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}























