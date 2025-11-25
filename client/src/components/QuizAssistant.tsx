import { useState, useRef, useEffect } from "react";
import { QuizQuestion } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface QuizAssistantProps {
  question: QuizQuestion;
  isOpen: boolean;
  onClose: () => void;
}

const QuizAssistant = ({ question, isOpen, onClose }: QuizAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `I'm your AI Political Assistant. I can help explain concepts, provide context, or discuss different perspectives about this question: "${question.text}". What would you like to know?`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Update welcome message when question changes
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `I'm your AI Political Assistant. I can help explain concepts, provide context, or discuss different perspectives about this question: "${question.text}". What would you like to know?`
      }
    ]);
  }, [question.id, question.text]);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Call our OpenAI integration
      const response = await apiRequest({
        method: "POST",
        path: "/api/ai/quiz-assistant",
        body: {
          questionText: question.text,
          questionContext: question.text,
          userQuestion: input,
          conversationHistory: messages
        }
      });

      if (response?.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: response.answer
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Fallback response if API fails
        const fallbackMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment."
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }
    } catch (error) {
      console.error("Error communicating with AI assistant:", error);
      // Error response
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error trying to process your question. Please try again later."
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop with blur effect */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      {/* Chat window */}
      <Card className="w-full max-w-md sm:max-w-lg h-[600px] max-h-[80vh] relative z-10 flex flex-col bg-white dark:bg-gray-900 shadow-xl rounded-t-xl sm:rounded-xl">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
              <span className="text-indigo-600 text-sm font-medium">AI</span>
            </div>
            <div>
              <div className="font-medium">Political Assistant</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Helping you understand political concepts
              </div>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="h-8 w-8 p-0 rounded-full" 
            onClick={onClose}
          >
            ✕
          </Button>
        </div>
        
        {/* Messages container */}
        <CardContent className="flex-grow overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id}
              className={cn(
                "flex flex-col max-w-[85%] rounded-xl p-3 mb-2",
                message.role === "user" 
                  ? "ml-auto bg-indigo-100 dark:bg-indigo-900 text-gray-800 dark:text-gray-100" 
                  : "mr-auto bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100"
              )}
            >
              <span className="text-xs font-medium mb-1">
                {message.role === "user" ? "You" : "AI Assistant"}
              </span>
              <span className="text-sm whitespace-pre-wrap">{message.content}</span>
            </div>
          ))}
          {isLoading && (
            <div className="flex mr-auto bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-xl p-3 max-w-[85%]">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-xs">AI Assistant is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        
        {/* Input area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this political question..."
              className="flex-grow resize-none max-h-[120px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="self-end"
            >
              <span>Send</span>
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            This assistant provides educational context and explanations to help you form your own opinions.
          </div>
        </div>
      </Card>
    </div>
  );
};

export default QuizAssistant;