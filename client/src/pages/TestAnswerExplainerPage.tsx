import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from '@/components/LoadingScreen';
import QuizAnswerExplainer from '@/components/QuizAnswerExplainer';
import { useMultidimensionalQuiz } from '@/contexts/MultidimensionalQuizContext';

const TestAnswerExplainerPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);

  // Sample results data to demonstrate the quiz answer explainer
  const sampleResponses = [
    { questionId: 1, answerId: 0 },
    { questionId: 2, answerId: 1 },
    { questionId: 3, answerId: 2 },
    { questionId: 4, customAnswer: "I believe this should be evaluated case by case rather than having a universal rule." },
    { questionId: 5, answerId: 0 },
    { questionId: 6, answerId: 1 },
    { questionId: 7, answerId: 2 },
    { questionId: 8, answerId: 0 },
    { questionId: 9, answerId: 1 },
    { questionId: 10, answerId: 2 }
  ];

  useEffect(() => {
    // Simulate loading for a smooth transition
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleBackToHome = () => {
    setLocation('/');
  };

  if (isLoading) {
    return <LoadingScreen message="Loading answer explainer demonstration..." />;
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Question Your Results</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Test the new feature that explains why answers are classified in specific ways
          </p>
        </div>
        
        <div className="space-y-8">
          <QuizAnswerExplainer userResponses={sampleResponses} />
          
          <Card>
            <CardHeader>
              <CardTitle>About This Feature</CardTitle>
              <CardDescription>
                How the Quiz Answer Explainer works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                The "Question Your Results" feature lets users understand why their answers are classified in certain ways. It provides:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Detailed explanations of how each answer influences your political profile</li>
                <li>Breakdowns by ideological dimension to show which aspects are affected</li>
                <li>Alternative perspectives to provide balanced viewpoints</li>
                <li>Learning resources for deeper understanding of political concepts</li>
              </ul>
              <div className="pt-4">
                <Button onClick={handleBackToHome}>
                  Return to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestAnswerExplainerPage;