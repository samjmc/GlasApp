import { useState } from "react";
import { useLocation } from "wouter";
import ZoomableIrelandMap from "@/components/ZoomableIrelandMap";
import HistoricalContext from "@/components/HistoricalContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sample trending topics
const trendingTopics = [
  "Housing Crisis",
  "Immigration Policy",
  "EU Relations",
  "Climate Action",
  "Healthcare Reform"
];

// Sample popular posts
const popularPosts = [
  {
    id: 1,
    author: "MichaelD",
    avatar: "MD",
    title: "Housing Policy Needs Urgent Reform",
    content: "The current approach to housing in Dublin is failing our communities. We need to rethink zoning laws and increase affordable housing development...",
    likes: 342,
    comments: 57,
    timestamp: "2 hours ago"
  },
  {
    id: 2,
    author: "SineadOC",
    avatar: "SO",
    title: "Immigration Has Strengthened Our Economy",
    content: "New data shows that immigration has actually strengthened Ireland's economy and filled critical skill gaps in healthcare and technology...",
    likes: 287,
    comments: 43,
    timestamp: "5 hours ago"
  },
  {
    id: 3,
    author: "LiamB",
    avatar: "LB",
    title: "Post-Brexit Opportunities for Ireland",
    content: "With the UK's departure from the EU, Ireland is now the primary English-speaking gateway to the European market. Here's how we can leverage this position...",
    likes: 213,
    comments: 29,
    timestamp: "Yesterday"
  }
];

const NewHome = () => {
  const [, navigate] = useLocation();
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Handle asking the AI political assistant
  const handleAskAi = async () => {
    if (!aiQuestion.trim()) return;
    
    setIsAiLoading(true);
    setAiResponse(null);
    
    try {
      // In a real implementation, this would call your OpenAI API endpoint
      // For now, we'll simulate a response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setAiResponse(
        `Based on current political trends in Ireland, the question of "${aiQuestion}" is complex. 
        Recent polls suggest that public opinion is divided, with urban centers like Dublin tending to favor 
        progressive policies, while rural areas often maintain more traditional viewpoints. 
        The current government coalition has taken a moderate stance on this issue, balancing 
        economic concerns with social considerations.`
      );
    } catch (error) {
      console.error("Error getting AI response:", error);
      setAiResponse("Sorry, I couldn't process your question at this time. Please try again later.");
    } finally {
      setIsAiLoading(false);
    }
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Irish Political Pulse</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Explore political opinions across Ireland, engage with trending topics, and discover where you stand on the issues that matter most.
        </p>
      </div>
      
      {/* Main Navigation Tabs */}
      <Tabs defaultValue="map" className="w-full">
        <TabsList className="w-full max-w-3xl mx-auto mb-8 grid grid-cols-4">
          <TabsTrigger value="map">Political Map</TabsTrigger>
          <TabsTrigger value="history">Historical Context</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
          <TabsTrigger value="community">Community</TabsTrigger>
        </TabsList>
        
        {/* Political Map Tab */}
        <TabsContent value="map" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">Political Geography of Ireland</CardTitle>
                  <CardDescription>
                    Interactive visualization of political leanings across Irish counties
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ZoomableIrelandMap height={500} />
                </CardContent>
                <CardFooter className="text-sm text-gray-500 border-t pt-4">
                  Click on Dublin to zoom in and see district-level data. Use the controls to zoom and pan the map.
                </CardFooter>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Map Legend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-sm mb-2">Economic Views</h3>
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#3b82f6" }}></div>
                          Left-leaning
                        </span>
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#ef4444" }}></div>
                          Right-leaning
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-sm mb-2">Social Views</h3>
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#10b981" }}></div>
                          Progressive
                        </span>
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#8b5cf6" }}></div>
                          Traditional
                        </span>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-sm mb-2">Issue-Specific Views</h3>
                      <div className="flex justify-between">
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#f59e0b" }}></div>
                          Against/Skeptical
                        </span>
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: "#0ea5e9" }}></div>
                          Supportive
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800 shadow-md border-2 border-indigo-100 dark:border-indigo-900">
                <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                  <CardTitle className="text-lg font-bold">Find Your Position</CardTitle>
                  <CardDescription>
                    Where do you stand?
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                    Take our quiz to discover your position on the political compass and compare with Irish political parties.
                  </p>
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => navigate('/enhanced-quiz')}
                  >
                    Take the Political Quiz
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Historical Context Tab */}
        <TabsContent value="history" className="mt-2">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">Political Perspectives & Historical Context</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Explore the historical context and educational information about different political positions in Ireland.
            </p>
            <HistoricalContext />
          </div>
        </TabsContent>
        
        {/* AI Insights Tab */}
        <TabsContent value="ai" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">AI Political Insights</CardTitle>
                  <CardDescription>
                    Ask our AI assistant about Irish political trends and issues
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <Textarea 
                        placeholder="Ask about current political trends or specific issues in Ireland..."
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        className="flex-grow"
                      />
                      <Button 
                        onClick={handleAskAi} 
                        disabled={isAiLoading || !aiQuestion.trim()}
                        className="self-end"
                      >
                        {isAiLoading ? "Thinking..." : "Ask AI"}
                      </Button>
                    </div>
                    
                    {isAiLoading && (
                      <div className="p-4 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                        <span className="text-gray-500">Analyzing political context...</span>
                      </div>
                    )}
                    
                    {aiResponse && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <div className="flex items-start mb-2">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                            <span className="text-indigo-600 text-sm font-medium">AI</span>
                          </div>
                          <div className="text-sm font-medium">Political Analysis</div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">{aiResponse}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Suggested Questions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    "How has Ireland's position on EU integration evolved?",
                    "What are the main parties' positions on housing?",
                    "How has immigration policy changed in the last decade?",
                    "What are the historical roots of Irish neutrality?",
                  ].map((question, index) => (
                    <Button 
                      key={index} 
                      variant="outline" 
                      className="justify-start h-auto py-3 px-4 text-left"
                      onClick={() => {
                        setAiQuestion(question);
                        setAiResponse(null);
                      }}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">About the AI Assistant</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    Our AI assistant is trained on a comprehensive dataset of Irish political history, current events, and policy positions of major parties.
                  </p>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                        <span className="text-green-600 text-xs">✓</span>
                      </div>
                      <p>Get objective analysis of complex political issues</p>
                    </div>
                    <div className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                        <span className="text-green-600 text-xs">✓</span>
                      </div>
                      <p>Understand the historical context behind current debates</p>
                    </div>
                    <div className="flex items-start">
                      <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center mr-2 mt-0.5">
                        <span className="text-green-600 text-xs">✓</span>
                      </div>
                      <p>Learn about different political perspectives across Ireland</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Trending Political Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trendingTopics.map((topic, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                        onClick={() => {
                          setAiQuestion(`What are the different perspectives on ${topic} in Ireland?`);
                          setAiResponse(null);
                        }}
                      >
                        #{topic.replace(/\s+/g, '')}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Community Tab */}
        <TabsContent value="community" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">Popular Discussions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="trending">
                    <TabsList className="mb-4">
                      <TabsTrigger value="trending">Trending</TabsTrigger>
                      <TabsTrigger value="newest">Newest</TabsTrigger>
                      <TabsTrigger value="debated">Most Debated</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="trending" className="space-y-4">
                      {popularPosts.map((post) => (
                        <div key={post.id} className="border-b border-gray-200 dark:border-gray-700 last:border-0 pb-4 last:pb-0">
                          <div className="flex items-center mb-2">
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarImage src="" />
                              <AvatarFallback>{post.avatar}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-sm">{post.author}</div>
                              <div className="text-xs text-gray-500">{post.timestamp}</div>
                            </div>
                          </div>
                          
                          <h3 className="font-semibold mb-1">{post.title}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{post.content}</p>
                          
                          <div className="flex items-center text-xs text-gray-500">
                            <span className="mr-4">{post.likes} likes</span>
                            <span>{post.comments} comments</span>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="newest">
                      <div className="p-8 text-center text-gray-500">
                        <p>Sign in to view the newest discussions</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="debated">
                      <div className="p-8 text-center text-gray-500">
                        <p>Sign in to view the most debated topics</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
                <CardFooter className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <Button variant="outline" className="w-full">
                    View All Discussions
                  </Button>
                </CardFooter>
              </Card>
            </div>
            
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 shadow-md border-2 border-indigo-100 dark:border-indigo-900">
                <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                  <CardTitle className="text-lg font-bold">Find Your Position</CardTitle>
                  <CardDescription>
                    Take the quiz
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-gray-600 dark:text-gray-300 mb-4 text-sm">
                    Discover where you stand on the political compass and compare with Irish political parties.
                  </p>
                  <Button 
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={() => navigate('/enhanced-quiz')}
                  >
                    Take the Political Quiz
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Trending Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {trendingTopics.map((topic, index) => (
                      <span 
                        key={index}
                        className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                      >
                        #{topic.replace(/\s+/g, '')}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NewHome;