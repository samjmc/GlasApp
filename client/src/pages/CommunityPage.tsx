import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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

// Sample polls
const polls = [
  {
    id: 1,
    question: "Should Ireland increase its housing density in urban areas?",
    options: [
      { id: 1, text: "Yes, significantly", votes: 452 },
      { id: 2, text: "Yes, but with careful planning", votes: 873 },
      { id: 3, text: "No, focus on expanding suburbs", votes: 321 },
      { id: 4, text: "No, focus on rural development", votes: 204 }
    ],
    totalVotes: 1850,
    author: "Housing Commission",
    avatar: "HC",
    timestamp: "1 day ago"
  },
  {
    id: 2,
    question: "What should be Ireland's approach to EU defense policy?",
    options: [
      { id: 1, text: "Maintain strict neutrality", votes: 687 },
      { id: 2, text: "Join common EU defense", votes: 543 },
      { id: 3, text: "Selective participation", votes: 412 },
      { id: 4, text: "Focus on UN peacekeeping", votes: 298 }
    ],
    totalVotes: 1940,
    author: "PolicyWatch",
    avatar: "PW",
    timestamp: "3 days ago"
  }
];

const CommunityPage = () => {
  const [activeCommunityTab, setActiveCommunityTab] = useState("debate");
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-20 lg:pb-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Community</h1>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Engage in discussions, participate in polls, and connect with others around Irish political topics.
        </p>
      </div>
      
      <Tabs value={activeCommunityTab} onValueChange={setActiveCommunityTab} className="w-full">
        <TabsList className="w-full max-w-2xl mx-auto mb-8 grid grid-cols-3">
          <TabsTrigger value="debate">Debate</TabsTrigger>
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="circle">My Circle</TabsTrigger>
        </TabsList>
        
        {/* Debate Tab Content */}
        <TabsContent value="debate" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 shadow-md mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">Start a Discussion</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Input placeholder="Title" />
                    <Textarea placeholder="Share your thoughts on a political topic..." className="min-h-[120px]" />
                    <div className="flex justify-between items-center">
                      <select className="py-2 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                        <option>Select a category</option>
                        <option>Housing</option>
                        <option>Economy</option>
                        <option>Immigration</option>
                        <option>EU Relations</option>
                        <option>Healthcare</option>
                      </select>
                      <Button>Post Discussion</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">Popular Discussions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="trending">
                    <TabsList className="mb-4">
                      <TabsTrigger value="trending">Trending</TabsTrigger>
                      <TabsTrigger value="newest">Newest</TabsTrigger>
                      <TabsTrigger value="controversial">Controversial</TabsTrigger>
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
                            <button className="mr-4 flex items-center hover:text-indigo-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              {post.likes} likes
                            </button>
                            <button className="flex items-center hover:text-indigo-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              {post.comments} comments
                            </button>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="newest">
                      <div className="p-8 text-center text-gray-500">
                        <p>Sign in to view the newest discussions</p>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="controversial">
                      <div className="p-8 text-center text-gray-500">
                        <p>Sign in to view the most controversial discussions</p>
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
              
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Community Guidelines</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Be respectful and considerate of different viewpoints
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Focus on ideas and policies, not personal attacks
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Back up claims with credible sources when possible
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Engage in good faith discussions
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Polls Tab Content */}
        <TabsContent value="polls" className="mt-2">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="bg-white dark:bg-gray-800 shadow-md mb-6">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-bold">Create a Poll</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Input placeholder="Ask a question..." />
                    
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input placeholder="Option 1" />
                        <Button variant="ghost" className="px-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input placeholder="Option 2" />
                        <Button variant="ghost" className="px-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                    
                    <Button variant="outline" size="sm" className="mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Option
                    </Button>
                    
                    <div className="flex justify-between items-center mt-4">
                      <select className="py-2 px-3 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm">
                        <option>Select a category</option>
                        <option>Housing</option>
                        <option>Economy</option>
                        <option>Immigration</option>
                        <option>EU Relations</option>
                        <option>Healthcare</option>
                      </select>
                      <Button>Create Poll</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="space-y-6">
                {polls.map(poll => (
                  <Card key={poll.id} className="bg-white dark:bg-gray-800 shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex items-center mb-2">
                        <Avatar className="h-8 w-8 mr-2">
                          <AvatarImage src="" />
                          <AvatarFallback>{poll.avatar}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{poll.author}</div>
                          <div className="text-xs text-gray-500">{poll.timestamp}</div>
                        </div>
                      </div>
                      <CardTitle className="text-xl">{poll.question}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {poll.options.map(option => {
                          const percentage = Math.round((option.votes / poll.totalVotes) * 100);
                          return (
                            <div key={option.id} className="space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span>{option.text}</span>
                                <span className="text-gray-500">{percentage}% ({option.votes} votes)</span>
                              </div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-indigo-500 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 text-sm text-gray-500">
                        Total votes: {poll.totalVotes}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                      <Button variant="outline" size="sm">
                        Vote
                      </Button>
                      <Button variant="ghost" size="sm">
                        Share
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
            
            <div className="space-y-6">
              <Card className="bg-white dark:bg-gray-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-bold">Popular Poll Categories</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {["Housing & Urban Development", "Foreign Policy", "Healthcare", "Economy & Taxation", "Immigration", "Environment"].map((category, index) => (
                      <div 
                        key={index} 
                        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between"
                      >
                        <span>{category}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-white dark:bg-gray-800 shadow-md border-2 border-indigo-100 dark:border-indigo-900">
                <CardHeader className="pb-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30">
                  <CardTitle className="text-lg font-bold">Poll Guidelines</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Keep questions clear and unbiased
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Provide balanced answer options
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Polls should focus on political issues
                    </li>
                    <li className="flex">
                      <span className="font-medium mr-2">•</span> 
                      Be respectful of diverse viewpoints
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* My Circle Tab Content */}
        <TabsContent value="circle" className="mt-2">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-white dark:bg-gray-800 shadow-md mb-6">
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold">Connect with Others</CardTitle>
                <CardDescription>
                  Follow other users to create your political circle
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center py-12">
                <div className="mb-6">
                  <Avatar className="h-20 w-20 mx-auto">
                    <AvatarFallback className="text-2xl">👤</AvatarFallback>
                  </Avatar>
                </div>
                <h3 className="text-lg font-semibold mb-2">Sign In Required</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                  Create an account to connect with others, follow users, and build your political circle.
                </p>
                <div className="flex gap-4 justify-center">
                  <Button>Sign In</Button>
                  <Button variant="outline">Create Account</Button>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white dark:bg-gray-800 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Suggested Connections</CardTitle>
                <CardDescription>
                  People with similar political interests
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 opacity-70">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 mr-3">
                          <AvatarFallback>U{i}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">User {i}</div>
                          <div className="text-xs text-gray-500">Similar views on Economy</div>
                        </div>
                      </div>
                      <Button variant="outline" disabled>Follow</Button>
                    </div>
                  ))}
                </div>
                <div className="mt-6 text-center text-sm text-gray-500">
                  Sign in to see and follow suggested connections
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CommunityPage;