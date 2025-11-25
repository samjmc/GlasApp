import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import CompassChart from "@/components/CompassChart";
import IdeologySummary from "@/components/IdeologySummary";
import SimilarFigures from "@/components/SimilarFigures";
import SimilarParties from "@/components/SimilarParties";
import UniqueCombinations from "@/components/UniqueCombinations";
import PoliticalAssistant from "@/components/PoliticalAssistant";
import ShareResults from "@/components/ShareResults";
import KeyInsights from "@/components/KeyInsights";
import EnhancedPoliticalAnalysis from "@/components/EnhancedPoliticalAnalysis";
import GeographicHeatMap from "@/components/GeographicHeatMap";
import LoadingScreen from "@/components/LoadingScreen";
import PoliticalEmojiAvatar from "@/components/PoliticalEmojiAvatar";
import PersonalizedInsights from "@/components/PersonalizedInsights";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QuizResult } from "@shared/schema";

const Results = () => {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [selectedConstituency, setSelectedConstituency] = useState<string>("");
  
  // Save political evolution data for authenticated users
  const saveToEvolutionHistory = async (quizResults: QuizResult) => {
    try {
      // Save political evolution data using an API call
      const response = await fetch('/api/political-evolution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          economicScore: quizResults.economicScore,
          socialScore: quizResults.socialScore,
          ideology: quizResults.ideology,
          quizResultId: null, // Will be linked later if needed
          notes: 'Quiz completed on ' + new Date().toLocaleDateString(),
          label: 'Quiz Result',
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        console.log('Political evolution data saved successfully');
      } else {
        // User might not be logged in, which is OK
        console.log('Could not save political evolution data - user may not be logged in');
      }
    } catch (error) {
      console.error('Error saving political evolution data:', error);
    }
  };

  // Fetch constituencies for the dropdown
  const { data: constituencies } = useQuery({
    queryKey: ['/api/constituencies'],
    queryFn: async () => {
      const response = await apiRequest({
        path: '/api/constituencies',
        method: 'GET'
      });
      
      return response.success ? response.data : [];
    }
  });
  
  // Load results from localStorage on mount
  useEffect(() => {
    try {
      const savedResults = localStorage.getItem('quiz_results');
      const hasResults = localStorage.getItem('has_results') === 'true';
      
      if (savedResults && hasResults) {
        const parsedResults = JSON.parse(savedResults);
        setResults(parsedResults);
        console.log("Results loaded successfully:", parsedResults);
        
        // Attempt to save to political evolution history
        saveToEvolutionHistory(parsedResults);
      } else {
        console.log("No results found in localStorage");
        toast({
          title: "No results found",
          description: "Please complete the quiz first to see your results.",
          variant: "destructive"
        });
        navigate("/");
      }
    } catch (error) {
      console.error("Error loading results:", error);
      toast({
        title: "Error",
        description: "Failed to load your results. Please try taking the quiz again.",
        variant: "destructive"
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [navigate, toast]);
  
  // Set default constituency when constituencies are loaded
  useEffect(() => {
    if (constituencies && constituencies.length > 0 && !selectedConstituency) {
      // Try to find Dublin Central as a default or use the first constituency
      const defaultConstituency = constituencies.find((c: any) => c.name === 'Dublin Central') || constituencies[0];
      setSelectedConstituency(defaultConstituency.name);
    }
  }, [constituencies, selectedConstituency]);
  
  const handleTakeQuizAgain = () => {
    // Clear the localStorage
    localStorage.removeItem('quiz_results');
    localStorage.removeItem('has_results');
    navigate("/");
  };
  
  const handleConstituencyChange = (value: string) => {
    setSelectedConstituency(value);
  };
  
  if (loading) {
    return <LoadingScreen message="Loading your results..." />;
  }
  
  if (!results) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-2">Results Not Available</h2>
          <p>We couldn't find your quiz results. Please complete the quiz first.</p>
        </div>
        <Button 
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
        >
          Return to Home
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto">
      {/* Results Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md p-8 mb-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Your Political Compass Results</h2>
        <p className="mb-4 opacity-90">Based on your responses to the quiz questions</p>
        <div className="flex flex-wrap justify-center md:justify-start">
          <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 mr-4 mb-2">
            <span className="text-sm">Economic: </span>
            <span className="font-bold">{parseFloat(results.economicScore).toFixed(1)}</span>
            <span className="text-sm ml-1">
              {parseFloat(results.economicScore) < 0.5 ? "Left-Leaning" : "Right-Leaning"}
            </span>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 mr-4 mb-2">
            <span className="text-sm">Social: </span>
            <span className="font-bold">{parseFloat(results.socialScore).toFixed(1)}</span>
            <span className="text-sm ml-1">
              {parseFloat(results.socialScore) < 0.5 ? "Libertarian" : "Authoritarian"}
            </span>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 mb-2">
            <span className="text-sm">Ideological Leaning: </span>
            <span className="font-bold">{results.ideology}</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout for Results */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Compass and Summary */}
        <div className="lg:col-span-2 space-y-8">
          {/* Compass Visualization */}
          <CompassChart
            economic={parseFloat(results.economicScore)}
            social={parseFloat(results.socialScore)}
            similarFigures={window.quizSimilarFigures || []}
          />
          
          {/* Ideology Summary */}
          <IdeologySummary
            ideology={results.ideology}
            description={results.description}
          />
          
          {/* AI Analysis Insights - enhanced with detailed political analysis */}
          {window.quizKeyInsights || results.detailedAnalysis ? (
            <EnhancedPoliticalAnalysis 
              keyInsights={window.quizKeyInsights || []}
              detailedAnalysis={typeof results.detailedAnalysis === 'string' ? results.detailedAnalysis : undefined}
              politicalValues={
                results.politicalValues && typeof results.politicalValues === 'string' 
                  ? (() => {
                      try {
                        return JSON.parse(results.politicalValues); 
                      } catch (e) {
                        console.error('Failed to parse politicalValues:', e);
                        return undefined;
                      }
                    })()
                  : window.quizAiAnalysis?.politicalValues || undefined
              }
              irishContextInsights={
                results.irishContextInsights && typeof results.irishContextInsights === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(results.irishContextInsights);
                      } catch (e) {
                        console.error('Failed to parse irishContextInsights:', e);
                        return undefined;
                      }
                    })()
                  : window.quizAiAnalysis?.irishContextInsights || undefined
              }
            />
          ) : null}
          
          {/* Your Unique Combo */}
          <UniqueCombinations combinations={window.quizUniqueCombinations || []} />
          
          {/* Political Assistant */}
          <PoliticalAssistant ideology={results.ideology} />
        </div>
        
        {/* Right Column - Similar Figures and Parties */}
        <div className="space-y-8">
          {/* Political Emoji Avatar Generator */}
          <PoliticalEmojiAvatar 
            economicScore={results.economic} 
            socialScore={results.social} 
            ideology={results.ideology}
            quizCompleted={true} // User has completed the quiz if they're on the results page
            onSave={(avatar) => {
              localStorage.setItem('political_avatar', avatar);
              toast({
                title: "Avatar Saved!",
                description: "Your political emoji avatar has been saved to your profile.",
                variant: "default"
              });
            }}
          />
          
          {/* Similar Political Figures */}
          <SimilarFigures figures={results.similarFigures} />
          
          {/* Similar Political Parties */}
          <SimilarParties economic={results.economic} social={results.social} />
          
          {/* Share Results */}
          <ShareResults economic={results.economic} social={results.social} />
        </div>
      </div>
      
      {/* Personalized Constituency Insights Section */}
      <div className="mt-12 mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 rounded-lg shadow-lg text-white mb-6">
          <h2 className="text-2xl font-bold mb-2">Personalized Constituency Insights</h2>
          <p className="opacity-90">
            Discover how your political views align with different constituencies across Ireland. Select a constituency to get personalized insights.
          </p>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Select a Constituency</CardTitle>
            <Select value={selectedConstituency} onValueChange={handleConstituencyChange}>
              <SelectTrigger id="constituency-select" className="w-full">
                <SelectValue placeholder="Select a constituency" />
              </SelectTrigger>
              <SelectContent>
                {constituencies?.map((constituency: any) => (
                  <SelectItem key={constituency.name} value={constituency.name}>
                    {constituency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
        </Card>
        
        {selectedConstituency && results && (
          <PersonalizedInsights 
            constituencyName={selectedConstituency}
            userEconomicScore={results.economic}
            userSocialScore={results.social}
          />
        )}
      </div>
      
      {/* Take Quiz Again Button */}
      <div className="text-center mt-8 mb-16">
        <Button 
          variant="outline" 
          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 font-medium py-2 px-6"
          onClick={handleTakeQuizAgain}
        >
          <i className="fas fa-redo mr-2"></i> Take the Quiz Again
        </Button>
      </div>
    </div>
  );
};

export default Results;