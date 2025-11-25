import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import PersonalizedInsights from '@/components/PersonalizedInsights';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { AlertCircle, BarChart2, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ConstituencyData {
  name: string;
  county?: string;
  seats?: number;
  parties?: Array<{
    name: string;
    percent: number;
    color: string;
    seats?: number;
  }>;
}

interface QuizResult {
  economicScore: number;
  socialScore: number;
  ideology: string;
  description: string;
  timestamp?: string;
}

const PersonalizedInsightsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedConstituency, setSelectedConstituency] = useState<string>('');
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  
  // Fetch all constituencies
  const { data: constituencies, isLoading: isLoadingConstituencies } = useQuery({
    queryKey: ['/api/constituencies'],
    queryFn: async () => {
      const response = await apiRequest({
        path: '/api/constituencies',
        method: 'GET'
      });
      
      return response.success ? response.data : [];
    }
  });
  
  // Fetch user's latest quiz result
  const { data: userQuizResults, isLoading: isLoadingQuizResults } = useQuery({
    queryKey: ['/api/quiz-results/user', user?.id],
    queryFn: async () => {
      // If no user logged in, don't fetch
      if (!user?.id) return null;
      
      try {
        const response = await apiRequest({
          path: `/api/quiz-results/user/${user.id}`,
          method: 'GET'
        });
        
        return response.success && response.data.length > 0 
          ? response.data[0] 
          : null;
      } catch (error) {
        console.error('Error fetching quiz results:', error);
        return null;
      }
    },
    enabled: !!user?.id
  });
  
  // Set quiz result when data is loaded
  useEffect(() => {
    if (userQuizResults) {
      setQuizResult({
        economicScore: parseFloat(userQuizResults.economicScore || '0'),
        socialScore: parseFloat(userQuizResults.socialScore || '0'),
        ideology: userQuizResults.ideology || '',
        description: userQuizResults.description || '',
        timestamp: userQuizResults.createdAt
      });
    }
  }, [userQuizResults]);
  
  // Set default constituency when constituencies are loaded
  useEffect(() => {
    if (constituencies && constituencies.length > 0 && !selectedConstituency) {
      // Try to find Dublin Central as a default or use the first constituency
      const defaultConstituency = constituencies.find((c: any) => c.name === 'Dublin Central') || constituencies[0];
      setSelectedConstituency(defaultConstituency.name);
    }
  }, [constituencies, selectedConstituency]);
  
  const handleConstituencyChange = (value: string) => {
    setSelectedConstituency(value);
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Personalized Constituency Insights</h1>
      
      <div className="mb-6">
        <p className="text-muted-foreground mb-4">
          This tool provides personalized insights based on your political quiz results and constituency data, 
          helping you understand how your political position relates to your local constituency.
        </p>
        
        {!quizResult && !isLoadingQuizResults && (
          <Alert className="mb-4 border-amber-500 text-amber-800 bg-amber-50 dark:text-amber-300 dark:bg-amber-950 dark:border-amber-900">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No quiz results found</AlertTitle>
            <AlertDescription>
              You haven't taken the political quiz yet. To get personalized insights, please complete 
              the quiz first to establish your political position.
              <div className="mt-2">
                <Button size="sm" asChild>
                  <a href="/enhanced-quiz">Take the Quiz</a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {quizResult && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <BarChart2 className="mr-2 h-5 w-5" />
                Your Political Position
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Ideology:</p>
                  <p className="text-base">{quizResult.ideology}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Position:</p>
                  <p className="text-base">
                    Economic: {quizResult.economicScore.toFixed(1)} 
                    ({quizResult.economicScore < 0 ? 'Left' : 'Right'})
                    <span className="mx-2">•</span>
                    Social: {quizResult.socialScore.toFixed(1)}
                    ({quizResult.socialScore < 0 ? 'Progressive' : 'Conservative'})
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="mb-6">
          <label htmlFor="constituency-select" className="block text-sm font-medium mb-2">
            Select a Constituency
          </label>
          
          {isLoadingConstituencies ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select 
              value={selectedConstituency} 
              onValueChange={handleConstituencyChange}
            >
              <SelectTrigger id="constituency-select" className="w-full">
                <SelectValue placeholder="Select a constituency" />
              </SelectTrigger>
              <SelectContent>
                {constituencies?.map((constituency: any) => (
                  <SelectItem key={constituency.name} value={constituency.name}>
                    {constituency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      
      {selectedConstituency && (
        <PersonalizedInsights
          userId={user?.id}
          userEconomicScore={quizResult?.economicScore}
          userSocialScore={quizResult?.socialScore}
          constituencyName={selectedConstituency}
        />
      )}
    </div>
  );
};

export default PersonalizedInsightsPage;