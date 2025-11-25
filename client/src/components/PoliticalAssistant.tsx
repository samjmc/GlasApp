import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { politicalSuggestions } from "@shared/data";

interface PoliticalAssistantProps {
  ideology: string;
}

const PoliticalAssistant = ({ ideology }: PoliticalAssistantProps) => {
  const [topic, setTopic] = useState<string>("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestedTopic, setSuggestedTopic] = useState<string | null>(null);
  
  const handleAsk = () => {
    if (!topic.trim()) return;
    
    // Convert topic to a key format
    const topicKey = topic.toLowerCase().trim().replace(/\s+/g, '-');
    
    // Look for exact matches first
    if (politicalSuggestions[topicKey]) {
      // Get suggestion based on ideology, fallback to default
      const ideologySuggestion = politicalSuggestions[topicKey][ideology] || 
                                 politicalSuggestions[topicKey].default;
      
      setSuggestion(ideologySuggestion);
      setSuggestedTopic(topic);
    } 
    // Simple keyword matching
    else if (topicKey.includes('carbon') || topicKey.includes('climat')) {
      // Carbon taxation topic
      const ideologySuggestion = politicalSuggestions['carbon-taxation'][ideology] || 
                                 politicalSuggestions['carbon-taxation'].default;
      
      setSuggestion(ideologySuggestion);
      setSuggestedTopic('Carbon Taxation');
    }
    else if (topicKey.includes('educat') || topicKey.includes('school')) {
      // Education topic
      const ideologySuggestion = politicalSuggestions['education-reform'][ideology] || 
                                 politicalSuggestions['education-reform'].default;
      
      setSuggestion(ideologySuggestion);
      setSuggestedTopic('Education Reform');
    }
    else if (topicKey.includes('health') || topicKey.includes('medical') || topicKey.includes('care')) {
      // Healthcare topic
      const ideologySuggestion = politicalSuggestions['healthcare'][ideology] || 
                                 politicalSuggestions['healthcare'].default;
      
      setSuggestion(ideologySuggestion);
      setSuggestedTopic('Healthcare');
    }
    else {
      // Generic response
      setSuggestion(`Based on your position as a ${ideology}, you might approach ${topic} by balancing individual freedoms with collective responsibilities, considering both economic and social implications.`);
      setSuggestedTopic(topic);
    }
  };
  
  return (
    <Card className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <CardContent className="p-6">
        <h3 className="text-xl font-semibold mb-4">Political Assistant</h3>
        <p className="mb-4 text-gray-600 dark:text-gray-400">
          Get personalized insights based on your political position.
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" htmlFor="political-topic">
            Where should I stand on:
          </label>
          <div className="flex">
            <Input 
              id="political-topic"
              className="flex-grow rounded-l-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-3 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
              placeholder="e.g., carbon taxation, education reform"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
            />
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 rounded-r-md transition-colors"
              onClick={handleAsk}
            >
              Ask
            </Button>
          </div>
        </div>
        
        {suggestion && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-4">
              <h4 className="font-medium mb-2">On {suggestedTopic}</h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {suggestion}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PoliticalAssistant;
