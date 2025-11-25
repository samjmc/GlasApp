import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { IdeologicalDimensions } from '@shared/quizTypes';
import { useAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/queryClient';

interface PoliticalOpinionChangeTrackerProps {
  currentDimensions: IdeologicalDimensions;
}

// Type definition for quiz history result from API
interface QuizHistoryResult {
  id: number;
  user_id: number;
  economic_score: number;
  social_score: number;
  cultural_score: number;
  globalism_score: number;
  environmental_score: number;
  authority_score: number;
  welfare_score: number;
  technocratic_score: number;
  ideology: string | null;
  description: string | null;
  created_at: string;
  is_current: boolean;
}

// Type definition for dimension change
interface DimensionChange {
  dimension: string;
  current: number;
  previous: number;
  change: {
    value: number;
    direction: string;
  };
  significance: 'significant' | 'moderate' | 'minor' | 'none';
}

const PoliticalOpinionChangeTracker: React.FC<PoliticalOpinionChangeTrackerProps> = ({ 
  currentDimensions 
}) => {
  const { isAuthenticated, user } = useAuth();
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  
  // Format dimension name for display
  const formatDimensionName = (name: string): string => {
    const dimensionLabels: Record<string, string> = {
      economic: 'Economic Left - Right',
      social: 'Social Progressive - Conservative',
      cultural: 'Cultural Multicultural - Traditional',
      globalism: 'Globalism Nationalist - Internationalist',
      environmental: 'Environmental Industrial - Ecological',
      authority: 'Authority Libertarian - Authoritarian',
      welfare: 'Welfare Individual - Communitarian',
      technocratic: 'Governance Populist - Technocratic'
    };
    
    return dimensionLabels[name] || name;
  };
  
  // Calculate significance of change
  const getChangeSignificance = (change: number): 'significant' | 'moderate' | 'minor' | 'none' => {
    const absChange = Math.abs(change);
    if (absChange >= 2.5) return 'significant';
    if (absChange >= 1.5) return 'moderate';
    if (absChange >= 0.5) return 'minor';
    return 'none';
  };
  
  // Format change for display
  const formatChange = (current: number, previous: number): { value: number; direction: string } => {
    const diff = current - previous;
    return {
      value: Math.abs(diff),
      direction: diff > 0 ? '→' : diff < 0 ? '←' : '–'
    };
  };
  
  // Fetch quiz history if authenticated
  const { 
    data: historyData, 
    isLoading: historyLoading, 
    isError: historyError 
  } = useQuery({
    queryKey: ['/api/quiz-history/all'],
    queryFn: async () => {
      const response = await apiRequest({
        method: 'GET',
        path: '/api/quiz-history/all'
      });
      return response.data as QuizHistoryResult[];
    },
    enabled: isAuthenticated,
  });
  
  // If not authenticated, show a prompt to log in
  if (!isAuthenticated) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Track Your Political Evolution</CardTitle>
          <CardDescription>
            Create an account to save your quiz results and track how your political views change over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            By logging in, you can:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
            <li>Save your current political profile</li>
            <li>See how your views evolve when you retake the quiz</li>
            <li>Get AI-powered analysis of significant shifts in your ideology</li>
          </ul>
        </CardContent>
      </Card>
    );
  }
  
  // Show loading state
  if (historyLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Political Evolution</CardTitle>
          <CardDescription>
            Loading your political history...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[85%]" />
        </CardContent>
      </Card>
    );
  }
  
  // Show error state
  if (historyError) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Political Evolution</CardTitle>
          <CardDescription>
            There was an error loading your political history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500 mb-4">
            We couldn't load your previous quiz results. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // If no history found, show current results only
  if (!historyData || !Array.isArray(historyData) || historyData.length < 2) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Political Profile</CardTitle>
          <CardDescription>
            Take the quiz again in the future to see how your views change over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(currentDimensions).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm font-medium">{formatDimensionName(key)}</span>
                <Badge variant="outline">{value.toFixed(1)}</Badge>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            This is your first quiz result. Come back later and take the quiz again to see how your views evolve.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Find the previous result to compare with (excluding current)
  const historyResults = Array.isArray(historyData) ? historyData.filter(h => !h.is_current) : [];
  const selectedHistoryItem = selectedHistoryId 
    ? historyResults.find(h => h.id === selectedHistoryId) 
    : historyResults[0];
  
  if (!selectedHistoryItem) {
    return null;
  }
  
  // Calculate changes for each dimension
  const getChanges = (): DimensionChange[] => {
    return [
      {
        dimension: 'economic',
        current: currentDimensions.economic,
        previous: selectedHistoryItem.economic_score,
        change: formatChange(currentDimensions.economic, selectedHistoryItem.economic_score),
        significance: getChangeSignificance(currentDimensions.economic - selectedHistoryItem.economic_score)
      },
      {
        dimension: 'social',
        current: currentDimensions.social,
        previous: selectedHistoryItem.social_score,
        change: formatChange(currentDimensions.social, selectedHistoryItem.social_score),
        significance: getChangeSignificance(currentDimensions.social - selectedHistoryItem.social_score)
      },
      {
        dimension: 'cultural',
        current: currentDimensions.cultural,
        previous: selectedHistoryItem.cultural_score,
        change: formatChange(currentDimensions.cultural, selectedHistoryItem.cultural_score),
        significance: getChangeSignificance(currentDimensions.cultural - selectedHistoryItem.cultural_score)
      },
      {
        dimension: 'globalism',
        current: currentDimensions.globalism,
        previous: selectedHistoryItem.globalism_score,
        change: formatChange(currentDimensions.globalism, selectedHistoryItem.globalism_score),
        significance: getChangeSignificance(currentDimensions.globalism - selectedHistoryItem.globalism_score)
      },
      {
        dimension: 'environmental',
        current: currentDimensions.environmental,
        previous: selectedHistoryItem.environmental_score,
        change: formatChange(currentDimensions.environmental, selectedHistoryItem.environmental_score),
        significance: getChangeSignificance(currentDimensions.environmental - selectedHistoryItem.environmental_score)
      },
      {
        dimension: 'authority',
        current: currentDimensions.authority,
        previous: selectedHistoryItem.authority_score,
        change: formatChange(currentDimensions.authority, selectedHistoryItem.authority_score),
        significance: getChangeSignificance(currentDimensions.authority - selectedHistoryItem.authority_score)
      },
      {
        dimension: 'welfare',
        current: currentDimensions.welfare,
        previous: selectedHistoryItem.welfare_score,
        change: formatChange(currentDimensions.welfare, selectedHistoryItem.welfare_score),
        significance: getChangeSignificance(currentDimensions.welfare - selectedHistoryItem.welfare_score)
      },
      {
        dimension: 'technocratic',
        current: currentDimensions.technocratic,
        previous: selectedHistoryItem.technocratic_score,
        change: formatChange(currentDimensions.technocratic, selectedHistoryItem.technocratic_score),
        significance: getChangeSignificance(currentDimensions.technocratic - selectedHistoryItem.technocratic_score)
      }
    ];
  };
  
  const dimensionChanges = getChanges();
  const significantChanges = dimensionChanges.filter(c => c.significance === 'significant' || c.significance === 'moderate');
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Political Opinion Evolution</CardTitle>
        <CardDescription>
          See how your political views have changed over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {historyResults.length > 1 && (
          <div className="mb-4">
            <label htmlFor="history-select" className="block text-sm font-medium mb-2">
              Compare with:
            </label>
            <select
              id="history-select"
              className="w-full p-2 border rounded-md bg-background"
              value={selectedHistoryId || historyResults[0].id}
              onChange={(e) => setSelectedHistoryId(Number(e.target.value))}
            >
              {historyResults.map((result) => (
                <option key={result.id} value={result.id}>
                  {format(new Date(result.created_at), 'PPP')} - {result.ideology || 'Quiz Result'}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <Tabs defaultValue="changes">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="changes">Changes</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>
          
          <TabsContent value="changes" className="space-y-4 pt-4">
            {dimensionChanges.map((item) => (
              <div key={item.dimension} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{formatDimensionName(item.dimension)}</span>
                  <Badge 
                    variant={
                      item.significance === 'significant' ? 'default' : 
                      item.significance === 'moderate' ? 'secondary' : 
                      'outline'
                    }
                  >
                    {item.change.direction} {item.change.value.toFixed(1)}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current</p>
                    <p className="text-sm font-medium">{item.current.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Previous ({format(new Date(selectedHistoryItem.created_at), 'MMM d, yyyy')})
                    </p>
                    <p className="text-sm font-medium">{item.previous.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>
          
          <TabsContent value="analysis" className="space-y-4 pt-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {significantChanges.length > 0 ? (
                <>
                  Your political views have changed most significantly in the following areas:
                </>
              ) : (
                <>
                  Your political views have remained relatively stable since your last quiz.
                </>
              )}
            </p>
            
            {significantChanges.length > 0 && (
              <ul className="space-y-3">
                {significantChanges.map((change) => (
                  <li key={change.dimension} className="p-3 border rounded-lg">
                    <p className="font-medium">{formatDimensionName(change.dimension)}</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {change.change.direction === '→' ? (
                        <>You've moved <strong>{change.change.value.toFixed(1)} points</strong> toward individual/conservative/</>
                      ) : (
                        <>You've moved <strong>{change.change.value.toFixed(1)} points</strong> toward collective/progressive/</>
                      )}
                      {change.dimension === 'economic' && (change.change.direction === '→' ? 'market-based economics' : 'collective economics')}
                      {change.dimension === 'social' && (change.change.direction === '→' ? 'social conservatism' : 'social progressivism')}
                      {change.dimension === 'cultural' && (change.change.direction === '→' ? 'traditional values' : 'cosmopolitan values')}
                      {change.dimension === 'globalism' && (change.change.direction === '→' ? 'nationalism' : 'internationalism')}
                      {change.dimension === 'environmental' && (change.change.direction === '→' ? 'market-based environmental approaches' : 'interventionist environmental policies')}
                      {change.dimension === 'authority' && (change.change.direction === '→' ? 'authoritarian governance' : 'libertarian governance')}
                      {change.dimension === 'welfare' && (change.change.direction === '→' ? 'self-reliant welfare' : 'communitarian welfare')}
                      {change.dimension === 'technocratic' && (change.change.direction === '→' ? 'populist governance' : 'technocratic governance')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Previous results from {format(new Date(selectedHistoryItem.created_at), 'PPP')}
              </p>
            </div>
          </TabsContent>
        </Tabs>
        
        <Button 
          className="mt-6 w-full"
          variant="outline"
          onClick={() => {
            const saveData = async () => {
              try {
                await apiRequest({
                  method: 'POST',
                  path: '/api/quiz-history/save',
                  body: {
                    dimensions: currentDimensions,
                  }
                });
                
                // Refetch history data
                window.location.reload();
              } catch (error) {
                console.error('Error saving quiz result:', error);
              }
            };
            
            saveData();
          }}
        >
          Save Current Results as New Entry
        </Button>
      </CardContent>
    </Card>
  );
};

export default PoliticalOpinionChangeTracker;