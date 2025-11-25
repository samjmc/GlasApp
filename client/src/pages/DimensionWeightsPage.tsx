import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import DimensionWeights from '@/components/DimensionWeights';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IdeologicalDimensions } from '@shared/quizTypes';
import LoadingScreen from '@/components/LoadingScreen';

const DimensionWeightsPage: React.FC = () => {
  const [, navigate] = useLocation();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [dimensions, setDimensions] = useState<IdeologicalDimensions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Memoize handleWeightsChange BEFORE any conditional returns
  const handleWeightsChange = React.useCallback((newWeights: Record<string, number>) => {
    setWeights(newWeights);
  }, []);
  
  // Load dimensions from localStorage on component mount
  useEffect(() => {
    try {
      const storedDimensions = localStorage.getItem('tempDimensions');
      console.log("Retrieved from localStorage:", storedDimensions);
      
      if (storedDimensions) {
        const parsedDimensions = JSON.parse(storedDimensions) as IdeologicalDimensions;
        setDimensions(parsedDimensions);
        console.log("Successfully loaded dimensions:", parsedDimensions);
      }
    } catch (error) {
      console.error("Error retrieving dimensions from localStorage:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Show loading screen while fetching dimensions
  if (isLoading) {
    return <LoadingScreen message="Loading dimension data..." />;
  }
  
  // Handle case where no dimensions were found
  if (!dimensions) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle>No Data Found</CardTitle>
            <CardDescription>
              No dimension data found. Please take the political quiz first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/enhanced-quiz')}>
              Take the Enhanced Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const handleContinue = () => {
    // Store both dimensions and weights in localStorage for the results page
    localStorage.setItem('resultsDimensions', JSON.stringify(dimensions));
    localStorage.setItem('resultsWeights', JSON.stringify(weights));
    
    // Navigate to results page without complex URL parameters
    navigate('/enhanced-results');
  };
  
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Customize Your Match Importance</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Adjust how much each political dimension matters when finding your matching parties
        </p>
      </div>
      
      <div className="mb-6">
        <DimensionWeights onWeightsChange={handleWeightsChange} />
      </div>
      
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={() => {
          // Skip weights and use default weights (store only dimensions)
          localStorage.setItem('resultsDimensions', JSON.stringify(dimensions));
          // Don't store custom weights when skipping
          localStorage.removeItem('resultsWeights');
          navigate('/enhanced-results');
        }}>
          Skip (Use Default Weights)
        </Button>
        
        <Button onClick={handleContinue}>
          Continue to Results
        </Button>
      </div>
    </div>
  );
};

export default DimensionWeightsPage;