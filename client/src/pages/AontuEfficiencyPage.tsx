import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { EfficiencyDisplay } from '@/components/EfficiencyMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Users } from 'lucide-react';

export default function AontuEfficiencyPage() {
  const { data: aontuData, isLoading } = useQuery({
    queryKey: ['/api/pledges/party/8'], // Aontú party ID
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!aontuData?.success || !aontuData.data || aontuData.data.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Aontú Efficiency Analysis</CardTitle>
            <CardDescription>No pledge data available for analysis</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { data: pledges, metadata } = aontuData;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Aontú Efficiency Analysis</h1>
            <p className="text-muted-foreground">Performance metrics accounting for party size and TD influence</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Party Representation</p>
                  <p className="text-2xl font-bold">{metadata.numberOfTDs} TDs</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Contribution</p>
                  <p className="text-2xl font-bold">{metadata.totalContribution} pp</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Efficiency Score</p>
                  <p className="text-2xl font-bold text-primary">{metadata.overallEfficiency} pp/TD</p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {metadata.overallEfficiency >= 2.0 ? 'Excellent' : 
                   metadata.overallEfficiency >= 1.0 ? 'Good' : 
                   metadata.overallEfficiency >= 0.5 ? 'Fair' : 'Developing'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Analysis Overview</CardTitle>
            <CardDescription>
              This analysis accounts for Aontú's representation of only 2 TDs out of 160 in the Dáil, 
              measuring their effectiveness relative to their parliamentary influence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Key Insights</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Small party with focused policy agenda</li>
                  <li>• Limited parliamentary influence (1.25% of Dáil)</li>
                  <li>• Efficiency measured per TD to enable fair comparison</li>
                  <li>• Success based on policy influence rather than implementation</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Methodology</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Score: Current fulfillment percentage</li>
                  <li>• Weight: Platform importance (totals 100%)</li>
                  <li>• Contribution: Score × Weight ÷ 100</li>
                  <li>• Efficiency: Contribution ÷ Number of TDs</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EfficiencyDisplay pledges={pledges} metadata={metadata} />
      
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Comparative Context</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Aontú's efficiency score of {metadata.overallEfficiency} pp/TD reflects their ability to influence 
            policy debate and parliamentary discourse despite minimal representation. This metric enables 
            fair comparison with larger parties by accounting for different levels of parliamentary influence.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h5 className="font-semibold text-blue-900 mb-2">Strengths</h5>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Strong performance on immigration policy influence</li>
                <li>• Successful defense of military deployment oversight</li>
                <li>• Clear policy positions generating debate</li>
              </ul>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <h5 className="font-semibold text-orange-900 mb-2">Challenges</h5>
              <ul className="text-sm text-orange-800 space-y-1">
                <li>• Limited ability to drive legislative change</li>
                <li>• Dependent on larger parties for policy implementation</li>
                <li>• Focus on advocacy rather than governance</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}