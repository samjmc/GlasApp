import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { DIMENSION_POLES, IDEOLOGY_DIMENSIONS, type IdeologyDimension } from '@shared/ideology';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMyQuizResults } from '@/lib/ideologyApi';
import { queryKeys } from '@/lib/queryKeys';

type Significance = 'significant' | 'moderate' | 'minor' | 'none';

interface DimensionChange {
  dimension: IdeologyDimension;
  current: number;
  previous: number;
  diff: number;
  significance: Significance;
}

const formatDimensionName = (d: IdeologyDimension): string => {
  const { label, negative, positive } = DIMENSION_POLES[d];
  return `${label} ${negative} - ${positive}`;
};

const getChangeSignificance = (change: number): Significance => {
  const absChange = Math.abs(change);
  if (absChange >= 2.5) return 'significant';
  if (absChange >= 1.5) return 'moderate';
  if (absChange >= 0.5) return 'minor';
  return 'none';
};

const formatDate = (iso: string | null, pattern: string) => (iso ? format(new Date(iso), pattern) : 'Unknown date');

/**
 * Compares the signed-in user's latest saved quiz result with an earlier one
 * (GET /api/quiz/me). Renders nothing when signed out or with fewer than two results.
 */
const PoliticalOpinionChangeTracker: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const { data: history } = useQuery({
    queryKey: queryKeys.quiz.mine(user?.id),
    queryFn: fetchMyQuizResults,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated || !history || history.length < 2) {
    return null;
  }

  const [latest, ...earlier] = history;
  const previous = earlier.find((h) => h.id === selectedHistoryId) ?? earlier[0];

  const dimensionChanges: DimensionChange[] = IDEOLOGY_DIMENSIONS.map((dimension) => {
    const current = latest.vector[dimension];
    const prior = previous.vector[dimension];
    return {
      dimension,
      current,
      previous: prior,
      diff: current - prior,
      significance: getChangeSignificance(current - prior),
    };
  });
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
        {earlier.length > 1 && (
          <div className="mb-4">
            <label htmlFor="history-select" className="block text-sm font-medium mb-2">
              Compare with:
            </label>
            <select
              id="history-select"
              className="w-full p-2 border rounded-md bg-background"
              value={previous.id ?? ''}
              onChange={(e) => setSelectedHistoryId(Number(e.target.value))}
            >
              {earlier.map((result) => (
                <option key={result.id} value={result.id ?? ''}>
                  {formatDate(result.createdAt, 'PPP')} - {result.ideology || 'Quiz Result'}
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
                    {item.diff > 0 ? '→' : item.diff < 0 ? '←' : '–'} {Math.abs(item.diff).toFixed(1)}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Latest ({formatDate(latest.createdAt, 'MMM d, yyyy')})</p>
                    <p className="text-sm font-medium">{item.current.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">
                      Previous ({formatDate(previous.createdAt, 'MMM d, yyyy')})
                    </p>
                    <p className="text-sm font-medium">{item.previous.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4 pt-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {significantChanges.length > 0
                ? 'Your political views have changed most significantly in the following areas:'
                : 'Your political views have remained relatively stable since your last quiz.'}
            </p>

            {significantChanges.length > 0 && (
              <ul className="space-y-3">
                {significantChanges.map((change) => {
                  const poles = DIMENSION_POLES[change.dimension];
                  return (
                    <li key={change.dimension} className="p-3 border rounded-lg">
                      <p className="font-medium">{formatDimensionName(change.dimension)}</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        You've moved <strong>{Math.abs(change.diff).toFixed(1)} points</strong> toward{' '}
                        {change.diff > 0 ? poles.positive : poles.negative}.
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Previous results from {formatDate(previous.createdAt, 'PPP')}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PoliticalOpinionChangeTracker;
