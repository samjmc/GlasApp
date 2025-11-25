import { createContext, useContext, useState, ReactNode } from "react";
import { PoliticalFigure, QuizResult, UserResponse } from "@shared/schema";
import { politicalFigures, getIdeology, uniqueCombinations } from "@shared/data";

// Define context type with default values
interface QuizContextType {
  responses: UserResponse[];
  results: QuizResult | null;
  isResultsCalculated: boolean;
  setResponses: (responses: UserResponse[]) => void;
  calculateResults: () => void;
  resetQuiz: () => void;
  loadSharedResults: (shareCode: string) => boolean;
}

// Create initial context value
const defaultContextValue: QuizContextType = {
  responses: [],
  results: null,
  isResultsCalculated: false,
  setResponses: () => {},
  calculateResults: () => {},
  resetQuiz: () => {},
  loadSharedResults: () => false
};

// Create context with default value
const QuizContext = createContext<QuizContextType>(defaultContextValue);

interface QuizProviderProps {
  children: ReactNode;
}

function getRandomUniqueCombinations(count: number) {
  const keys = Object.keys(uniqueCombinations);
  const shuffled = [...keys].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, Math.min(count, keys.length));
  
  return selected.map(key => uniqueCombinations[key as keyof typeof uniqueCombinations]);
}

function findSimilarFigures(economic: number, social: number, count: number): PoliticalFigure[] {
  // Calculate distance of each figure from the user's position
  return politicalFigures
    .map(figure => {
      const distance = Math.sqrt(
        Math.pow(figure.economic - economic, 2) + 
        Math.pow(figure.social - social, 2)
      );
      return { ...figure, distance };
    })
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))
    .slice(0, count);
}

function analyzeCustomResponses(responses: UserResponse[]) {
  // Placeholder implementation for custom text analysis
  // In a real implementation, this would use NLP or call an AI service
  
  let economicShift = 0;
  let socialShift = 0;
  
  for (const response of responses) {
    if (response.customAnswer) {
      const text = response.customAnswer.toLowerCase();
      
      // Very simple keyword analysis - in a real app, this would use AI
      
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
}

export const QuizProvider = ({ children }: QuizProviderProps) => {
  const [responses, setResponses] = useState<UserResponse[]>([]);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [isResultsCalculated, setIsResultsCalculated] = useState(false);
  
  const calculateResults = () => {
    if (responses.length === 0) return;
    
    let economicTotal = 0;
    let socialTotal = 0;
    let answeredQuestions = 0;
    
    // Analyze responses with selected answers
    for (const response of responses) {
      if (response.answerId !== undefined) {
        // Find the question and selected answer
        const question = response.questionId;
        const answerIndex = response.answerId;
        
        // Import questions dynamically to avoid circular dependency
        const { questions } = require('@shared/data');
        
        // Find the question
        const questionObj = questions.find((q: any) => q.id === question);
        if (questionObj && questionObj.answers[answerIndex]) {
          economicTotal += questionObj.answers[answerIndex].economic;
          socialTotal += questionObj.answers[answerIndex].social;
          answeredQuestions++;
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
    }
    
    // Calculate averages
    const economicScore = answeredQuestions > 0 ? economicTotal / answeredQuestions : 0;
    const socialScore = answeredQuestions > 0 ? socialTotal / answeredQuestions : 0;
    
    // Get ideology
    const { name: ideology, description } = getIdeology(economicScore, socialScore);
    
    // Find similar figures
    const similarFigures = findSimilarFigures(economicScore, socialScore, 3);
    
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
    
    setResults(quizResults);
    setIsResultsCalculated(true);
  };
  
  const resetQuiz = () => {
    setResponses([]);
    setResults(null);
    setIsResultsCalculated(false);
  };
  
  const loadSharedResults = (shareCode: string): boolean => {
    // In a real app, this would fetch the results from the server
    // For now, generate mock results based on the share code
    
    try {
      // Generate deterministic results based on the share code
      const codeSum = shareCode.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      
      const economicScore = ((codeSum % 20) - 10) * 0.9;
      const socialScore = (((codeSum * 7) % 20) - 10) * 0.8;
      
      // Get ideology
      const { name: ideology, description } = getIdeology(economicScore, socialScore);
      
      // Find similar figures
      const similarFigures = findSimilarFigures(economicScore, socialScore, 3);
      
      // Generate unique combinations (deterministically based on share code)
      const combinationIndices = [codeSum % 5, (codeSum * 3) % 5];
      const combinationKeys = Object.keys(uniqueCombinations);
      const userCombinations = combinationIndices.map(i => 
        uniqueCombinations[combinationKeys[i] as keyof typeof uniqueCombinations]
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
  
  return (
    <QuizContext.Provider
      value={{
        responses,
        results,
        isResultsCalculated,
        setResponses,
        calculateResults,
        resetQuiz,
        loadSharedResults
      }}
    >
      {children}
    </QuizContext.Provider>
  );
};

// Export the hook without undefined check since we provide default values
export function useQuiz(): QuizContextType {
  return useContext(QuizContext);
}
