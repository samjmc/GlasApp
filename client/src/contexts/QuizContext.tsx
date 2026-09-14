import React, { createContext, useContext, useState, ReactNode } from "react";
import { PoliticalFigure, QuizResult, UserResponse, QuizQuestion } from "@shared/schema";
import { politicalFigures, getIdeology, uniqueCombinations, questions } from "@shared/data";
import { calculateDistance } from "@/lib/utils";

// Context type definition
interface QuizContextType {
  responses: UserResponse[];
  results: QuizResult | null;
  isResultsCalculated: boolean;
  setResponses: (responses: UserResponse[]) => void;
  calculateResults: () => void;
  resetQuiz: () => void;
  loadSharedResults: (shareCode: string) => boolean;
}

// Create context with a default undefined value
const QuizContext = createContext<QuizContextType | undefined>(undefined);

// Helper functions
const getRandomUniqueCombinations = (count: number) => {
  const keys = Object.keys(uniqueCombinations);
  const shuffled = [...keys].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, keys.length));
  
  return selected.map(key => uniqueCombinations[key as keyof typeof uniqueCombinations]);
};

const findSimilarFigures = (economic: number, social: number, count: number): PoliticalFigure[] => {
  // Calculate Euclidean distance of each figure from the user's position
  const figuresWithDistance = politicalFigures.map(figure => {
    // Euclidean distance formula: sqrt((x2-x1)² + (y2-y1)²)
    const distance = calculateDistance(figure.economic, figure.social, economic, social);
    return { ...figure, distance };
  });

  // Sort by distance (closest first)
  const sortedByDistance = figuresWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  
  // Add diversity to results - ensure representation from different parts of political spectrum
  const result: PoliticalFigure[] = [];
  const quadrants: {[key: string]: PoliticalFigure[]} = {
    'left-lib': [], // Left-libertarian
    'left-auth': [], // Left-authoritarian
    'right-lib': [], // Right-libertarian
    'right-auth': [], // Right-authoritarian
    'center': [] // Centrists
  };
  
  // Group figures by quadrant based on user's position
  sortedByDistance.forEach(figure => {
    if (figure.economic < -3 && figure.social < -3) {
      quadrants['left-lib'].push(figure);
    } else if (figure.economic < -3 && figure.social > 3) {
      quadrants['left-auth'].push(figure);
    } else if (figure.economic > 3 && figure.social < -3) {
      quadrants['right-lib'].push(figure);
    } else if (figure.economic > 3 && figure.social > 3) {
      quadrants['right-auth'].push(figure);
    } else {
      quadrants['center'].push(figure);
    }
  });
  
  // First add closest match overall
  if (sortedByDistance.length > 0) {
    result.push(sortedByDistance[0]);
  }
  
  // Then add closest match from each quadrant if available and within reasonable distance
  Object.values(quadrants).forEach(quadrantFigures => {
    if (quadrantFigures.length > 0 && !result.some(fig => fig.id === quadrantFigures[0].id) && quadrantFigures[0].distance && quadrantFigures[0].distance < 15) {
      result.push(quadrantFigures[0]);
    }
  });
  
  // If we don't have enough figures yet, add more from the overall sorted list
  for (let i = 1; result.length < count && i < sortedByDistance.length; i++) {
    if (!result.some(fig => fig.id === sortedByDistance[i].id)) {
      result.push(sortedByDistance[i]);
    }
  }
  
  // Sort the final result by distance
  return result.sort((a, b) => (a.distance || 0) - (b.distance || 0)).slice(0, count);
};

const analyzeCustomResponses = (responses: UserResponse[]) => {
  let economicShift = 0;
  let socialShift = 0;
  
  for (const response of responses) {
    if (response.customAnswer) {
      const text = response.customAnswer.toLowerCase();
      
      // Economic axis keywords
      if (text.includes('regulation') || text.includes('tax') || text.includes('redistribution') || 
          text.includes('welfare') || text.includes('public services')) {
        economicShift -= 2; // More left-leaning
      }
      
      if (text.includes('free market') || text.includes('capitalism') || text.includes('private') || 
          text.includes('property rights') || text.includes('deregulation')) {
        economicShift += 2; // More right-leaning
      }
      
      // Social axis keywords
      if (text.includes('authority') || text.includes('tradition') || text.includes('order') || 
          text.includes('security') || text.includes('strong government')) {
        socialShift += 2; // More authoritarian
      }
      
      if (text.includes('freedom') || text.includes('liberty') || text.includes('choice') || 
          text.includes('individual') || text.includes('rights')) {
        socialShift -= 2; // More libertarian
      }
    }
  }
  
  return { economicShift, socialShift };
};

// Provider component
interface QuizProviderProps {
  children: ReactNode;
}

// Helpers for localStorage
const saveResultsToLocalStorage = (results: QuizResult | null) => {
  if (results) {
    localStorage.setItem('politicalCompassResults', JSON.stringify(results));
    localStorage.setItem('resultsCalculated', 'true');
  } else {
    localStorage.removeItem('politicalCompassResults');
    localStorage.removeItem('resultsCalculated');
  }
};

const getResultsFromLocalStorage = (): { 
  savedResults: QuizResult | null, 
  savedCalculated: boolean 
} => {
  const savedResults = localStorage.getItem('politicalCompassResults');
  const savedCalculated = localStorage.getItem('resultsCalculated') === 'true';
  
  return { 
    savedResults: savedResults ? JSON.parse(savedResults) : null,
    savedCalculated
  };
};

export const QuizProvider: React.FC<QuizProviderProps> = ({ children }) => {
  // Initialize from localStorage if available
  const { savedResults, savedCalculated } = getResultsFromLocalStorage();
  
  const [responses, setResponses] = useState<UserResponse[]>([]);
  const [results, setResults] = useState<QuizResult | null>(savedResults);
  const [isResultsCalculated, setIsResultsCalculated] = useState(savedCalculated);
  
  const calculateResults = () => {
    if (responses.length === 0) {
      console.log("No responses to calculate results from");
      return;
    }
    
    console.log("Calculating results from", responses.length, "responses");
    
    let economicTotal = 0;
    let socialTotal = 0;
    let answeredQuestions = 0;
    
    // Analyze responses with selected answers
    for (const response of responses) {
      if (response.answerId !== undefined) {
        // Find the question and selected answer
        const questionId = response.questionId;
        const answerIndex = response.answerId;
        
        // Find the question
        const questionObj = questions.find((q: QuizQuestion) => q.id === questionId);
        if (questionObj && questionObj.answers[answerIndex]) {
          economicTotal += questionObj.answers[answerIndex].economic;
          socialTotal += questionObj.answers[answerIndex].social;
          answeredQuestions++;
          console.log(`Question ${questionId}, Answer ${answerIndex}: economic ${questionObj.answers[answerIndex].economic}, social ${questionObj.answers[answerIndex].social}`);
        } else {
          console.log(`Could not find question ${questionId} or answer ${answerIndex}`);
        }
      }
    }
    
    // Analyze custom text responses
    const customResponses = responses.filter(r => r.customAnswer && r.customAnswer.trim() !== '');
    if (customResponses.length > 0) {
      const { economicShift, socialShift } = analyzeCustomResponses(customResponses);
      economicTotal += economicShift;
      socialTotal += socialShift;
      answeredQuestions += customResponses.length;
      console.log(`Custom responses: economic shift ${economicShift}, social shift ${socialShift}`);
    }
    
    // Calculate averages
    const economicScore = answeredQuestions > 0 ? economicTotal / answeredQuestions : 0;
    const socialScore = answeredQuestions > 0 ? socialTotal / answeredQuestions : 0;
    
    console.log(`Final scores: economic ${economicScore}, social ${socialScore}, based on ${answeredQuestions} answers`);
    
    // Get ideology
    const { name: ideology, description } = getIdeology(economicScore, socialScore);
    
    // Find similar figures
    const similarFigures = findSimilarFigures(economicScore, socialScore, 5);
    
    // Generate unique combinations
    const userCombinations = getRandomUniqueCombinations(2);
    
    // Set results
    const quizResults: QuizResult = {
      economic: economicScore,
      social: socialScore,
      ideology,
      description,
      similarFigures,
      uniqueCombinations: userCombinations
    };
    
    console.log("Setting quiz results:", quizResults);
    
    // Save to localStorage first for persistence
    localStorage.setItem('politicalCompassResults', JSON.stringify(quizResults));
    localStorage.setItem('resultsCalculated', 'true');
    
    // Then update state
    setResults(quizResults);
    setIsResultsCalculated(true);

    return quizResults;
  };
  
  const resetQuiz = () => {
    // Clear localStorage
    localStorage.removeItem('politicalCompassResults');
    localStorage.removeItem('resultsCalculated');
    
    // Reset state
    setResponses([]);
    setResults(null);
    setIsResultsCalculated(false);
  };
  
  const loadSharedResults = (shareCode: string): boolean => {
    try {
      // Generate deterministic results based on the share code
      const codeSum = shareCode.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      
      const economicScore = ((codeSum % 20) - 10) * 0.9;
      const socialScore = (((codeSum * 7) % 20) - 10) * 0.8;
      
      // Get ideology
      const { name: ideology, description } = getIdeology(economicScore, socialScore);
      
      // Find similar figures
      const similarFigures = findSimilarFigures(economicScore, socialScore, 5);
      
      // Generate unique combinations (deterministically based on share code)
      const combinationIndices = [codeSum % 5, (codeSum * 3) % 5];
      const combinationKeys = Object.keys(uniqueCombinations);
      const userCombinations = combinationIndices.map(i => 
        uniqueCombinations[combinationKeys[i % combinationKeys.length] as keyof typeof uniqueCombinations]
      );
      
      // Set results
      const quizResults: QuizResult = {
        economic: economicScore,
        social: socialScore,
        ideology,
        description,
        similarFigures,
        uniqueCombinations: userCombinations
      };
      
      setResults(quizResults);
      setIsResultsCalculated(true);
      
      return true;
    } catch (error) {
      console.error("Error loading shared results:", error);
      return false;
    }
  };
  
  const value = {
    responses,
    results,
    isResultsCalculated,
    setResponses,
    calculateResults,
    resetQuiz,
    loadSharedResults
  };
  
  return (
    <QuizContext.Provider value={value}>
      {children}
    </QuizContext.Provider>
  );
};

// Custom hook to use the quiz context
export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (context === undefined) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
};