import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useMultidimensionalQuiz } from '@/contexts/MultidimensionalQuizContext';
import { UserResponse, MultidimensionalQuizResult } from '@shared/quizTypes';
import { enhancedQuestions } from '@shared/enhanced-quiz-data';

const SampleResultsGenerator: React.FC = () => {
  const { setResponses } = useMultidimensionalQuiz();
  const { toast } = useToast();

  const handleGenerateSampleResults = () => {
    // Generate truly random dimensions between -5 and 5
    const generateRandomDimension = () => Math.round((Math.random() * 10 - 5) * 10) / 10;
    
    // Generate unique dimension values
    const timestamp = new Date().getTime();
    const economic = generateRandomDimension();
    const social = generateRandomDimension();
    const cultural = generateRandomDimension();
    const globalism = generateRandomDimension();
    const environmental = generateRandomDimension();
    const authority = generateRandomDimension();
    const welfare = generateRandomDimension();
    const technocratic = generateRandomDimension();
    
    // Random sample responses
    const randomResponses: UserResponse[] = enhancedQuestions.slice(0, 10).map((q) => ({
      questionId: q.id,
      answerId: Math.floor(Math.random() * q.answers.length)
    }));
    
    // Prepare sample result
    const sampleResult: MultidimensionalQuizResult = {
      economic,
      social,
      cultural,
      globalism,
      environmental,
      authority,
      welfare,
      technocratic,
      ideology: `Random Test Profile ${timestamp.toString().slice(-4)}`,
      description: "Randomly generated profile for testing party matches",
      dimensionBreakdown: {
        economic: { 
          score: economic, 
          explanation: "Random test position on economic issues", 
          influence: "This score affects your matches with parties on economic policies"
        },
        social: { 
          score: social, 
          explanation: "Random test position on social issues", 
          influence: "This score affects your matches with parties on social policies"
        },
        cultural: { 
          score: cultural, 
          explanation: "Random test position on cultural issues", 
          influence: "This score affects your matches with parties on cultural policies"
        },
        globalism: { 
          score: globalism, 
          explanation: "Random test position on global issues", 
          influence: "This score affects your matches with parties on international policies"
        },
        environmental: { 
          score: environmental, 
          explanation: "Random test position on environmental issues", 
          influence: "This score affects your matches with parties on environmental policies"
        },
        authority: { 
          score: authority, 
          explanation: "Random test position on authority issues", 
          influence: "This score affects your matches with parties on governance"
        },
        welfare: { 
          score: welfare, 
          explanation: "Random test position on welfare issues", 
          influence: "This score affects your matches with parties on welfare policies"
        },
        technocratic: { 
          score: technocratic, 
          explanation: "Random test position on technocratic issues", 
          influence: "This score affects your matches with parties on expert-driven policies"
        }
      },
      responses: randomResponses,
      timestamp: new Date().toISOString()
    };
    
    // Update the context
    setResponses(randomResponses);
    
    // Clear localStorage first
    localStorage.removeItem('multidimensionalQuizResults');
    localStorage.removeItem('multidimensionalQuizResponses');
    localStorage.removeItem('multidimensionalResultsCalculated');
    
    // Set new values in localStorage
    localStorage.setItem('multidimensionalQuizResults', JSON.stringify(sampleResult));
    localStorage.setItem('multidimensionalQuizResponses', JSON.stringify(randomResponses));
    localStorage.setItem('multidimensionalResultsCalculated', 'true');
    
    toast({
      title: "Random Results Generated",
      description: "Created unique political profile. Redirecting to results...",
      duration: 2000
    });
    
    // Force browser to navigate to the results page with a full page refresh
    window.location.href = '/enhanced-results';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test the Quiz Explainer</CardTitle>
        <CardDescription>
          Generate sample quiz results to see how the "Question Your Results" feature works
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Click to generate random political profiles with different party matches each time.
        </p>
        <Button onClick={handleGenerateSampleResults}>
          Generate Random Results
        </Button>
      </CardContent>
    </Card>
  );
};

export default SampleResultsGenerator;