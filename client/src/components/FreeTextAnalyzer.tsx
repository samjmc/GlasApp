import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LoadingScreen from "@/components/LoadingScreen";

interface FreeTextAnalyzerProps {
  questionContext: string;
  initialValue?: string;
  onAnalysisComplete: (result: {
    economicScore: number;
    socialScore: number;
    confidence: number;
    reasoning: string;
  }) => void;
}

const FreeTextAnalyzer = ({
  questionContext,
  initialValue = "",
  onAnalysisComplete
}: FreeTextAnalyzerProps) => {
  const [text, setText] = useState(initialValue);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<{
    economicScore: number;
    socialScore: number;
    confidence: number;
    reasoning: string;
  } | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!text.trim()) {
      toast({
        title: "Empty Response",
        description: "Please provide a response to analyze.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const result = await apiRequest({
        method: "POST",
        path: "/api/ai/analyze-text",
        body: {
          text,
          questionContext
        }
      });

      if (result && result.success && result.analysis) {
        setAnalysis(result.analysis);
        onAnalysisComplete(result.analysis);
        
        toast({
          title: "Analysis Complete",
          description: "Your response has been analyzed successfully."
        });
      } else {
        throw new Error("Invalid response from analysis service");
      }
    } catch (error) {
      console.error("Error analyzing text:", error);
      toast({
        title: "Analysis Failed",
        description: "We couldn't analyze your response. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Share Your Thoughts</CardTitle>
        <CardDescription>
          Provide a detailed response to get AI-powered political analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          placeholder="Type your thoughts or opinion here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-24 resize-y"
          disabled={isAnalyzing}
        />

        {analysis && (
          <div className="mt-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
            <h4 className="font-medium text-sm mb-2">Analysis Results:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Economic Position:</span>
                <span className="font-medium">
                  {analysis.economicScore < 0 
                    ? `Left (${analysis.economicScore.toFixed(1)})` 
                    : `Right (${analysis.economicScore.toFixed(1)})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Social Position:</span>
                <span className="font-medium">
                  {analysis.socialScore < 0 
                    ? `Libertarian (${analysis.socialScore.toFixed(1)})` 
                    : `Authoritarian (${analysis.socialScore.toFixed(1)})`}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Confidence:</span>
                <span className="font-medium">{(analysis.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-gray-600 dark:text-gray-300">{analysis.reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {isAnalyzing ? (
          <div className="w-full flex justify-center">
            <div className="w-32">
              <LoadingScreen message="Analyzing..." />
            </div>
          </div>
        ) : (
          <Button 
            onClick={handleAnalyze}
            disabled={!text.trim() || isAnalyzing}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
          >
            Analyze Response
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default FreeTextAnalyzer;