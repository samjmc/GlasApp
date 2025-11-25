import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Info, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CategoryRankingInterfaceProps {
  partyId: string;
  onWeightedScoreChange?: (score: number) => void;
}

const CategoryRankingInterface: React.FC<CategoryRankingInterfaceProps> = ({ 
  partyId, 
  onWeightedScoreChange 
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [categories, setCategories] = useState([
    { key: 'taxation', name: 'Cost of Living & Tax', description: 'Income tax, USC, pensions, childcare costs', rank: 1 },
    { key: 'housing', name: 'Housing', description: 'Home building, Help-to-Buy, rent supports', rank: 2 },
    { key: 'health', name: 'Health', description: 'Hospital capacity, GP care, drug costs', rank: 3 },
    { key: 'infrastructure', name: 'Infrastructure', description: 'Water, electricity grid, transport investment', rank: 4 }
  ]);

  const [isDragging, setIsDragging] = useState<string | null>(null);

  // Fetch current ranking weights based on all users' votes
  const { data: weightedPerformance, refetch: refetchWeightedPerformance } = useQuery({
    queryKey: ['/api/category-ranking/weighted-performance', partyId],
    enabled: !!partyId,
  });

  // Submit ranking mutation
  const submitRanking = useMutation({
    mutationFn: async (rankings: { category: string; rank: number }[]) => {
      return apiRequest<{ success: boolean; message?: string }>({
        method: 'POST',
        path: '/api/category-ranking/submit-ranking',
        body: { rankings }
      });
    },
    onSuccess: () => {
      toast({
        title: "Ranking Submitted",
        description: "Your category importance ranking has been recorded."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/category-ranking/weighted-performance'] });
      refetchWeightedPerformance();
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Failed to submit your ranking. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDragStart = (categoryKey: string) => {
    setIsDragging(categoryKey);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCategoryKey: string) => {
    e.preventDefault();
    
    if (!isDragging || isDragging === targetCategoryKey) {
      setIsDragging(null);
      return;
    }

    const draggedCategory = categories.find(cat => cat.key === isDragging);
    const targetCategory = categories.find(cat => cat.key === targetCategoryKey);
    
    if (!draggedCategory || !targetCategory) return;

    const newCategories = categories.map(cat => {
      if (cat.key === isDragging) {
        return { ...cat, rank: targetCategory.rank };
      } else if (cat.key === targetCategoryKey) {
        return { ...cat, rank: draggedCategory.rank };
      }
      return cat;
    });

    setCategories(newCategories.sort((a, b) => a.rank - b.rank));
    setIsDragging(null);
  };

  const handleSubmit = () => {
    const rankings = categories.map(cat => ({
      category: cat.key,
      rank: cat.rank
    }));
    
    submitRanking.mutate(rankings);
  };

  const getRankWeight = (rank: number) => {
    // Convert rank to weight: rank 1 = 40%, rank 2 = 30%, rank 3 = 20%, rank 4 = 10%
    switch (rank) {
      case 1: return 40;
      case 2: return 30;
      case 3: return 20;
      case 4: return 10;
      default: return 0;
    }
  };

  useEffect(() => {
    if (weightedPerformance && typeof weightedPerformance === 'object' && 'data' in weightedPerformance && weightedPerformance.data && typeof weightedPerformance.data === 'object' && 'weightedScore' in weightedPerformance.data && typeof weightedPerformance.data.weightedScore === 'number' && onWeightedScoreChange) {
      onWeightedScoreChange(weightedPerformance.data.weightedScore);
    }
  }, [weightedPerformance, onWeightedScoreChange]);

  return (
    <div className="space-y-6">
      {/* Pledge Interpretation Guidelines */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How to interpret pledge percentages:</strong><br />
          • 0% means no delivery so far<br />
          • 1–49% indicates planning or partial steps<br />
          • 50–99% indicates substantial delivery of the key elements<br />
          • 100% means the pledge milestone for 2024–25 has been met
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Category Importance Ranking</CardTitle>
          </div>
          <CardDescription>
            Drag to rank categories by importance. The most common ranking across all users determines the weights.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.key}
                draggable
                onDragStart={() => handleDragStart(category.key)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, category.key)}
                className={`
                  p-4 border rounded-lg cursor-move transition-all
                  ${isDragging === category.key ? 'opacity-50 bg-blue-50' : 'hover:bg-gray-50'}
                  ${category.rank === 1 ? 'border-blue-500 bg-blue-50' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={category.rank === 1 ? 'default' : 'secondary'}>
                          #{category.rank}
                        </Badge>
                        <h4 className="font-medium">{category.name}</h4>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {getRankWeight(category.rank)}%
                    </div>
                    <div className="text-sm text-gray-500">weight</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button 
            onClick={handleSubmit}
            disabled={submitRanking.isPending}
            className="w-full"
          >
            {submitRanking.isPending ? 'Submitting...' : 'Submit My Ranking'}
          </Button>
        </CardContent>
      </Card>

      {/* Current Weighted Performance */}
      {weightedPerformance && typeof weightedPerformance === 'object' && 'data' in weightedPerformance && weightedPerformance.data && (
        <Card>
          <CardHeader>
            <CardTitle>Current Weighted Performance</CardTitle>
            <CardDescription>
              Based on all user rankings ({'totalVotes' in weightedPerformance.data ? weightedPerformance.data.totalVotes : 0} votes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {'weightedScore' in weightedPerformance.data && typeof weightedPerformance.data.weightedScore === 'number' && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Overall Score</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {weightedPerformance.data.weightedScore.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={weightedPerformance.data.weightedScore} className="h-3" />
                </>
              )}
              
              {'categoryBreakdown' in weightedPerformance.data && weightedPerformance.data.categoryBreakdown && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium">Category Breakdown</h4>
                  {Object.entries(weightedPerformance.data.categoryBreakdown as Record<string, any>).map(([category, data]: [string, any]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize">{category.replace('_', ' ')}</span>
                      <span>{data.score?.toFixed(1)}% (weight: {data.weight?.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}

              {'categoryWeights' in weightedPerformance.data && weightedPerformance.data.categoryWeights && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium">Current Weights</h4>
                  {Object.entries(weightedPerformance.data.categoryWeights as Record<string, any>).map(([category, weight]: [string, any]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize">{category.replace('_', ' ')}</span>
                      <span>{weight}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CategoryRankingInterface;