import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, TrendingUp } from 'lucide-react';
import { PoliticalEvolution } from '@shared/schema';

interface PoliticalEvolutionAnalysisProps {
  evolutionData: PoliticalEvolution[] | undefined;
}

interface AnalysisResult {
  summary: string;
  keyChanges: string[];
  trends: string[];
  interpretation: string;
}

const PoliticalEvolutionAnalysis: React.FC<PoliticalEvolutionAnalysisProps> = ({ evolutionData }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = async () => {
    if (!evolutionData || evolutionData.length === 0) {
      setError('No political evolution data available for analysis');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/political-evolution/analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ evolutionData }),
      });

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const result = await response.json();
      setAnalysis(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-generate analysis when component mounts if data is available
  useEffect(() => {
    if (evolutionData && evolutionData.length > 0 && !analysis && !isLoading) {
      generateAnalysis();
    }
  }, [evolutionData]);

  if (!evolutionData || evolutionData.length === 0) {
    return null;
  }

  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          AI Political Evolution Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">
              Analyzing your political journey...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-destructive mb-3">{error}</p>
            <Button 
              onClick={generateAnalysis} 
              variant="outline" 
              size="sm"
            >
              <Brain className="w-4 h-4 mr-2" />
              Retry Analysis
            </Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Summary */}
            <div>
              <h4 className="font-semibold text-sm mb-2 text-foreground">Overall Summary</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
            </div>

            {/* Key Changes */}
            {analysis.keyChanges && analysis.keyChanges.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 text-foreground flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Key Changes Over Time
                </h4>
                <ul className="text-sm space-y-1">
                  {analysis.keyChanges.map((change, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Trends */}
            {analysis.trends && analysis.trends.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2 text-foreground">Political Trends</h4>
                <ul className="text-sm space-y-1">
                  {analysis.trends.map((trend, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary mt-1">→</span>
                      <span className="text-muted-foreground">{trend}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Interpretation */}
            {analysis.interpretation && (
              <div className="bg-muted p-3 rounded-lg">
                <h4 className="font-semibold text-sm mb-2 text-foreground">What This Means</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.interpretation}</p>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <Button 
                onClick={generateAnalysis} 
                variant="ghost" 
                size="sm"
                className="text-xs"
              >
                <Brain className="w-3 h-3 mr-1" />
                Refresh Analysis
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">
              Get AI insights into your political evolution
            </p>
            <Button 
              onClick={generateAnalysis} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Brain className="w-4 h-4 mr-2" />
              Generate Analysis
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PoliticalEvolutionAnalysis;