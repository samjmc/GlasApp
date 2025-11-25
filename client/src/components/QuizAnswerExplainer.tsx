import React, { useState, useEffect } from 'react';
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { enhancedQuestions } from '@shared/enhanced-quiz-data';

interface QuizAnswerExplainerProps {
  userResponses: Array<{
    questionId: number;
    answerId?: number;
    customAnswer?: string;
  }>;
}

interface ExplanationRequest {
  questionId: number;
  answerId?: number;
  customAnswer?: string;
  customQuestion?: string;
}

interface ExplanationResponse {
  question: string;
  answer: string;
  explanation: string;
  dimensions: {
    dimension: string;
    score: number;
    reason: string;
  }[];
  alternative_perspectives: string[];
  learning_resources: {
    title: string;
    description: string;
    url?: string;
  }[];
}

const QuizAnswerExplainer: React.FC<QuizAnswerExplainerProps> = ({ userResponses }) => {
  const [selectedResponse, setSelectedResponse] = useState<ExplanationRequest | null>(null);
  const [customQuestion, setCustomQuestion] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  
  // Reset selected response when user responses change (which happens when quiz is retaken)
  useEffect(() => {
    setSelectedResponse(null);
    setIsCustom(false);
  }, [userResponses]);
  
  // Fetch explanation for the selected response
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['/api/enhanced-profile/explain-answer', selectedResponse, userResponses.length],
    queryFn: async () => {
      if (!selectedResponse) return null;
      
      const response = await apiRequest({
        method: 'POST',
        path: '/api/enhanced-profile/explain-answer',
        body: selectedResponse
      });
      return response.data as ExplanationResponse;
    },
    enabled: !!selectedResponse,
  });

  // Function to handle selecting a response to explain
  const handleSelectResponse = (questionId: number, answerId?: number, customAnswer?: string) => {
    setSelectedResponse({ 
      questionId, 
      answerId, 
      customAnswer 
    });
    setIsCustom(false);
  };

  // Function to handle custom question submission
  const handleCustomQuestionSubmit = () => {
    if (customQuestion.trim() && customAnswer.trim()) {
      setSelectedResponse({
        questionId: 0, // Placeholder ID for custom questions
        customQuestion: customQuestion.trim(),
        customAnswer: customAnswer.trim()
      });
      setIsCustom(true);
    }
  };

  // Reset selection
  const handleReset = () => {
    setSelectedResponse(null);
    setCustomQuestion('');
    setCustomAnswer('');
    setIsCustom(false);
  };

  // Helper to get question text by ID
  const getQuestionText = (questionId: number) => {
    const question = enhancedQuestions.find(q => q.id === questionId);
    return question ? question.text : `Question ${questionId}`;
  };

  // Helper to get answer text by question ID and answer ID
  const getAnswerText = (questionId: number, answerId?: number, customAnswer?: string) => {
    if (customAnswer) return customAnswer;
    
    const question = enhancedQuestions.find(q => q.id === questionId);
    if (!question || answerId === undefined) return 'Unknown answer';
    
    return question.answers[answerId]?.text || 'Unknown answer';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Question Your Results</CardTitle>
        <CardDescription>
          Challenge or explore why an answer was classified in a certain way
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!selectedResponse ? (
          <div className="space-y-6">
            {/* Past responses section - now as a dropdown */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Your Quiz Answers</h3>
              {userResponses.length > 0 ? (
                <div className="space-y-4">
                  <Label htmlFor="quiz-answer-select">Select a question to analyze:</Label>
                  <Select onValueChange={(value) => {
                    const selectedIndex = parseInt(value);
                    const response = userResponses[selectedIndex];
                    if (response) {
                      handleSelectResponse(response.questionId, response.answerId, response.customAnswer);
                    }
                  }}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a question from your quiz" />
                    </SelectTrigger>
                    <SelectContent>
                      {userResponses.map((response, index) => (
                        <SelectItem key={index} value={index.toString()}>
                          <div className="py-1">
                            <div className="font-medium text-sm">
                              {getQuestionText(response.questionId)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Your answer: {getAnswerText(response.questionId, response.answerId, response.customAnswer)}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-gray-500 italic">No quiz answers found. Complete the quiz to see your answers here.</p>
              )}
            </div>
            
            {/* Ask your own question section */}
            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold mb-3">Ask Your Own Question</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-question">Your Political Question</Label>
                  <Textarea 
                    id="custom-question"
                    placeholder="e.g., Why is support for increased minimum wage considered left-wing?"
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="custom-answer">Your Answer or Position</Label>
                  <Textarea 
                    id="custom-answer"
                    placeholder="e.g., I think minimum wage should be determined by local economic conditions rather than set federally."
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <Button 
                  onClick={handleCustomQuestionSubmit}
                  disabled={!customQuestion.trim() || !customAnswer.trim()}
                  className="w-full"
                >
                  Get Explanation
                </Button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="pt-4">
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        ) : isError ? (
          <div className="space-y-4">
            <p className="text-red-500">
              {error instanceof Error ? error.message : "An error occurred while generating the explanation"}
            </p>
            <Button onClick={handleReset} variant="outline">
              Try Another Question
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-1">{typeof data.question === 'string' ? data.question : JSON.stringify(data.question)}</h3>
              <div className="bg-primary/5 p-3 rounded-md mb-4">
                <p className="font-medium">Your answer:</p>
                <p className="text-gray-700 dark:text-gray-300">{typeof data.answer === 'string' ? data.answer : JSON.stringify(data.answer)}</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Explanation</h4>
                  <p className="text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{typeof data.explanation === 'string' ? data.explanation : JSON.stringify(data.explanation, null, 2)}</p>
                </div>
                
                <div>
                  <h4 className="font-medium">Ideological Dimensions</h4>
                  <div className="mt-2 space-y-3">
                    {data.dimensions.map((dim, index) => (
                      <div key={index} className="border-b pb-3 last:border-0">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{dim.dimension}</span>
                          <span className={`${dim.score > 0 ? 'text-blue-500' : dim.score < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {dim.score > 0 ? '+' : ''}{dim.score}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                          {typeof dim.reason === 'string' ? dim.reason : JSON.stringify(dim.reason, null, 2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium">Alternative Perspectives</h4>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    {data.alternative_perspectives.map((perspective, index) => (
                      <li key={index} className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{typeof perspective === 'string' ? perspective : JSON.stringify(perspective, null, 2)}</li>
                    ))}
                  </ul>
                </div>
                
                {data.learning_resources.length > 0 && (
                  <div>
                    <h4 className="font-medium">Learn More</h4>
                    <div className="mt-2 space-y-2">
                      {data.learning_resources.map((resource, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                          <h5 className="font-medium">{typeof resource.title === 'string' ? resource.title : JSON.stringify(resource.title)}</h5>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{typeof resource.description === 'string' ? resource.description : JSON.stringify(resource.description)}</p>
                          {resource.url && (
                            <a 
                              href={resource.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline mt-1 inline-block"
                            >
                              Learn more
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                Back to Questions
              </Button>
              
              {isCustom && (
                <Button variant="secondary" onClick={() => refetch()}>
                  Regenerate Explanation
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default QuizAnswerExplainer;