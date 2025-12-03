import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { UserResponse } from "@shared/quizTypes";
import { 
  enhancedQuestions, 
  getMultidimensionalIdeology,
} from "@shared/enhanced-quiz-data";
import { 
  IdeologicalDimensions, 
  MultidimensionalQuizResult, 
  defaultDimensions
} from "@shared/quizTypes";
import { apiRequest } from "@/lib/queryClient";

// Define context type
interface MultidimensionalQuizContextType {
  responses: UserResponse[];
  results: MultidimensionalQuizResult | null;
  isResultsCalculated: boolean;
  dimensionWeights: Record<string, number>;
  hasBeenSaved: boolean;
  setResponses: (responses: UserResponse[]) => void;
  // calculateResults now accepts optional responses parameter to avoid race conditions
  calculateResults: (inputResponses?: UserResponse[]) => IdeologicalDimensions | false;
  resetQuiz: () => void;
  saveResults: () => Promise<string | null>;
  updateDimensionWeights: (weights: Record<string, number>) => void;
  saveUserWeights: (weights: Record<string, number>) => void;
}

// Default weights (1.0 for all dimensions)
const defaultWeights: Record<string, number> = {
  economic: 1.0,
  social: 1.0,
  cultural: 1.0,
  globalism: 1.0,
  environmental: 1.0,
  authority: 1.0,
  welfare: 1.0,
  technocratic: 1.0
};

// Create initial context value
const defaultContextValue: MultidimensionalQuizContextType = {
  responses: [],
  results: null,
  isResultsCalculated: false,
  dimensionWeights: defaultWeights,
  hasBeenSaved: false,
  setResponses: () => {},
  calculateResults: () => false,
  resetQuiz: () => {},
  saveResults: async () => null,
  updateDimensionWeights: () => {},
  saveUserWeights: () => {}
};

// Create context
const MultidimensionalQuizContext = createContext<MultidimensionalQuizContextType>(defaultContextValue);

// Helper functions
const generateShareCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

interface MultidimensionalQuizProviderProps {
  children: ReactNode;
}

// Provider component
export const MultidimensionalQuizProvider: React.FC<MultidimensionalQuizProviderProps> = ({ children }) => {
  const [responses, setResponses] = useState<UserResponse[]>([]);
  const [results, setResults] = useState<MultidimensionalQuizResult | null>(null);
  const [isResultsCalculated, setIsResultsCalculated] = useState(false);
  const [dimensionWeights, setDimensionWeights] = useState<Record<string, number>>({ ...defaultWeights });
  const [hasBeenSaved, setHasBeenSaved] = useState(false);

  // Initialize from localStorage if available
  useEffect(() => {
    // Load quiz results
    const savedResults = localStorage.getItem('multidimensionalQuizResults');
    const resultsCalculated = localStorage.getItem('multidimensionalResultsCalculated');
    
    if (savedResults && resultsCalculated === 'true') {
      try {
        setResults(JSON.parse(savedResults));
        setIsResultsCalculated(true);
      } catch (e) {
        console.error('Error parsing saved results:', e);
      }
    }
    
    // Load weights if available
    const savedWeights = localStorage.getItem('dimensionWeights');
    if (savedWeights) {
      try {
        const weights = JSON.parse(savedWeights);
        console.log("Loaded saved weights from localStorage:", weights);
        setDimensionWeights(weights);
      } catch (e) {
        console.error('Error parsing saved weights:', e);
      }
    }
  }, []);

  // Reset quiz state - clear ALL quiz-related localStorage keys
  const resetQuiz = () => {
    setResponses([]);
    setResults(null);
    setIsResultsCalculated(false);
    setHasBeenSaved(false);
    
    // Clear all quiz-related localStorage keys to prevent stale data
    localStorage.removeItem('multidimensionalQuizResults');
    localStorage.removeItem('multidimensionalResultsCalculated');
    localStorage.removeItem('resultsDimensions');
    localStorage.removeItem('tempDimensions');
    localStorage.removeItem('resultsWeights');
    // Note: dimensionWeights is intentionally kept as it's a user preference
    
    console.log('Quiz reset - cleared all quiz data from localStorage');
  };

  // Calculate ideological dimensions based on answers
  const calculateDimensions = (responses: UserResponse[]): IdeologicalDimensions => {
    // Start with default dimensions (all zeros)
    const initialDimensions: IdeologicalDimensions = { ...defaultDimensions };
    
    // Map categories to their primary dimensions
    const categoryToDimension: Record<string, keyof IdeologicalDimensions> = {
      'Economic Strategy': 'economic',
      'Social Fabric': 'social',
      'Cultural Identity': 'cultural',
      'Global Role': 'globalism',
      'Environmental Choices': 'environmental',
      'Authority & Liberties': 'authority',
      'Welfare & Opportunity': 'welfare',
      'Governance Models': 'technocratic'
    };
    
    // Process each response
    for (const response of responses) {
      const { questionId, answerId } = response;
      
      // Find the question and answer in our enhanced questions array
      const questionObj = enhancedQuestions.find(q => q.id === questionId);
      
      if (questionObj && answerId !== undefined) {
        const answerObj = questionObj.answers[answerId];
        
        if (answerObj && questionObj.category) {
          // Only count scores from the PRIMARY dimension for this question's category
          const primaryDimension = categoryToDimension[questionObj.category];
          
          if (primaryDimension && answerObj[primaryDimension] !== undefined) {
            // Add the score for the primary dimension only
            initialDimensions[primaryDimension] += answerObj[primaryDimension] as number;
          }
          
          console.log(`Processing Q${questionId} (${questionObj.category}), A${answerId}: ${primaryDimension} = ${answerObj[primaryDimension]}`);
        }
      }
    }
    
    // Round each dimension to 1 decimal place (scores are already normalized per question)
    Object.keys(initialDimensions).forEach(dim => {
      const dimensionKey = dim as keyof IdeologicalDimensions;
      initialDimensions[dimensionKey] = parseFloat(initialDimensions[dimensionKey].toFixed(1));
    });
    
    return initialDimensions;
  };

  // Generate dimension-specific explanations
  const generateDimensionBreakdown = (dimensions: IdeologicalDimensions) => {
    const breakdown: Record<string, { score: number; explanation: string; influence: string }> = {};
    
    Object.keys(dimensions).forEach(dim => {
      const dimensionKey = dim as keyof IdeologicalDimensions;
      const score = dimensions[dimensionKey];
      
      let explanation = '';
      let influence = '';
      
      // Generate explanation based on the dimension and score
      switch (dimensionKey) {
        case 'economic':
          explanation = score < -5 ? 'You strongly favor economic redistribution and collective approaches.' :
                       score < 0 ? 'You moderately favor managed economics with social support systems.' :
                       score < 5 ? 'You prefer market economics with some regulation.' :
                       'You strongly support free markets with minimal intervention.';
          
          influence = score < 0 ? 'This influences you to support progressive taxation and robust public services.' :
                    'This influences you to favor business freedom and limited taxation.';
          break;
          
        case 'social':
          explanation = score < -5 ? 'You have strongly progressive social views.' :
                       score < 0 ? 'You lean toward progressive social policies.' :
                       score < 5 ? 'You have moderately traditional social views.' :
                       'You strongly value traditional social structures and norms.';
          
          influence = score < 0 ? 'This leads you to support social reforms and evolving cultural norms.' :
                    'This leads you to value preservation of established traditions and social institutions.';
          break;
          
        case 'cultural':
          explanation = score < -5 ? 'You embrace multicultural diversity and cultural evolution.' :
                       score < 0 ? 'You appreciate cultural diversity while respecting traditions.' :
                       score < 5 ? 'You value cultural heritage while accepting some adaptations.' :
                       'You strongly prioritize cultural preservation and traditional values.';
          
          influence = score < 0 ? 'This influences your support for cultural exchange and adaptation.' :
                    'This influences your desire to protect cultural heritage and identity.';
          break;
          
        case 'globalism':
          // FIXED: Scale is Nationalist (-10) to Internationalist (+10)
          explanation = score < -5 ? 'You strongly value national sovereignty and independence.' :
                       score < 0 ? 'You prioritize national autonomy while engaging internationally when beneficial.' :
                       score < 5 ? 'You favor international engagement while maintaining some sovereignty.' :
                       'You strongly support international cooperation and global governance.';
          
          influence = score < 0 ? 'This leads you to prioritize national interests in international affairs.' :
                    'This leads you to support international institutions and agreements.';
          break;
          
        case 'environmental':
          explanation = score < -5 ? 'You strongly prioritize environmental protection over economic considerations.' :
                       score < 0 ? 'You favor environmental protection balanced with economic needs.' :
                       score < 5 ? 'You support basic environmental protections while prioritizing development.' :
                       'You strongly favor resource development with minimal restrictions.';
          
          influence = score < 0 ? 'This influences your support for environmental regulations and sustainable policies.' :
                    'This influences your support for resource utilization and industrial development.';
          break;
          
        case 'authority':
          explanation = score < -5 ? 'You strongly value civil liberties and limited government power.' :
                       score < 0 ? 'You favor individual freedoms with moderate government authority.' :
                       score < 5 ? 'You support a balance of government authority and individual rights.' :
                       'You strongly value social order maintained through central authority.';
          
          influence = score < 0 ? 'This leads you to prioritize civil rights and personal autonomy.' :
                    'This leads you to prioritize security and social cohesion through authority.';
          break;
          
        case 'welfare':
          explanation = score < -5 ? 'You strongly support collective welfare systems and shared responsibility.' :
                       score < 0 ? 'You favor substantial social safety nets while valuing personal initiative.' :
                       score < 5 ? 'You emphasize personal responsibility with targeted welfare support.' :
                       'You strongly emphasize self-reliance and individual responsibility.';
          
          influence = score < 0 ? 'This influences your support for extensive social programs and shared resources.' :
                    'This influences your support for individual achievement and personal accountability.';
          break;
          
        case 'technocratic':
          explanation = score < -5 ? 'You strongly favor expert-guided, evidence-based policymaking.' :
                       score < 0 ? 'You value technical expertise while considering public input.' :
                       score < 5 ? 'You balance popular will with technical considerations in policy.' :
                       'You strongly prioritize the will of the people over expert judgment.';
          
          influence = score < 0 ? 'This leads you to trust scientific consensus and expertise in governance.' :
                    'This leads you to prioritize popular sentiment and common sense in governance.';
          break;
      }
      
      breakdown[dimensionKey] = { score, explanation, influence };
    });
    
    return breakdown;
  };

  // Calculate results from quiz responses
  // Accepts optional inputResponses to avoid race conditions with React state updates
  const calculateResults = (inputResponses?: UserResponse[]): IdeologicalDimensions | false => {
    // Use provided responses or fall back to state (for recalculation)
    const responsesToUse = inputResponses || responses;
    
    if (responsesToUse.length === 0) {
      console.log('No responses to calculate results from');
      return false;
    }
    
    console.log('Calculating results from', responsesToUse.length, 'responses');
    
    // Calculate dimensions from responses
    const dimensions = calculateDimensions(responsesToUse);
    console.log('Calculated dimensions:', dimensions);
    
    // Determine overall ideology based on dimensions
    const { name: ideology, description } = getMultidimensionalIdeology(dimensions);
    console.log('Identified ideology:', ideology);
    
    // Generate dimension breakdown for detailed explanations
    const dimensionBreakdown = generateDimensionBreakdown(dimensions);
    
    // Create the final result
    const quizResults: MultidimensionalQuizResult = {
      // Core dimensions
      economic: dimensions.economic,
      social: dimensions.social,
      
      // Extended dimensions
      cultural: dimensions.cultural,
      globalism: dimensions.globalism,
      environmental: dimensions.environmental, 
      authority: dimensions.authority,
      welfare: dimensions.welfare,
      technocratic: dimensions.technocratic,
      
      // Result interpretation
      ideology,
      description,
      
      // Enhanced analysis
      dimensionBreakdown,
      
      // Store user responses for answer explanation feature
      responses: [...responsesToUse],
      
      // Timestamp
      timestamp: new Date().toISOString()
    };
    
    // Save to localStorage for persistence
    localStorage.setItem('multidimensionalQuizResults', JSON.stringify(quizResults));
    localStorage.setItem('multidimensionalResultsCalculated', 'true');
    
    // Update state
    setResults(quizResults);
    setIsResultsCalculated(true);
    
    // Return the dimensions so they can be used for the weights page
    return dimensions;
  };

  // Save results to database
  const saveResults = async (): Promise<string | null> => {
    if (!results) {
      console.error('No results to save');
      return null;
    }
    
    if (hasBeenSaved) {
      console.log('Results have already been saved for this quiz session');
      return null;
    }
    
    try {
      // Generate a share code
      const shareCode = generateShareCode();
      
      // Prepare data for API
      const resultData = {
        ...results,
        shareCode,
        answers: responses
      };
      
      // Save to database via API
      await apiRequest({
        method: 'POST',
        path: '/api/multidimensional-quiz-results',
        body: resultData
      });
      
      // Mark as saved to prevent duplicate saves
      setHasBeenSaved(true);
      
      return shareCode;
    } catch (error) {
      console.error('Error saving quiz results:', error);
      return null;
    }
  };

  // Update dimension weights
  const updateDimensionWeights = (weights: Record<string, number>) => {
    setDimensionWeights(weights);
  };
  
  // Save user weights to localStorage
  const saveUserWeights = (weights: Record<string, number>) => {
    localStorage.setItem('dimensionWeights', JSON.stringify(weights));
    console.log("Saved weights to localStorage:", weights);
  };

  return (
    <MultidimensionalQuizContext.Provider
      value={{
        responses,
        results,
        isResultsCalculated,
        dimensionWeights,
        hasBeenSaved,
        setResponses,
        calculateResults,
        resetQuiz,
        saveResults,
        updateDimensionWeights,
        saveUserWeights
      }}
    >
      {children}
    </MultidimensionalQuizContext.Provider>
  );
};

// Custom hook to use the quiz context
export const useMultidimensionalQuiz = () => {
  const context = useContext(MultidimensionalQuizContext);
  if (context === undefined) {
    throw new Error('useMultidimensionalQuiz must be used within a MultidimensionalQuizProvider');
  }
  return context;
};