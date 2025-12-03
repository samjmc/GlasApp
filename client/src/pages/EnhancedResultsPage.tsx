import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useMultidimensionalQuiz } from '@/contexts/MultidimensionalQuizContext';
import MultidimensionalIdeologyProfile from '@/components/MultidimensionalIdeologyProfile';
import EnhancedProfileExplanation from '@/components/EnhancedProfileExplanation';
import ContextAnalysis from '@/components/ContextAnalysis';
import PoliticalOpinionChangeTracker from '@/components/PoliticalOpinionChangeTracker';
import LoadingScreen from '@/components/LoadingScreen';
import { defaultDimensions, IdeologicalDimensions, MultidimensionalQuizResult } from '@shared/quizTypes';

/**
 * SIMPLIFIED EnhancedResultsPage
 * 
 * Single Source of Truth: The `results` object from MultidimensionalQuizContext
 * - Contains: dimensions, ideology, description, responses, timestamp
 * - Stored in localStorage as 'multidimensionalQuizResults'
 * - No more redundant keys (tempDimensions, resultsDimensions, etc.)
 * 
 * User preferences (weights) are stored separately in 'dimensionWeights'
 */

const EnhancedResultsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { 
    results, 
    isResultsCalculated, 
    saveResults, 
    resetQuiz, 
    hasBeenSaved,
    calculateResults 
  } = useMultidimensionalQuiz();
  
  const [isLoading, setIsLoading] = useState(true);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>('');
  const shareInputRef = useRef<HTMLInputElement>(null);
  
  // User preference weights (stored separately from quiz results)
  const [weights, setWeights] = useState<Record<string, number>>({
    economic: 1, social: 1, cultural: 1, globalism: 1,
    environmental: 1, authority: 1, welfare: 1, technocratic: 1
  });
  
  const { toast } = useToast();

  // Load weights from localStorage (user preference, not quiz data)
  useEffect(() => {
    try {
      const savedWeights = localStorage.getItem('dimensionWeights');
      if (savedWeights) {
        setWeights(JSON.parse(savedWeights));
      }
    } catch (error) {
      console.error("Error loading weights:", error);
    }
    
    // Brief loading state for smooth transition
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-save results when they're calculated
  useEffect(() => {
    const autoSave = async () => {
      if (!isLoading && isResultsCalculated && results && !hasBeenSaved && !isSaving) {
        setIsSaving(true);
        try {
          const code = await saveResults();
          if (code) {
            setShareCode(code);
            setShareUrl(`${window.location.origin}/enhanced-results?shareCode=${code}`);
            toast({
              title: "Results Saved",
              description: "Your quiz results have been automatically saved.",
            });
          }
        } catch (error) {
          console.error("Error auto-saving:", error);
        } finally {
          setIsSaving(false);
        }
      }
    };
    autoSave();
  }, [isLoading, isResultsCalculated, results, hasBeenSaved, isSaving, saveResults, toast]);

  // Redirect to quiz if no results
  useEffect(() => {
    if (!isLoading && !results) {
      setLocation('/enhanced-quiz');
    }
  }, [isLoading, results, setLocation]);

  // Update share URL when shareCode changes
  useEffect(() => {
    if (shareCode) {
      setShareUrl(`${window.location.origin}/enhanced-results?shareCode=${shareCode}`);
    }
  }, [shareCode]);

  // Handle manual save
  const handleSaveResults = async () => {
    setIsSaving(true);
    try {
      const code = await saveResults();
      if (code) {
        setShareCode(code);
        const url = `${window.location.origin}/enhanced-results?shareCode=${code}`;
        setShareUrl(url);
        navigator.clipboard.writeText(url).catch(() => {});
        toast({ title: "Results Saved", description: "Share link is ready to copy." });
      } else {
        toast({ title: "Save Failed", description: "Unable to save results.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "An error occurred.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle copy share URL
  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => toast({ title: "Copied!", description: "Link copied to clipboard." }))
        .catch(() => {});
    }
  };

  // Handle download as image
  const handleDownloadImage = async () => {
    try {
      const profileElement = document.querySelector('[data-profile-card="true"]');
      if (!profileElement) {
        toast({ title: "Error", description: "Could not find profile content.", variant: "destructive" });
        return;
      }
      
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      toast({ title: "Capturing...", description: "Creating your image." });
      
      const canvas = await html2canvas(profileElement as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const link = document.createElement('a');
      link.download = `glas-politics-profile-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({ title: "Downloaded!", description: "Profile saved as image." });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({ title: "Download Failed", description: "Unable to create image.", variant: "destructive" });
    }
  };

  // Handle restart quiz
  const handleRestartQuiz = () => {
    resetQuiz();
    setLocation('/enhanced-quiz');
  };

  // Handle recalculate from stored responses
  const handleRecalculateResults = () => {
    if (!results?.responses?.length) {
      toast({
        title: "No Responses Found",
        description: "Please retake the quiz.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Pass responses directly to calculateResults to avoid React state race condition
      // No need to setResponses first - calculateResults will store them in the new result
      const newDimensions = calculateResults(results.responses);
      
      if (newDimensions) {
        toast({ title: "Results Recalculated", description: "Your results have been updated." });
        setTimeout(() => window.location.reload(), 500);
      } else {
        toast({ title: "Recalculation Failed", description: "Please retake the quiz.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error recalculating:", error);
      toast({ title: "Error", description: "Please retake the quiz.", variant: "destructive" });
    }
  };

  // Loading state
  if (isLoading) {
    return <LoadingScreen message="Loading your political profile..." />;
  }

  // No results state
  if (!results) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>No Results Found</CardTitle>
            <CardDescription>You haven't completed the quiz yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/enhanced-quiz')} className="w-full">
              Take the Quiz
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract dimensions from results (SINGLE SOURCE OF TRUTH)
  const dimensions: IdeologicalDimensions = {
    economic: results.economic,
    social: results.social,
    cultural: results.cultural,
    globalism: results.globalism,
    environmental: results.environmental,
    authority: results.authority,
    welfare: results.welfare,
    technocratic: results.technocratic
  };

  const constituencyName = results.userLocation?.constituency || undefined;

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      <div className="space-y-6">
        {/* Main Profile Card */}
        <div data-profile-card="true">
          <MultidimensionalIdeologyProfile 
            dimensions={dimensions}
            ideology={results.ideology}
            description={results.description}
            onWeightsChange={setWeights}
            initialWeights={weights}
          />
        </div>
        
        {/* Enhanced Analysis */}
        <EnhancedProfileExplanation 
          dimensions={dimensions}
          weights={weights}
        />
        
        {/* Context Analysis */}
        <div className="w-full">
          <ContextAnalysis 
            dimensions={dimensions}
            userLocation={constituencyName}
          />
        </div>
        
        {/* Share Profile Card */}
        <Card className="border-blue-200 dark:border-blue-800 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <span>💾</span> Share Your Profile
            </CardTitle>
            <CardDescription className="text-xs">
              Save, share, and export your political profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <Button 
              onClick={handleSaveResults} 
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-sm"
              disabled={isSaving || hasBeenSaved}
              size="sm"
            >
              {isSaving ? "Saving..." : hasBeenSaved ? "✓ Profile Saved" : "💾 Save Profile"}
            </Button>
            
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="text-xs mb-1 font-medium">Share link:</div>
              <div className="flex">
                <Input
                  ref={shareInputRef}
                  value={shareUrl || "Generate a share link first..."}
                  className="flex-grow text-xs rounded-l-md"
                  readOnly
                />
                <Button 
                  className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 rounded-r-md"
                  onClick={handleCopy}
                  size="sm"
                  disabled={!shareUrl}
                >
                  📋
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  className="flex-1 text-sm"
                  size="sm"
                  onClick={handleDownloadImage}
                >
                  📥 Download
                </Button>
                
                <Button 
                  onClick={handleRecalculateResults} 
                  variant="outline" 
                  className="flex-1 text-sm"
                  size="sm"
                >
                  🔄 Recalculate
                </Button>
              </div>
              
              <Button 
                onClick={handleRestartQuiz} 
                variant="outline" 
                className="w-full border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm"
                size="sm"
              >
                🔄 Start Over (Retake Quiz)
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Opinion Tracker */}
        <PoliticalOpinionChangeTracker currentDimensions={dimensions} />
        
        {/* Dimensions Explained Card */}
        <Card className="border-purple-200 dark:border-purple-800 shadow-md">
          <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <span>📊</span> Dimensions Explained
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-gray-700 dark:text-gray-300 pt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ul className="space-y-2">
                <li><strong>💰 Economic:</strong> Left (-10) to Right (+10)</li>
                <li><strong>👥 Social:</strong> Progressive (-10) to Conservative (+10)</li>
                <li><strong>🏛️ Cultural:</strong> Multicultural (-10) to Traditional (+10)</li>
                <li><strong>🌐 Globalism:</strong> Nationalist (-10) to Internationalist (+10)</li>
              </ul>
              <ul className="space-y-2">
                <li><strong>🌿 Environmental:</strong> Industrial (-10) to Ecological (+10)</li>
                <li><strong>⚖️ Authority:</strong> Libertarian (-10) to Authoritarian (+10)</li>
                <li><strong>🤝 Welfare:</strong> Individual (-10) to Communitarian (+10)</li>
                <li><strong>🧠 Governance:</strong> Populist (-10) to Technocratic (+10)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedResultsPage;
