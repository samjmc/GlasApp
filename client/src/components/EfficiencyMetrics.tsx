import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Users, Target, Calculator } from 'lucide-react';

interface EfficiencyMetricsProps {
  partyName: string;
  numberOfTDs: number;
  totalContribution: number;
  overallEfficiency: number;
  pledgeCount: number;
}

interface PledgeWithEfficiency {
  pledge: {
    id: number;
    title: string;
    score: number;
    defaultWeight: number;
    contribution: number;
    efficiencyScore: number;
    category: string;
  };
  partyName: string;
}

interface EfficiencyDisplayProps {
  pledges: PledgeWithEfficiency[];
  metadata: EfficiencyMetricsProps;
}

export function EfficiencyMetrics({ partyName, numberOfTDs, totalContribution, overallEfficiency, pledgeCount }: EfficiencyMetricsProps) {
  const getEfficiencyRating = (efficiency: number) => {
    if (efficiency >= 2.0) return { label: 'Excellent', color: 'bg-green-500' };
    if (efficiency >= 1.0) return { label: 'Good', color: 'bg-blue-500' };
    if (efficiency >= 0.5) return { label: 'Fair', color: 'bg-yellow-500' };
    return { label: 'Needs Improvement', color: 'bg-red-500' };
  };

  const rating = getEfficiencyRating(overallEfficiency);

  return (
    <Card className="mx-auto mb-6 w-full max-w-[400px] sm:max-w-none">
      <CardHeader className="px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calculator className="h-5 w-5" />
          {partyName} Efficiency Metrics
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Performance analysis based on TD influence and pledge outcomes
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-5 sm:px-6">
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground sm:text-sm">TDs</span>
            </div>
            <div className="text-xl font-bold sm:text-2xl">{numberOfTDs}</div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground sm:text-sm">Pledges</span>
            </div>
            <div className="text-xl font-bold sm:text-2xl">{pledgeCount}</div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground sm:text-sm">Total (pp)</span>
            </div>
            <div className="text-xl font-bold sm:text-2xl">{totalContribution}</div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 flex items-center justify-center gap-1">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground sm:text-sm">pp/TD</span>
            </div>
            <div className="text-xl font-bold text-primary sm:text-2xl">{overallEfficiency}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Efficiency Rating</span>
            <Badge variant="secondary" className={`${rating.color} text-white`}>
              {rating.label}
            </Badge>
          </div>
          <Progress value={(overallEfficiency / 3.0) * 100} className="h-1.5 sm:h-2" />
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            Efficiency score measures contribution per TD. Higher scores indicate better performance relative to party size.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PledgeEfficiencyCard({ pledge, partyName }: { pledge: PledgeWithEfficiency['pledge'], partyName: string }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 1.0) return 'text-green-600 bg-green-50';
    if (efficiency >= 0.5) return 'text-blue-600 bg-blue-50';
    if (efficiency >= 0.25) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <Card className="mx-auto mb-4 w-full max-w-[400px] sm:max-w-none">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-base leading-tight sm:text-lg">{pledge.title}</CardTitle>
            <CardDescription className="mt-1 text-xs sm:text-sm">
              <Badge variant="outline" className="mr-2">{pledge.category}</Badge>
              {partyName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="text-center">
            <div className="mb-1 text-xs text-muted-foreground sm:text-sm">Score</div>
            <div className={`text-lg font-bold sm:text-xl ${getScoreColor(pledge.score)}`}>
              {pledge.score}%
            </div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 text-xs text-muted-foreground sm:text-sm">Weight</div>
            <div className="text-lg font-bold sm:text-xl">{pledge.defaultWeight}%</div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 text-xs text-muted-foreground sm:text-sm">Contribution</div>
            <div className="text-lg font-bold text-blue-600 sm:text-xl">{pledge.contribution} pp</div>
          </div>
          
          <div className="text-center">
            <div className="mb-1 text-xs text-muted-foreground sm:text-sm">Efficiency</div>
            <div className={`text-base font-bold px-2 py-1 rounded sm:text-xl ${getEfficiencyColor(pledge.efficiencyScore)}`}>
              {pledge.efficiencyScore} pp/TD
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-xs text-muted-foreground sm:text-sm">{pledge.score}% complete</span>
          </div>
          <Progress value={pledge.score} className="h-1.5 sm:h-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EfficiencyDisplay({ pledges, metadata }: EfficiencyDisplayProps) {
  const sortedPledges = [...pledges].sort((a, b) => b.pledge.efficiencyScore - a.pledge.efficiencyScore);

  return (
    <div className="space-y-6">
      <EfficiencyMetrics {...metadata} />
      
      <div>
        <h3 className="mb-4 text-base font-semibold sm:text-lg">Pledge Performance (Ranked by Efficiency)</h3>
        <div className="space-y-4">
          {sortedPledges.map((item) => (
            <PledgeEfficiencyCard 
              key={item.pledge.id}
              pledge={item.pledge}
              partyName={item.partyName}
            />
          ))}
        </div>
      </div>
      
      <Card className="mx-auto w-full max-w-[400px] sm:max-w-none">
        <CardHeader className="px-4 py-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg">Understanding Efficiency Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-4 text-xs text-muted-foreground sm:text-sm sm:px-6">
          <p><strong>Score:</strong> Current fulfillment percentage of the pledge</p>
          <p><strong>Weight:</strong> Relative importance of this pledge in the party's platform</p>
          <p><strong>Contribution:</strong> Weighted score (Score × Weight ÷ 100)</p>
          <p><strong>Efficiency:</strong> Contribution per TD, measuring influence relative to party size</p>
          <p><strong>pp/TD:</strong> Percentage points per TD - higher values indicate better performance relative to party representation</p>
        </CardContent>
      </Card>
    </div>
  );
}