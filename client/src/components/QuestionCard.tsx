import { useState, ChangeEvent } from "react";
import { QuizQuestion } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import QuizAssistant from "@/components/QuizAssistant";

interface QuestionCardProps {
  question: QuizQuestion;
  currentNumber: number;
  totalQuestions: number;
  progress: number;
  selectedAnswerId?: number;
  customAnswer?: string;
  onAnswer: (answerId?: number, customAnswer?: string) => void;
  onPrevious: () => void;
  onSkip: () => void;
  showPrevious: boolean;
}

const QuestionCard = ({
  question,
  currentNumber,
  totalQuestions,
  progress,
  selectedAnswerId,
  customAnswer,
  onAnswer,
  onPrevious,
  onSkip,
  showPrevious
}: QuestionCardProps) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | undefined>(selectedAnswerId);
  const [userCustomAnswer, setUserCustomAnswer] = useState<string>(customAnswer || "");
  const [useCustomAnswer, setUseCustomAnswer] = useState<boolean>(!!customAnswer);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  
  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
    setUseCustomAnswer(false);
    // Also clear the custom answer text when selecting a multiple choice option
    setUserCustomAnswer("");
  };
  
  const handleCustomAnswerChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setUserCustomAnswer(e.target.value);
    setUseCustomAnswer(true);
    setSelectedAnswer(undefined);
  };
  
  const handleNext = () => {
    if (useCustomAnswer && userCustomAnswer.trim()) {
      onAnswer(undefined, userCustomAnswer);
      // Clear the custom answer after submitting to ensure it's empty for the next question
      setUserCustomAnswer("");
    } else if (selectedAnswer !== undefined) {
      onAnswer(selectedAnswer, undefined);
    } else {
      // If no answer is selected, skip this question
      onSkip();
    }
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <div className="mb-6">
          <div className="progress-bar h-[5px] rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
            <div 
              className="progress-value h-full rounded-full bg-indigo-600 transition-all duration-500 ease-in-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Question <span id="current-question">{currentNumber}</span> of <span id="total-questions">{totalQuestions}</span></span>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0 h-auto flex items-center"
                onClick={() => setIsAssistantOpen(true)}
              >
                <span className="mr-1">Help</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </Button>
              <Button 
                variant="ghost" 
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-0 h-auto"
                onClick={onSkip}
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-6">{question.text}</h3>
        
        <div className={`border p-5 rounded-lg mb-6 transition-all ${
          useCustomAnswer ? 
          'border-indigo-600 ring-2 ring-indigo-200 bg-indigo-50 dark:ring-indigo-900/30 dark:bg-indigo-900/20' : 
          'border-indigo-200 dark:border-indigo-800 bg-gray-50 dark:bg-gray-800/20'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-medium text-indigo-700 dark:text-indigo-300">Write your response:</div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              useCustomAnswer ? 
              'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' : 
              'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {useCustomAnswer ? 'Selected' : 'Optional'}
            </div>
          </div>
          <div className={`relative border ${
            useCustomAnswer ? 
            'border-indigo-600 ring-2 ring-indigo-200 dark:ring-indigo-900/30' : 
            'border-gray-300 dark:border-gray-600'
          } rounded-md transition-all`}>
            <Textarea 
              className="w-full rounded-md border-0 dark:bg-gray-700 p-3 focus:ring-0 focus:outline-none transition-colors"
              rows={4}
              placeholder="Share your thoughts on this issue in detail..."
              value={userCustomAnswer}
              onChange={handleCustomAnswerChange}
              onFocus={() => {
                setUseCustomAnswer(true);
                setSelectedAnswer(undefined);
              }}
            />
          </div>
          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">Why write a detailed response?</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Providing a detailed, thoughtful response helps our AI accurately assess your nuanced political views. 
              The more specific you are, the more precise your results will be compared to using multiple-choice answers alone.
            </p>
          </div>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-5 mb-6">
          <div className="text-sm font-medium mb-3">Or select from multiple choice options:</div>
          <div className="space-y-3">
            {question.answers.map((answer, index) => (
              <div className="flex items-start" key={index}>
                <input 
                  type="radio" 
                  name="answer" 
                  id={`answer-${index}`} 
                  className="question-input hidden" 
                  checked={selectedAnswer === index && !useCustomAnswer}
                  onChange={() => handleAnswerSelect(index)}
                />
                <label 
                  htmlFor={`answer-${index}`} 
                  className={`question-label flex-grow rounded-md border border-gray-300 dark:border-gray-600 p-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    selectedAnswer === index && !useCustomAnswer ? 
                    'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                  onClick={() => handleAnswerSelect(index)}
                >
                  <div className="font-medium mb-1">{answer.text}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{answer.description}</div>
                </label>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-between mt-6">
          {showPrevious ? (
            <Button
              variant="ghost"
              className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors"
              onClick={onPrevious}
            >
              <i className="fas fa-arrow-left mr-2"></i> Previous
            </Button>
          ) : (
            <div></div>
          )}
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6"
            onClick={handleNext}
          >
            {currentNumber === totalQuestions ? 'Finish' : 'Next'} <i className="fas fa-arrow-right ml-2"></i>
          </Button>
        </div>
        
        {/* Quiz Assistant */}
        <QuizAssistant 
          question={question}
          isOpen={isAssistantOpen}
          onClose={() => setIsAssistantOpen(false)}
        />
      </CardContent>
    </Card>
  );
};

export default QuestionCard;
