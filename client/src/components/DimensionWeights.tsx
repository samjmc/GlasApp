import React, { useState, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { HelpCircle, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { dimensionDisplayConfig } from '@shared/quizTypes';

// Default weights for all dimensions
const DEFAULT_WEIGHTS: Record<string, number> = {
  economic: 1,
  social: 1,
  cultural: 1,
  globalism: 1,
  environmental: 1,
  authority: 1,
  welfare: 1,
  technocratic: 1
};

interface DimensionWeightsProps {
  onWeightsChange?: (weights: Record<string, number>) => void;
  initialWeights?: Record<string, number>;
}

const DimensionWeights: React.FC<DimensionWeightsProps> = ({
  onWeightsChange,
  initialWeights
}) => {
  const [weights, setWeights] = useState<Record<string, number>>(initialWeights || DEFAULT_WEIGHTS);
  const { toast } = useToast();
  
  // Load weights from localStorage on component mount
  useEffect(() => {
    try {
      const savedWeights = localStorage.getItem('dimensionWeights');
      if (savedWeights) {
        const parsedWeights = JSON.parse(savedWeights);
        setWeights(parsedWeights);
        if (onWeightsChange) {
          onWeightsChange(parsedWeights);
        }
        console.log("Loaded saved weights from localStorage:", parsedWeights);
      }
    } catch (error) {
      console.error("Error loading saved weights:", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - onWeightsChange is stable

  // Handle weight changes from sliders - now updates in real-time
  // This allows party matches to update instantly as users move sliders
  const handleWeightChange = (dimension: string, value: number[]) => {
    const newWeights = { ...weights, [dimension]: value[0] };
    setWeights(newWeights);
    
    // Notify parent to update party matches in real-time
    // This won't trigger OpenAI analysis regeneration
    if (onWeightsChange) {
      onWeightsChange(newWeights);
    }
  };
  
  // Reset weights to default
  const resetWeights = () => {
    // Only update local state
    setWeights(DEFAULT_WEIGHTS);
    
    // Update localStorage too
    localStorage.setItem('dimensionWeights', JSON.stringify(DEFAULT_WEIGHTS));
    
    // Notify parent (this will update in the UI but not trigger any regeneration)
    if (onWeightsChange) {
      console.log("Reset weights to default:", DEFAULT_WEIGHTS);
      onWeightsChange(DEFAULT_WEIGHTS);
    }
    
    toast({
      title: "Weights Reset",
      description: "All dimension weights have been reset to default values. Click Save and Regenerate to apply.",
    });
  };
  
  // Save weights to localStorage only (no refresh)
  const saveWeights = () => {
    // Save to localStorage
    localStorage.setItem('dimensionWeights', JSON.stringify(weights));
    
    // Quietly update the UI state in the parent, but don't trigger refreshes
    if (onWeightsChange) {
      console.log("Updating UI with weight changes:", weights);
      onWeightsChange(weights);
    }
    
    // Show feedback to user
    toast({
      title: "Weights Saved",
      description: "Your custom dimension weights have been saved. Click 'Save and Regenerate' to apply them.",
    });
  };
  
  // Save and trigger a full regeneration
  const saveAndRegenerate = () => {
    // First, save to localStorage
    localStorage.setItem('dimensionWeights', JSON.stringify(weights));
    
    // Then update the parent
    if (onWeightsChange) {
      console.log("Applying weight changes and regenerating:", weights);
      onWeightsChange(weights);
    }
    
    // Explicitly dispatch the regenerate event
    window.dispatchEvent(new CustomEvent('regenerate-analysis', {
      detail: { weights: weights }
    }));
    
    // Show feedback
    toast({
      title: "Regenerating Analysis",
      description: "Applying your custom weights and refreshing your political analysis...",
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-sm mb-4">
        <p className="flex items-center gap-1">
          <HelpCircle className="h-4 w-4" />
          <span>Higher values give more weight to a dimension, lower values reduce its importance.</span>
        </p>
      </div>
      
      <div className="space-y-4">
        {dimensionDisplayConfig.map((dim) => (
          <div key={dim.id} className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <span className="mr-2 text-xl">{dim.icon}</span>
                <span className="font-medium">{dim.label}</span>
              </div>
              <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                {weights[dim.id]?.toFixed(1) || '1.0'}×
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs">0.1×</span>
              <Slider
                value={[weights[dim.id] || 1]}
                min={0.1}
                max={3}
                step={0.1}
                onValueChange={(value) => handleWeightChange(dim.id, value)}
                className="flex-grow"
              />
              <span className="text-xs">3.0×</span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {weights[dim.id] < 0.5 ? (
                "This dimension will have minimal impact on your match results."
              ) : weights[dim.id] > 2 ? (
                "This dimension will have a major impact on your match results."
              ) : (
                "This dimension has standard weighting in your match results."
              )}
            </p>
          </div>
        ))}
      </div>
      
      <div className="flex flex-wrap gap-2 justify-between mt-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={resetWeights}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Default
        </Button>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={saveWeights}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Weights
          </Button>
          
          <Button 
            size="sm"
            onClick={saveAndRegenerate}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4" />
            Save & Regenerate
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DimensionWeights;