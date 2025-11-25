import { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PoliticalValue {
  value: string;
  strength: number;
}

interface EnhancedPoliticalAnalysisProps {
  keyInsights: string[];
  detailedAnalysis?: string;
  politicalValues?: PoliticalValue[];
  irishContextInsights?: string[];
}

/**
 * A component that displays enhanced political analysis including detailed insights
 * about the user's political stance based on their quiz answers
 */
const EnhancedPoliticalAnalysis: FC<EnhancedPoliticalAnalysisProps> = ({
  keyInsights,
  detailedAnalysis,
  politicalValues,
  irishContextInsights,
}) => {
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-semibold">Enhanced Political Analysis</CardTitle>
        <CardDescription>
          AI-powered insights about your political views
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {/* Key Insights Section */}
          <div>
            <h3 className="text-lg font-medium mb-2">Key Insights</h3>
            <ul className="list-disc pl-5 space-y-1">
              {keyInsights.map((insight, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  {insight}
                </li>
              ))}
            </ul>
          </div>

          {/* Detailed Analysis Section */}
          {detailedAnalysis && (
            <div>
              <h3 className="text-lg font-medium mb-2">Detailed Analysis</h3>
              <ScrollArea className="h-32 rounded-md border p-3">
                <p className="text-sm text-muted-foreground">{detailedAnalysis}</p>
              </ScrollArea>
            </div>
          )}

          {/* Political Values Section */}
          {politicalValues && politicalValues.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Core Political Values</h3>
              <div className="flex flex-wrap gap-2">
                {politicalValues.map((value, index) => (
                  <div key={index} className="mb-2">
                    <Badge 
                      variant={getVariantForStrength(value.strength)}
                      className="text-xs py-1"
                    >
                      {value.value} ({value.strength}/10)
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Irish Context Insights */}
          {irishContextInsights && irishContextInsights.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Irish Political Context</h3>
              <ul className="list-disc pl-5 space-y-1">
                {irishContextInsights.map((insight, index) => (
                  <li key={index} className="text-sm text-muted-foreground">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Helper function to determine badge variant based on value strength
function getVariantForStrength(strength: number): "default" | "secondary" | "outline" | "destructive" {
  if (strength >= 8) return "destructive";  // Strong values
  if (strength >= 5) return "default";      // Medium values
  if (strength >= 3) return "secondary";    // Moderate values
  return "outline";                          // Weak values
}

export default EnhancedPoliticalAnalysis;