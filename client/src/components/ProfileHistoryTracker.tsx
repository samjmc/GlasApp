import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { IdeologicalDimensions } from '@shared/quizTypes';
import { format } from 'date-fns';

// Interface for quiz results
interface QuizResult {
  id: number;
  userId: number;
  economic: number;
  social: number;
  cultural: number;
  globalism: number;
  environmental: number;
  authority: number;
  welfare: number;
  technocratic: number;
  createdAt: string;
  ideology?: string;
  description?: string;
}

// Props for the component
interface ProfileHistoryTrackerProps {
  currentResults: IdeologicalDimensions;
  previousResults?: QuizResult[];
}

const ProfileHistoryTracker: React.FC<ProfileHistoryTrackerProps> = ({ 
  currentResults,
  previousResults = []
}) => {
  const { isAuthenticated } = useAuth();
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null);
  
  // Format the results for comparison
  const formatResults = (results: IdeologicalDimensions) => {
    return [
      { dimension: 'Economic Left - Right', value: results.economic },
      { dimension: 'Social Progressive - Conservative', value: results.social },
      { dimension: 'Cultural Multicultural - Traditional', value: results.cultural },
      { dimension: 'Globalism Nationalist - Internationalist', value: results.globalism },
      { dimension: 'Environmental Industrial - Ecological', value: results.environmental },
      { dimension: 'Authority Libertarian - Authoritarian', value: results.authority },
      { dimension: 'Welfare Individual - Communitarian', value: results.welfare },
      { dimension: 'Governance Populist - Technocratic', value: results.technocratic }
    ];
  };
  
  // Calculate the change between two scores
  const calculateChange = (current: number, previous: number) => {
    const difference = current - previous;
    const formattedDiff = difference.toFixed(1);
    const arrow = difference > 0 ? '↑' : difference < 0 ? '↓' : '→';
    
    return { 
      value: Math.abs(difference).toFixed(1), 
      direction: arrow,
      raw: difference
    };
  };
  
  // Get the selected previous result for comparison
  const selectedResult = previousResults.find(result => result.id === selectedResultId) || previousResults[0];
  
  // If there are no previous results, show a simple view of current results
  if (!isAuthenticated || previousResults.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Your Political Profile</CardTitle>
          <CardDescription>
            {isAuthenticated 
              ? "Take the quiz again to see how your views change over time" 
              : "Log in to save your results and track changes over time"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {formatResults(currentResults).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{item.dimension}</span>
                <Badge variant="outline">{item.value.toFixed(1)}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Format the current results
  const formattedCurrentResults = formatResults(currentResults);
  
  // Format the previous results if available
  const formattedPreviousResults = selectedResult ? formatResults({
    economic: selectedResult.economic,
    social: selectedResult.social,
    cultural: selectedResult.cultural,
    globalism: selectedResult.globalism,
    environmental: selectedResult.environmental,
    authority: selectedResult.authority,
    welfare: selectedResult.welfare,
    technocratic: selectedResult.technocratic
  }) : [];
  
  // Calculate changes
  const changes = formattedCurrentResults.map((current, index) => {
    if (!selectedResult) return { value: '0.0', direction: '→', raw: 0 };
    return calculateChange(current.value, formattedPreviousResults[index].value);
  });
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Political Profile Evolution</CardTitle>
        <CardDescription>
          See how your political views have changed over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {previousResults.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Compare current results with:</label>
            <select 
              className="w-full p-2 border rounded-md" 
              value={selectedResultId || previousResults[0].id}
              onChange={(e) => setSelectedResultId(Number(e.target.value))}
            >
              {previousResults.map((result) => (
                <option key={result.id} value={result.id}>
                  {format(new Date(result.createdAt), 'PPP')} - {result.ideology || 'Results'}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="space-y-4">
          {formattedCurrentResults.map((item, index) => {
            const change = changes[index];
            const isSignificantChange = Math.abs(change.raw) >= 2.0;
            
            return (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{item.dimension}</span>
                  {selectedResult && (
                    <Badge variant={isSignificantChange ? "default" : "outline"}>
                      {change.direction} {change.value}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Current</p>
                    <p className="text-sm font-medium">{item.value.toFixed(1)}</p>
                  </div>
                  
                  {selectedResult && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Previous ({format(new Date(selectedResult.createdAt), 'MMM d, yyyy')})
                      </p>
                      <p className="text-sm font-medium">{formattedPreviousResults[index].value.toFixed(1)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {selectedResult && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Analysis</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Your most significant shifts have been in 
              {changes
                .map((change, i) => Math.abs(change.raw) >= 1.5 ? formattedCurrentResults[i].dimension.split(' ')[0] : null)
                .filter(Boolean)
                .join(', ')}
              {' '}dimensions.
            </p>
            
            {selectedResult && selectedResult.createdAt && (
              <p className="text-sm text-gray-500 mt-4">
                Previous results from {format(new Date(selectedResult.createdAt), 'PPP')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileHistoryTracker;