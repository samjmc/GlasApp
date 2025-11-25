import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet';
import ConstituencyComparison from '../components/ConstituencyComparison';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

const ConstituencyComparisonPage: React.FC = () => {
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['/api/constituencies'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const constituencies = response?.data || [];

  return (
    <div className="container py-6 max-w-7xl mx-auto">
      <Helmet>
        <title>Constituency Comparison | Glas Politics</title>
        <meta name="description" content="Compare the political landscapes of different constituencies across Ireland. Analyze voting patterns, demographic trends, and party support levels." />
      </Helmet>

      <h1 className="text-3xl font-bold mb-6">Constituency Comparison</h1>
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>About Constituency Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This tool allows you to compare different constituencies across Ireland based on election results, demographics,
            and key political issues. Select constituencies to see how they differ on important metrics and better understand 
            the political landscape across different regions.
          </p>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-[300px] w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load constituency data. Please try again later.
          </AlertDescription>
        </Alert>
      ) : (
        <ConstituencyComparison constituencies={constituencies} />
      )}
    </div>
  );
};

export default ConstituencyComparisonPage;