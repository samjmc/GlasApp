import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getPersonalizedInsights, type Insight } from '@/services/personalizedInsightsService';
import { AlertCircle, AlertTriangle, ArrowRight, Lightbulb, TrendingUp, Users, Vote } from 'lucide-react';

interface PersonalizedInsightsProps {
  userId?: number;
  constituencyName: string;
  userEconomicScore?: number;
  userSocialScore?: number;
}

const InsightIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'alignment':
      return <Vote className="h-5 w-5 text-blue-500" />;
    case 'trend':
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    case 'demographic':
      return <Users className="h-5 w-5 text-purple-500" />;
    case 'opportunity':
      return <Lightbulb className="h-5 w-5 text-amber-500" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    default:
      return <ArrowRight className="h-5 w-5 text-gray-500" />;
  }
};

const PersonalizedInsights: React.FC<PersonalizedInsightsProps> = ({
  userId,
  constituencyName,
  userEconomicScore,
  userSocialScore
}) => {
  // Fetch personalized insights from the API
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['/api/personalized-insights', userId, constituencyName, userEconomicScore, userSocialScore],
    queryFn: async () => {
      return getPersonalizedInsights({
        userId,
        constituencyName,
        userEconomicScore,
        userSocialScore
      });
    },
    // Only fetch if we have a constituency name and at least one of userId or scores
    enabled: !!constituencyName && (!!userId || (userEconomicScore !== undefined && userSocialScore !== undefined)),
    // Refetch when constituency changes
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Your Personalized Insights</h2>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading insights</AlertTitle>
        <AlertDescription>
          We couldn't load personalized insights at this time. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Alert className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No insights available</AlertTitle>
        <AlertDescription>
          {!userEconomicScore || !userSocialScore 
            ? "Take the political quiz to get personalized insights about this constituency."
            : "We couldn't generate insights for this constituency. Try selecting a different one."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Your Personalized Insights for {constituencyName}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((insight: Insight, index: number) => (
          <Card key={index} className={`overflow-hidden border-l-4 ${getBorderColor(insight.type)}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <span className="mr-2"><InsightIcon type={insight.type} /></span>
                {insight.title}
              </CardTitle>
              <CardDescription>{getInsightTypeLabel(insight.type)}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>{insight.description}</p>
            </CardContent>
            {insight.tags && insight.tags.length > 0 && (
              <CardFooter className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {insight.tags.map((tag, tagIndex) => (
                    <span 
                      key={tagIndex} 
                      className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

// Helper function to get border color based on insight type
function getBorderColor(type: string): string {
  switch (type) {
    case 'alignment':
      return 'border-blue-500';
    case 'trend':
      return 'border-green-500';
    case 'demographic':
      return 'border-purple-500';
    case 'opportunity':
      return 'border-amber-500';
    case 'warning':
      return 'border-orange-500';
    default:
      return 'border-gray-300';
  }
}

// Helper function to get human-readable label for insight type
function getInsightTypeLabel(type: string): string {
  switch (type) {
    case 'alignment':
      return 'Political Alignment';
    case 'trend':
      return 'Political Trend';
    case 'demographic':
      return 'Demographic Insight';
    case 'opportunity':
      return 'Engagement Opportunity';
    case 'warning':
      return 'Potential Challenge';
    default:
      return 'General Insight';
  }
}

export default PersonalizedInsights;