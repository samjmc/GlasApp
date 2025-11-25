import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useMultidimensionalQuiz } from '@/contexts/MultidimensionalQuizContext';
import MultidimensionalIdeologyProfile from '@/components/MultidimensionalIdeologyProfile';
import EnhancedProfileExplanation from '@/components/EnhancedProfileExplanation';
import ContextAnalysis from '@/components/ContextAnalysis';
import PoliticalOpinionChangeTracker from '@/components/PoliticalOpinionChangeTracker';
import PartyMatchResultsNew from '@/components/PartyMatchResultsNew';
import DimensionWeights from '@/components/DimensionWeights';
import LoadingScreen from '@/components/LoadingScreen';
import { defaultDimensions, IdeologicalDimensions } from '@shared/quizTypes';

const EnhancedResultsPage: React.FC = () => {
  const [, setLocation] = useLocation();
  const { results, isResultsCalculated, saveResults, resetQuiz, hasBeenSaved, setResponses, calculateResults } = useMultidimensionalQuiz();
  const [isLoading, setIsLoading] = useState(true);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [customDimensions, setCustomDimensions] = useState<IdeologicalDimensions | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const shareInputRef = useRef<HTMLInputElement>(null);
  
  // Improved weights state management with default values
  const [sharedWeights, setSharedWeights] = useState<Record<string, number>>({
    economic: 1, social: 1, cultural: 1,
    globalism: 1, environmental: 1, authority: 1,
    welfare: 1, technocratic: 1
  });
  
  const { toast } = useToast();

  // Load data from localStorage and context
  useEffect(() => {
    try {
      // First, try to load from context (if results are already calculated)
      if (results && isResultsCalculated) {
        console.log("Found results in context:", results);
        setCustomDimensions({
          economic: results.economic,
          social: results.social,
          cultural: results.cultural,
          globalism: results.globalism,
          environmental: results.environmental,
          authority: results.authority,
          welfare: results.welfare,
          technocratic: results.technocratic
        });
      } else {
        // Try to get dimensions from localStorage
        const storedDimensions = localStorage.getItem('resultsDimensions');
        if (storedDimensions) {
          const dimensions = JSON.parse(storedDimensions);
          console.log("Found dimensions in localStorage:", dimensions);
          setCustomDimensions(dimensions);
        } else {
          // Try to load from multidimensionalQuizResults
          const storedResults = localStorage.getItem('multidimensionalQuizResults');
          if (storedResults) {
            const parsedResults = JSON.parse(storedResults);
            setCustomDimensions({
              economic: parsedResults.economic,
              social: parsedResults.social,
              cultural: parsedResults.cultural,
              globalism: parsedResults.globalism,
              environmental: parsedResults.environmental,
              authority: parsedResults.authority,
              welfare: parsedResults.welfare,
              technocratic: parsedResults.technocratic
            });
          }
        }
      }
      
      // Try to get weights from localStorage
      const storedWeights = localStorage.getItem('resultsWeights');
      if (storedWeights) {
        const weights = JSON.parse(storedWeights);
        console.log("Found custom weights in localStorage:", weights);
        setSharedWeights(weights);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    }
    
    // Simulate loading for a smoother transition
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [results, isResultsCalculated]);

  // Auto-save results when they're calculated and not yet saved
  useEffect(() => {
    const autoSave = async () => {
      if (!isLoading && isResultsCalculated && results && !hasBeenSaved && !isSaving) {
        setIsSaving(true);
        try {
          const code = await saveResults();
          if (code) {
            setShareCode(code);
            const newShareUrl = `${window.location.origin}/enhanced-results?shareCode=${code}`;
            setShareUrl(newShareUrl);
            toast({
              title: "Results Saved",
              description: "Your quiz results have been automatically saved to your profile.",
            });
          }
        } catch (error) {
          console.error("Error auto-saving results:", error);
        } finally {
          setIsSaving(false);
        }
      }
    };
    autoSave();
  }, [isLoading, isResultsCalculated, results, hasBeenSaved, isSaving, saveResults, toast]);

  // Redirect to quiz if no results found
  useEffect(() => {
    if (!isLoading && !isResultsCalculated && !results && !customDimensions) {
      // Check if there are stored dimensions from dimension-weights page
      const storedDimensions = localStorage.getItem('resultsDimensions');
      if (!storedDimensions) {
        setLocation('/enhanced-quiz');
      }
    }
  }, [isLoading, isResultsCalculated, results, customDimensions, setLocation]);

  // Handle saving results to database
  const handleSaveResults = async () => {
    setIsSaving(true);
    
    try {
      const code = await saveResults();
      
      if (code) {
        setShareCode(code);
        
        // Automatically create and set the share URL
        const newShareUrl = `${window.location.origin}/enhanced-results?shareCode=${code}`;
        setShareUrl(newShareUrl);
        
        // Copy to clipboard
        navigator.clipboard.writeText(newShareUrl)
          .then(() => {
            toast({
              title: "Results Saved",
              description: "Your profile has been saved and the share link is ready to copy.",
            });
          })
          .catch(() => {
            toast({
              title: "Results Saved",
              description: "Your profile has been saved and can be shared with others.",
            });
          });
      } else {
        toast({
          title: "Save Failed",
          description: "Unable to save your results. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving your results.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle sharing results - create and set share URL
  const handleShareResults = () => {
    if (shareCode) {
      // Create shareable URL with the correct path format
      const shareableUrl = `${window.location.origin}/enhanced-results?shareCode=${shareCode}`;
      setShareUrl(shareableUrl);
      
      // Copy to clipboard
      navigator.clipboard.writeText(shareableUrl)
        .then(() => {
          toast({
            title: "Link Copied",
            description: "Shareable link copied to clipboard.",
          });
        })
        .catch(() => {
          toast({
            title: "Copy Failed",
            description: "Unable to copy link. Please try again.",
            variant: "destructive",
          });
        });
    } else {
      toast({
        title: "Save Required",
        description: "Please save your results first before sharing.",
      });
    }
  };
  
  // Set share URL when shareCode is available
  useEffect(() => {
    if (shareCode) {
      setShareUrl(`${window.location.origin}/enhanced-results?shareCode=${shareCode}`);
    }
  }, [shareCode]);
  
  // Handle copying share URL
  const handleCopy = () => {
    if (shareInputRef.current && shareUrl) {
      shareInputRef.current.select();
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          toast({
            title: "Copied!",
            description: "Link copied to clipboard.",
          });
        })
        .catch(err => {
          console.error('Failed to copy:', err);
        });
    }
  };
  
  // Handle social media sharing
  const handleTwitterShare = () => {
    if (!shareCode) {
      toast({
        title: "Save Required",
        description: "Please save your results first before sharing.",
      });
      return;
    }
    
    const text = `Check out my multidimensional political profile on Glas Politics! Economic: ${dimensions.economic.toFixed(1)}, Social: ${dimensions.social.toFixed(1)}, and more.`;
    const url = `${window.location.origin}/enhanced-results/${shareCode}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank');
  };
  
  const handleFacebookShare = () => {
    if (!shareCode) {
      toast({
        title: "Save Required",
        description: "Please save your results first before sharing.",
      });
      return;
    }
    
    const url = `${window.location.origin}/enhanced-results/${shareCode}`;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(facebookUrl, '_blank');
  };
  
  // Handle downloading results as an image
  const handleDownloadImage = async () => {
    try {
      const profileElement = document.querySelector('[data-profile-card="true"]');
      
      if (!profileElement) {
        toast({
          title: "Error",
          description: "Could not find the profile content to capture.",
          variant: "destructive",
        });
        return;
      }
      
      // Dynamically import html2canvas to use it
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      toast({
        title: "Capturing...",
        description: "Please wait while we create your image.",
      });
      
      // Create a temporary style for better rendering
      const originalStyles = profileElement.getAttribute('style') || '';
      profileElement.setAttribute('style', `${originalStyles}; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);`);
      
      // Render the canvas with better quality
      const canvas = await html2canvas(profileElement as HTMLElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
      });
      
      // Restore original styles
      profileElement.setAttribute('style', originalStyles);
      
      // Create download
      const link = document.createElement('a');
      link.download = `glas-politics-profile-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast({
        title: "Downloaded!",
        description: "Your profile has been saved as an image.",
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Download Failed",
        description: "Unable to create image. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get the dimensions to use for party matching (custom from URL or from quiz results)
  const getDimensionsForMatching = () => {
    if (customDimensions) {
      return customDimensions;
    }
    
    if (results) {
      return {
        economic: results.economic,
        social: results.social,
        cultural: results.cultural,
        globalism: results.globalism,
        environmental: results.environmental,
        authority: results.authority,
        welfare: results.welfare,
        technocratic: results.technocratic
      };
    }
    
    return defaultDimensions;
  };
  
  // Handle restart quiz
  const handleRestartQuiz = () => {
    // Reset the quiz state before navigating back to the quiz
    resetQuiz();
    setLocation('/enhanced-quiz');
  };

  // Handle recalculating results from stored responses
  const handleRecalculateResults = async () => {
    if (!results || !results.responses || results.responses.length === 0) {
      toast({
        title: "No Responses Found",
        description: "Cannot recalculate - no stored responses found. Please retake the quiz.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Set responses and recalculate
      setResponses(results.responses);
      
      // Small delay to ensure state updates, then recalculate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newDimensions = calculateResults();
      if (newDimensions) {
        toast({
          title: "Results Recalculated",
          description: "Your results have been recalculated with the updated scoring system.",
        });
        // Reload the page to show new results
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast({
          title: "Recalculation Failed",
          description: "Unable to recalculate results. Please retake the quiz.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error recalculating results:", error);
      toast({
        title: "Error",
        description: "An error occurred while recalculating. Please retake the quiz.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading your political profile..." />;
  }

  if (!results) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>No Results Found</CardTitle>
            <CardDescription>
              You haven't completed the enhanced political compass quiz yet.
            </CardDescription>
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

  // Extract necessary dimension data
  const dimensions = {
    economic: results.economic,
    social: results.social,
    cultural: results.cultural || defaultDimensions.cultural,
    globalism: results.globalism || defaultDimensions.globalism,
    environmental: results.environmental || defaultDimensions.environmental,
    authority: results.authority || defaultDimensions.authority,
    welfare: results.welfare || defaultDimensions.welfare,
    technocratic: results.technocratic || defaultDimensions.technocratic
  };
  
  // Extract user location if available - just need constituency as string
  const constituencyName = results.userLocation?.constituency || undefined;

  // Store dimension explanations card content for later
  const dimensionExplanationsCard = (
    <Card className="border-purple-200 dark:border-purple-800 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-t-lg">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-purple-600 dark:text-purple-400">📊</span> Dimensions Explained
        </CardTitle>
        <CardDescription className="text-xs">
          Understanding your political dimensions
        </CardDescription>
      </CardHeader>
      <CardContent className="text-xs text-gray-700 dark:text-gray-300 pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md shadow-sm">
            <ul className="space-y-2">
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">💰</span>
                <span className="dimension-tooltip">
                  <strong>Economic:</strong> Left - Right
                  <span className="tooltip-text">
                    <p>Measures how much government should intervene in the economy.</p>
                    <p className="mt-1"><strong>-10</strong>: Left - Strong government control, public ownership, wealth redistribution.</p>
                    <p><strong>+10</strong>: Right - Free market with minimal regulation and taxation.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">👥</span>
                <span className="dimension-tooltip">
                  <strong>Social:</strong> Progressive - Conservative
                  <span className="tooltip-text">
                    <p>Measures attitudes toward social norms, values and social change.</p>
                    <p className="mt-1"><strong>-10</strong>: Progressive - Supporting diversity and social reform.</p>
                    <p><strong>+10</strong>: Conservative - Valuing established norms and social stability.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">🏛️</span>
                <span className="dimension-tooltip">
                  <strong>Cultural:</strong> Multicultural - Traditional
                  <span className="tooltip-text">
                    <p>Measures attitudes toward cultural identity, traditions, and heritage.</p>
                    <p className="mt-1"><strong>-10</strong>: Multicultural - Embraces cultural diversity and change.</p>
                    <p><strong>+10</strong>: Traditional - Preserves cultural heritage and national identity.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">🌐</span>
                <span className="dimension-tooltip">
                  <strong>Globalism:</strong> Internationalist - Nationalist
                  <span className="tooltip-text">
                    <p>Measures attitudes toward international cooperation, sovereignty, and borders.</p>
                    <p className="mt-1"><strong>-10</strong>: Internationalist - Supporting global governance.</p>
                    <p><strong>+10</strong>: Ultranationalist - Prioritizing national sovereignty.</p>
                  </span>
                </span>
              </li>
            </ul>
          </div>
          <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md shadow-sm">
            <ul className="space-y-2">
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">🌿</span>
                <span className="dimension-tooltip">
                  <strong>Environmental:</strong> Industrial - Ecological
                  <span className="tooltip-text">
                    <p>Measures priority given to environmental protection versus economic development.</p>
                    <p className="mt-1"><strong>-10</strong>: Industrial - Prioritizes industrial growth and economic development.</p>
                    <p><strong>+10</strong>: Strongly Ecological - Prioritizes environmental protection and sustainability.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">⚖️</span>
                <span className="dimension-tooltip">
                  <strong>Authority:</strong> Libertarian - Authoritarian
                  <span className="tooltip-text">
                    <p>Measures attitudes toward authority, personal freedom, and social control.</p>
                    <p className="mt-1"><strong>-10</strong>: Libertarian - Favoring personal freedoms and civil liberties.</p>
                    <p><strong>+10</strong>: Authoritarian - Supporting law enforcement and centralized authority.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">🤝</span>
                <span className="dimension-tooltip">
                  <strong>Welfare:</strong> Individual - Communitarian
                  <span className="tooltip-text">
                    <p>Measures attitudes toward social support systems and community responsibility.</p>
                    <p className="mt-1"><strong>-10</strong>: Individual - Emphasizes individual responsibility and limited public welfare.</p>
                    <p><strong>+10</strong>: Communitarian - Supports universal welfare and collective responsibility.</p>
                  </span>
                </span>
              </li>
              <li className="flex items-center gap-1">
                <span className="text-purple-600 dark:text-purple-400">🧠</span>
                <span className="dimension-tooltip">
                  <strong>Governance:</strong> Populist - Technocratic
                  <span className="tooltip-text">
                    <p>Measures trust in expertise versus popular opinion in decision-making.</p>
                    <p className="mt-1"><strong>-10</strong>: Populist - Trusting common sense and direct democracy.</p>
                    <p><strong>+10</strong>: Technocratic - Valuing expert knowledge and credentials.</p>
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </div>
        
        <p className="mt-4 text-center text-xs bg-purple-100 dark:bg-purple-900 p-2 rounded-md shadow-sm">
          Each dimension is scored from <strong>-10</strong> (left) to <strong>+10</strong> (right)
        </p>
      </CardContent>
    </Card>
  );

  // Store share profile card content
  const shareProfileCard = (
    <Card className="border-blue-200 dark:border-blue-800 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-t-lg">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">💾</span> Share Your Profile
        </CardTitle>
        <CardDescription className="text-xs">
          Save, share, and export your political profile
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Button 
          onClick={handleSaveResults} 
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 transition-all text-sm"
          disabled={isSaving || hasBeenSaved}
          size="sm"
        >
          {isSaving ? "Saving..." : 
           hasBeenSaved ? "✓ Profile Saved" : 
           shareCode ? "🔄 Update Profile" : "💾 Save Profile"}
        </Button>
        
        <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-md mt-4">
          <div className="text-xs mb-1 font-medium">Share link:</div>
          <div className="flex">
            <Input
              ref={shareInputRef}
              value={shareUrl || `${window.location.origin}/enhanced-results${shareCode ? `?shareCode=${shareCode}` : ''}`}
              className="flex-grow text-xs rounded-l-md border border-gray-300 dark:border-gray-700 dark:bg-gray-900 py-1"
              readOnly
              placeholder="Generate a share link first..."
            />
            <Button 
              className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 rounded-r-md"
              onClick={handleCopy}
              size="sm"
              disabled={!shareUrl && !shareCode}
            >
              📋
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              className="flex-1 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900 text-sm"
              size="sm"
              onClick={handleDownloadImage}
            >
              📥 Download
            </Button>
            
            <Button 
              onClick={handleRecalculateResults} 
              variant="outline" 
              className="flex-1 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900 text-sm"
              size="sm"
            >
              🔄 Recalculate Results
            </Button>
          </div>
          
          <Button 
            onClick={handleRestartQuiz} 
            variant="outline" 
            className="w-full border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900 text-sm"
            size="sm"
          >
            🔄 Start Over (Retake Quiz)
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6">
      {/* Main content - full width */}
      <div className="space-y-6">
        <div data-profile-card="true">
          <MultidimensionalIdeologyProfile 
            dimensions={dimensions}
            ideology={results.ideology}
            description={results.description}
            onWeightsChange={setSharedWeights}
            initialWeights={sharedWeights}
          />
        </div>
        
        <EnhancedProfileExplanation 
          dimensions={dimensions}
          weights={sharedWeights}
        />
        
        <div className="w-full">
          <ContextAnalysis 
            dimensions={dimensions}
            userLocation={constituencyName}
          />
        </div>
        
        {shareProfileCard}
        
        <PoliticalOpinionChangeTracker currentDimensions={dimensions} />
        
        {dimensionExplanationsCard}
      </div>
    </div>
  );
};

export default EnhancedResultsPage;