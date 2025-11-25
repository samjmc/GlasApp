import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronUp, ChevronDown, Plus, Flame, Star, Users, Lightbulb } from "lucide-react";

import _1f1e8_1f1ed from "@assets/1f1e8-1f1ed.png";

interface Solution {
  id: number;
  problemId: number;
  title: string;
  description: string;
  fullDescription?: string;
  author: string;
  isOfficial: boolean;
  tags?: string[];
  upvotes: number;
  downvotes: number;
  voteScore: number;
  userVoteType: string | null;
  isNew: boolean;
  isTrending: boolean;
  createdAt: string;
}

interface Problem {
  id: number;
  title: string;
  description: string;
  category: string;
  author: string;
  isOfficial: boolean;
  isAdminOnly: boolean;
  tags?: string[];
  upvotes: number;
  downvotes: number;
  voteScore: number;
  userVoteType: string | null;
  isNew: boolean;
  isTrending: boolean;
  createdAt: string;
  solutions: Solution[];
}

// Legacy interface for backward compatibility
interface Idea {
  id: string;
  title: string;
  description: string;
  author: string;
  upvotes: number;
  downvotes: number;
  tags: string[];
  category: string;
  createdAt: string;
}

export default function IdeasPage() {
  const [selectedCategory, setSelectedCategory] = useState("immigration");
  const [activeSubTab, setActiveSubTab] = useState("strategies");
  const [strategyVotes, setStrategyVotes] = useState<{[key: string]: number}>({
    "swiss-approach": 10
  });
  const [userVotes, setUserVotes] = useState<{[key: string]: 'up' | 'down' | null}>({
    "swiss-approach": null
  });
  const queryClient = useQueryClient();

  const { data: problems, isLoading } = useQuery({
    queryKey: ['/api/problems', selectedCategory],
    queryFn: () => fetch(`/api/problems/${selectedCategory}`).then(res => res.json()),
    enabled: !!selectedCategory,
  });

  const problemVoteMutation = useMutation({
    mutationFn: async ({ problemId, voteType }: { problemId: number; voteType: 'up' | 'down' }) => {
      const response = await fetch(`/api/problems/${problemId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType }),
      });
      if (!response.ok) throw new Error('Vote failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/problems', selectedCategory] });
    },
  });

  const solutionVoteMutation = useMutation({
    mutationFn: async ({ solutionId, voteType }: { solutionId: number; voteType: 'up' | 'down' }) => {
      const response = await fetch(`/api/solutions/${solutionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType }),
      });
      if (!response.ok) throw new Error('Vote failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/problems', selectedCategory] });
    },
  });

  const handleProblemVote = (problemId: number, voteType: 'up' | 'down') => {
    problemVoteMutation.mutate({ problemId, voteType });
  };

  const handleSolutionVote = (solutionId: number, voteType: 'up' | 'down') => {
    solutionVoteMutation.mutate({ solutionId, voteType });
  };

  const handleStrategyVote = (strategyKey: string, voteType: 'up' | 'down') => {
    const currentVote = userVotes[strategyKey];
    
    // If user already voted the same way, remove their vote
    if (currentVote === voteType) {
      setUserVotes(prev => ({ ...prev, [strategyKey]: null }));
      setStrategyVotes(prev => ({
        ...prev,
        [strategyKey]: (prev[strategyKey] || 0) + (voteType === 'up' ? -1 : 1)
      }));
      return;
    }
    
    // Calculate vote change
    let voteChange = 0;
    if (currentVote === null) {
      // First vote
      voteChange = voteType === 'up' ? 1 : -1;
    } else {
      // Switching vote (remove old, add new)
      voteChange = voteType === 'up' ? 2 : -2;
    }
    
    setUserVotes(prev => ({ ...prev, [strategyKey]: voteType }));
    setStrategyVotes(prev => ({
      ...prev,
      [strategyKey]: (prev[strategyKey] || 0) + voteChange
    }));
  };

  const issueCategories = [
    { id: "immigration", name: "Immigration", icon: "🌍", description: "Immigration policies, integration, border control, and refugee support systems." },
    { id: "housing", name: "Housing", icon: "🏠", description: "Housing affordability, rental market, social housing, and property development." },
    { id: "healthcare", name: "Healthcare", icon: "🏥", description: "Public health services, waiting lists, mental health, and healthcare accessibility." },
    { id: "economy", name: "Economy", icon: "💼", description: "Economic growth, employment, taxation, business development, and financial policies." },
    { id: "environment", name: "Environment", icon: "🌱", description: "Climate action, renewable energy, environmental protection, and sustainability." },
    { id: "cost-of-living", name: "Cost of Living", icon: "💰", description: "Inflation, energy costs, food prices, and everyday expenses affecting Irish families." }
  ];

  const SolutionCard: React.FC<{ solution: Solution }> = ({ solution }) => (
    <Card className="bg-gray-700 border-gray-600">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-md text-white">{solution.title}</CardTitle>
              <div className="flex gap-1">
                {solution.isOfficial && (
                  <Badge variant="secondary" className="text-xs bg-blue-900 text-blue-200">
                    AI-Generated
                  </Badge>
                )}
                {solution.isNew && (
                  <Badge variant="secondary" className="text-xs bg-green-900 text-green-200">
                    New
                  </Badge>
                )}
                {solution.isTrending && (
                  <Badge variant="secondary" className="text-xs bg-orange-900 text-orange-200">
                    <Flame className="w-3 h-3 mr-1" />
                    Trending
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-gray-300 text-sm mb-2">
              {solution.description}
            </CardDescription>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className="w-3 h-3" />
              <span>by {solution.author}</span>
              <span>•</span>
              <span>{new Date(solution.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center ml-4">
            <Button
              variant="ghost"
              size="sm"
              className={`p-2 ${solution.userVoteType === 'up' ? 'text-green-400 bg-green-900/20' : 'text-gray-400 hover:text-green-400'}`}
              onClick={() => handleSolutionVote(solution.id, 'up')}
              disabled={solutionVoteMutation.isPending}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <span className="text-sm font-bold text-white py-1">
              {solution.voteScore}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`p-2 ${solution.userVoteType === 'down' ? 'text-red-400 bg-red-900/20' : 'text-gray-400 hover:text-red-400'}`}
              onClick={() => handleSolutionVote(solution.id, 'down')}
              disabled={solutionVoteMutation.isPending}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );

  const ProblemCard: React.FC<{ problem: Problem; rank: number }> = ({ problem, rank }) => (
    <Card className="mb-6 bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {rank <= 3 && (
                <Badge variant="secondary" className={`text-xs ${rank === 1 ? 'bg-yellow-900 text-yellow-200' : rank === 2 ? 'bg-gray-700 text-gray-200' : 'bg-orange-900 text-orange-200'}`}>
                  #{rank}
                </Badge>
              )}
              <CardTitle className="text-lg text-white">{problem.title}</CardTitle>
              <div className="flex gap-1">
                
                {problem.isNew && (
                  <Badge variant="secondary" className="text-xs bg-green-900 text-green-200">
                    New
                  </Badge>
                )}
                {problem.isTrending && (
                  <Badge variant="secondary" className="text-xs bg-red-900 text-red-200">
                    <Flame className="w-3 h-3 mr-1" />
                    Top Issue
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-gray-300 text-sm mb-2">
              {problem.description}
            </CardDescription>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Users className="w-3 h-3" />
              <span>by {problem.author}</span>
              <span>•</span>
              <span>{new Date(problem.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span>•</span>
              <span>{problem.solutions.length} solution{problem.solutions.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center ml-4">
            <Button
              variant="ghost"
              size="sm"
              className={`p-2 ${problem.userVoteType === 'up' ? 'text-green-400 bg-green-900/20' : 'text-gray-400 hover:text-green-400'}`}
              onClick={() => handleProblemVote(problem.id, 'up')}
              disabled={problemVoteMutation.isPending}
            >
              <ChevronUp className="w-4 h-4" />
            </Button>
            <span className="text-lg font-bold text-white py-1">
              {problem.voteScore}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className={`p-2 ${problem.userVoteType === 'down' ? 'text-red-400 bg-red-900/20' : 'text-gray-400 hover:text-red-400'}`}
              onClick={() => handleProblemVote(problem.id, 'down')}
              disabled={problemVoteMutation.isPending}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {problem.solutions.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="solutions" className="border-0">
            <AccordionTrigger className="px-6 py-2 text-sm text-blue-400 hover:text-blue-300">
              Show Solutions ({problem.solutions.length})
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-4">
              <div className="space-y-3">
                {problem.solutions
                  .sort((a, b) => b.voteScore - a.voteScore)
                  .map((solution) => (
                    <SolutionCard key={solution.id} solution={solution} />
                  ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Lightbulb className="w-8 h-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">Ideas for Ireland</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Vote on Ireland's biggest problems and explore AI-generated solutions. Help prioritize issues and rank the most promising proposals.
        </p>
      </div>
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <div className="mb-8">
          <TabsList className="grid grid-cols-3 gap-2 w-full max-w-2xl mx-auto bg-transparent p-1 h-auto">
            {issueCategories.map((category) => (
              <TabsTrigger
                key={category.id}
                value={category.id}
                className="text-sm sm:text-base lg:text-lg px-3 py-3 sm:px-4 sm:py-4 data-[state=active]:bg-green-600 data-[state=active]:text-white bg-gray-800 text-gray-200 rounded-lg transition-all duration-200 hover:bg-gray-700 flex flex-col items-center justify-center gap-2 min-h-[70px] sm:min-h-[80px] border border-gray-700 font-medium"
              >
                <span className="text-lg sm:text-xl leading-none">{category.icon}</span>
                <span className="text-center leading-tight">{category.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {issueCategories.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-0">
            <Card className="mb-6 bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{category.icon}</span>
                  {category.name}
                </CardTitle>
                <CardDescription className="text-gray-300">
                  {category.description}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Sub-tabs for each category */}
            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-gray-800">
                <TabsTrigger 
                  value="strategies" 
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                >
                  Overall Strategies
                </TabsTrigger>
                <TabsTrigger 
                  value="issues" 
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white"
                >
                  Specific Issues
                </TabsTrigger>
              </TabsList>

              <TabsContent value="strategies" className="mt-0">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      Overall {category.name} Strategies
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      High-level policy approaches and strategic frameworks for addressing {category.name.toLowerCase()} challenges in Ireland.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {category.id === "immigration" ? (
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="swiss-approach" className="border-gray-600">
                            <div className="flex items-center justify-between w-full px-4 py-3 bg-gray-700 rounded-lg">
                              <AccordionTrigger className="flex-1 text-lg text-white hover:text-green-400 p-0 border-0">
                                <div className="flex items-center gap-2">
                                  <img src={_1f1e8_1f1ed} alt="Swiss Flag" className="w-6 h-6" />
                                  The Swiss Approach
                                </div>
                              </AccordionTrigger>
                              <div className="flex items-center gap-2 ml-4">
                                <div className="flex flex-col items-center">
                                  <button
                                    className={`p-1 transition-colors ${
                                      userVotes["swiss-approach"] === "up" 
                                        ? "text-green-400" 
                                        : "text-gray-400 hover:text-green-400"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStrategyVote("swiss-approach", "up");
                                    }}
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <span className="text-sm font-bold text-white">
                                    {strategyVotes["swiss-approach"] || 0}
                                  </span>
                                  <button
                                    className={`p-1 transition-colors ${
                                      userVotes["swiss-approach"] === "down" 
                                        ? "text-red-400" 
                                        : "text-gray-400 hover:text-red-400"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStrategyVote("swiss-approach", "down");
                                    }}
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <AccordionContent className="px-4 pb-4 bg-gray-700 rounded-b-lg border-t border-gray-600">
                              <div className="mt-4 space-y-4">
                                <p className="text-gray-300 text-sm font-medium mb-4">
                                  Controlled, selective, skill-based immigration system with strong local control, strict integration rules, and direct democratic oversight.
                                </p>
                                
                                <div className="grid gap-3">
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">🎯 Quota-Based System</h4>
                                    <p className="text-gray-300 text-sm">Immigration levels are regulated using quotas, especially for non-EU/EFTA countries.</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">🏆 Priority to Swiss & EU Workers</h4>
                                    <p className="text-gray-300 text-sm">Employers must first try to hire Swiss nationals or EU/EFTA citizens before recruiting from third countries.</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">⭐ Points-Based for Skilled Workers</h4>
                                    <p className="text-gray-300 text-sm">Third-country immigration is selective, favoring high-skilled professionals (e.g., doctors, engineers).</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">📚 Strict Integration Requirements</h4>
                                    <ul className="text-gray-300 text-sm space-y-1">
                                      <li>• Language proficiency (usually B1 oral, A2 written in national language)</li>
                                      <li>• Proof of integration into Swiss society (employment, no welfare, clean criminal record)</li>
                                      <li>• Municipal-level integration checks for residency/citizenship</li>
                                    </ul>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">🏛️ Decentralized Control</h4>
                                    <p className="text-gray-300 text-sm">Cantons have significant influence over integration support, permits, and enforcement.</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">💼 Work-Linked Residency</h4>
                                    <p className="text-gray-300 text-sm">Most residence permits are tied to a job; losing your job can jeopardize your legal status.</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">🏠 No Birthright Citizenship</h4>
                                    <p className="text-gray-300 text-sm">Citizenship is earned over time via naturalization (often 10+ years), not granted by being born in Switzerland.</p>
                                  </div>
                                  
                                  <div className="bg-gray-600 p-3 rounded-md">
                                    <h4 className="font-semibold text-white mb-2">🗳️ Popular Referenda on Immigration</h4>
                                    <p className="text-gray-300 text-sm">Swiss citizens regularly vote on immigration policy via direct democracy (e.g., 2014 "Stop Mass Immigration" initiative).</p>
                                  </div>
                                </div>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      ) : (
                        <>
                          <Card className="bg-gray-700 border-gray-600">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-white">Strategic Framework Development</CardTitle>
                              <CardDescription className="text-gray-300">
                                Comprehensive approach to developing long-term {category.name.toLowerCase()} policies that align with EU standards and Irish national interests.
                              </CardDescription>
                            </CardHeader>
                          </Card>
                          
                          <Card className="bg-gray-700 border-gray-600">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-white">Cross-Department Coordination</CardTitle>
                              <CardDescription className="text-gray-300">
                                Establish inter-departmental working groups to ensure cohesive {category.name.toLowerCase()} policy implementation across all government levels.
                              </CardDescription>
                            </CardHeader>
                          </Card>

                          <Card className="bg-gray-700 border-gray-600">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-white">Public Consultation Process</CardTitle>
                              <CardDescription className="text-gray-300">
                                Implement structured public consultation mechanisms to gather citizen input on {category.name.toLowerCase()} policy directions and priorities.
                              </CardDescription>
                            </CardHeader>
                          </Card>

                          <Card className="bg-gray-700 border-gray-600">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-lg text-white">Evidence-Based Policy Making</CardTitle>
                              <CardDescription className="text-gray-300">
                                Develop robust data collection and analysis systems to inform {category.name.toLowerCase()} policy decisions with real-world evidence.
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="issues" className="mt-0">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">🔺 Problems Leaderboard</h2>
                    <p className="text-sm text-gray-500 mt-1">Vote on problems to prioritize Ireland's biggest issues. Click "Show Solutions" to see and vote on proposed fixes.</p>
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card key={index} className="bg-gray-800 border-gray-700 animate-pulse">
                        <CardHeader>
                          <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
                          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                ) : problems && problems.length > 0 ? (
                  <div className="space-y-6">
                    {problems
                      .sort((a: any, b: any) => b.voteScore - a.voteScore)
                      .map((problem: any, index: number) => (
                        <ProblemCard key={problem.id} problem={problem} rank={index + 1} />
                      ))}
                  </div>
                ) : (
                  <Card className="bg-gray-800 border-gray-700 text-center py-12">
                    <CardContent>
                      <Lightbulb className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-300 mb-2">
                        No problems yet for {category.name}
                      </h3>
                      <p className="text-gray-500">
                        Our team is identifying key issues and AI-generated solutions for this category. Check back soon for problems to vote on.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}