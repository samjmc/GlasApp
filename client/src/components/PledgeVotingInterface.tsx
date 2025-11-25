import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Users, BarChart3 } from 'lucide-react';

interface PledgeVotingInterfaceProps {
  partyId: string;
  onWeightedScoreChange?: (score: number) => void;
}

const PledgeVotingInterface: React.FC<PledgeVotingInterfaceProps> = ({ 
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
      return apiRequest('/api/category-ranking/submit-ranking', {
        method: 'POST',
        body: JSON.stringify({ rankings })
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
    if (weightedPerformance?.data?.weightedScore && onWeightedScoreChange) {
      onWeightedScoreChange(weightedPerformance.data.weightedScore);
    }
  }, [weightedPerformance, onWeightedScoreChange]);

  return (
    <div className="space-y-6">
      {/* Current Weighted Performance */}
      {weightedPerformance?.data && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              <CardTitle>Weighted Performance Score</CardTitle>
            </div>
            <CardDescription>
              Based on all user rankings ({weightedPerformance.data.totalVotes} votes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weightedPerformance.data.weightedScore !== undefined && (
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
              
              {weightedPerformance.data.categoryBreakdown && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium">Category Breakdown</h4>
                  {Object.entries(weightedPerformance.data.categoryBreakdown).map(([category, data]: [string, any]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize">{category.replace('_', ' ')}</span>
                      <span>{data.score?.toFixed(1)}% (weight: {data.weight?.toFixed(0)}%)</span>
                    </div>
                  ))}
                </div>
              )}

              {weightedPerformance.data.categoryWeights && (
                <div className="mt-4 space-y-2">
                  <h4 className="font-medium">Current Community Weights</h4>
                  {Object.entries(weightedPerformance.data.categoryWeights).map(([category, weight]: [string, any]) => (
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

export default PledgeVotingInterface;