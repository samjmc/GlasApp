import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { 
  Send, Bot, User, Sparkles, AlertCircle, MessageSquare, 
  Search, ChevronDown, TrendingUp, TrendingDown, Minus,
  BarChart3, Clock, AlertTriangle, CheckCircle, X, History,
  ThumbsUp, ThumbsDown, ArrowLeft, Info
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{ date: string; content: string }>;
  feedback?: 'positive' | 'negative';
}

interface ChatResponse {
  success: boolean;
  reply: string;
  citations?: Array<{ date: string; content: string }>;
  disclaimer?: string;
}

interface TDOption {
  id: number;
  politician_name: string;
  party: string;
  constituency: string;
  image_url: string | null;
}

interface ConsistencyData {
  success: boolean;
  politician: string;
  overallConsistencyScore: number | null;
  topicScores: Array<{
    topic: string;
    consistency_score: number;
    total_statements: number;
    position_changes: number;
  }>;
  recentPositionChanges: Array<{
    topic: string;
    stance: string;
    previous_stance: string;
    stance_summary: string;
    statement_date: string;
  }>;
}

const SAMPLE_QUESTIONS = [
  "What's your stance on housing?",
  "Have you changed your mind on anything?",
  "Show me contradictions in your record",
  "What do you think about healthcare funding?",
  "Timeline of your stance on climate",
];

// Party colors
const PARTY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Fine Gael": { bg: "bg-blue-500", text: "text-blue-500", border: "border-blue-500" },
  "Fianna Fáil": { bg: "bg-green-600", text: "text-green-600", border: "border-green-600" },
  "Sinn Féin": { bg: "bg-emerald-700", text: "text-emerald-700", border: "border-emerald-700" },
  "Labour Party": { bg: "bg-red-500", text: "text-red-500", border: "border-red-500" },
  "Green Party": { bg: "bg-green-500", text: "text-green-500", border: "border-green-500" },
  "Social Democrats": { bg: "bg-purple-500", text: "text-purple-500", border: "border-purple-500" },
  "People Before Profit": { bg: "bg-red-700", text: "text-red-700", border: "border-red-700" },
  "Aontú": { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-600" },
  "Independent": { bg: "bg-gray-500", text: "text-gray-500", border: "border-gray-500" },
};

const getPartyStyle = (party: string) => {
  return PARTY_COLORS[party] || PARTY_COLORS["Independent"];
};

// ============== SEARCH UTILITIES ==============

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "'")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function matchesWordStart(text: string, query: string): boolean {
  const words = text.split(/\s+/);
  return words.some(word => word.startsWith(query));
}

function calculateMatchScore(td: TDOption, query: string): number {
  const normalizedQuery = normalizeString(query);
  const normalizedName = normalizeString(td.politician_name);
  const normalizedParty = normalizeString(td.party || "");
  const normalizedConstituency = normalizeString(td.constituency || "");
  
  let score = 0;
  
  if (normalizedName === normalizedQuery) return 1000;
  if (normalizedParty === normalizedQuery) return 800;
  if (normalizedConstituency === normalizedQuery) return 700;
  
  if (normalizedName.startsWith(normalizedQuery)) {
    score += 500;
  } else if (matchesWordStart(normalizedName, normalizedQuery)) {
    score += 400;
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 200;
  } else {
    const nameParts = normalizedName.split(/\s+/);
    for (const part of nameParts) {
      const distance = levenshteinDistance(part, normalizedQuery);
      if (distance <= 2 && normalizedQuery.length >= 3) {
        score += Math.max(0, 150 - distance * 50);
      }
    }
  }
  
  if (normalizedParty.startsWith(normalizedQuery)) {
    score += 150;
  } else if (normalizedParty.includes(normalizedQuery)) {
    score += 100;
  }
  
  if (normalizedConstituency.startsWith(normalizedQuery)) {
    score += 100;
  } else if (normalizedConstituency.includes(normalizedQuery)) {
    score += 50;
  }
  
  const abbreviations: Record<string, string[]> = {
    "fg": ["fine gael"],
    "ff": ["fianna fail", "fianna fáil"],
    "sf": ["sinn fein", "sinn féin"],
    "sd": ["social democrats"],
    "gp": ["green party"],
    "pbp": ["people before profit"],
    "lab": ["labour", "labour party"],
  };
  
  for (const [abbrev, fullNames] of Object.entries(abbreviations)) {
    if (normalizedQuery === abbrev) {
      if (fullNames.some(fn => normalizedParty.includes(fn))) {
        score += 300;
      }
    }
  }
  
  return score;
}

const RECENT_SEARCHES_KEY = "ask-td-recent-searches";
const MAX_RECENT_SEARCHES = 5;

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(tdName: string): void {
  try {
    const recent = getRecentSearches().filter(name => name !== tdName);
    recent.unshift(tdName);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENT_SEARCHES))
    );
  } catch {
    // Ignore storage errors
  }
}

// ============== COMPONENT ==============

export default function AskTDPage() {
  const [selectedTD, setSelectedTD] = useState<TDOption | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'consistency'>('chat');
  const [showInfoModal, setShowInfoModal] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const { data: tdsData, isLoading: tdsLoading } = useQuery({
    queryKey: ["tds-for-chat"],
    queryFn: async () => {
      const res = await fetch("/api/parliamentary/scores/td-scores?limit=200");
      if (!res.ok) throw new Error("Failed to fetch TDs");
      const data = await res.json();
      return (data.scores || []) as TDOption[];
    },
  });

  const { data: consistencyData, isLoading: consistencyLoading } = useQuery({
    queryKey: ["td-consistency", selectedTD?.politician_name],
    queryFn: async () => {
      if (!selectedTD) return null;
      const res = await fetch(`/api/chat/politician/${encodeURIComponent(selectedTD.politician_name)}/consistency`);
      if (!res.ok) return null;
      return res.json() as Promise<ConsistencyData>;
    },
    enabled: !!selectedTD,
  });

  const searchResults = useMemo(() => {
    if (!tdsData) return [];
    
    if (!searchQuery.trim()) {
      const recentTDs = recentSearches
        .map(name => tdsData.find(td => td.politician_name === name))
        .filter((td): td is TDOption => td !== undefined);
      
      const otherTDs = tdsData
        .filter(td => !recentSearches.includes(td.politician_name))
        .slice(0, 50 - recentTDs.length);
      
      return [...recentTDs, ...otherTDs];
    }
    
    const scored = tdsData
      .map(td => ({ td, score: calculateMatchScore(td, searchQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    
    return scored.map(item => item.td);
  }, [tdsData, searchQuery, recentSearches]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  useEffect(() => {
    if (highlightedIndex >= 0 && resultsContainerRef.current) {
      const items = resultsContainerRef.current.querySelectorAll('[data-td-item]');
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    const maxIndex = searchResults.length - 1;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
          selectTD(searchResults[highlightedIndex]);
        } else if (searchResults.length === 1) {
          selectTD(searchResults[0]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setSearchQuery("");
        searchInputRef.current?.blur();
        break;
      case 'Tab':
        if (searchResults.length > 0 && highlightedIndex === -1) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;
    }
  }, [searchResults, highlightedIndex]);

  const chatMutation = useMutation({
    mutationFn: async (question: string): Promise<ChatResponse> => {
      if (!selectedTD) throw new Error("No TD selected");
      
      const res = await fetch("/api/chat/politician", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianName: selectedTD.politician_name,
          question,
          history: messages.slice(-6),
        }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Chat failed");
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, citations: data.citations },
      ]);
    },
    onError: (error: Error) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I encountered an error: ${error.message}` },
      ]);
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async (data: { 
      messageIndex: number;
      rating: 'positive' | 'negative';
      userQuestion: string;
      aiResponse: string;
    }) => {
      if (!selectedTD) throw new Error("No TD selected");
      
      const res = await fetch("/api/chat/politician/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          politicianName: selectedTD.politician_name,
          userQuestion: data.userQuestion,
          aiResponse: data.aiResponse,
          rating: data.rating,
          contextData: { messageIndex: data.messageIndex }
        }),
      });
      
      if (!res.ok) throw new Error("Feedback failed");
      return data;
    },
    onSuccess: (data) => {
      setMessages(prev => prev.map((msg, i) => 
        i === data.messageIndex ? { ...msg, feedback: data.rating } : msg
      ));
    }
  });

  const handleFeedback = (index: number, rating: 'positive' | 'negative') => {
    const message = messages[index];
    const userMessage = messages[index - 1];
    
    if (message.role !== 'assistant' || !userMessage || message.feedback) return;
    
    feedbackMutation.mutate({
      messageIndex: index,
      rating,
      userQuestion: userMessage.content,
      aiResponse: message.content
    });
  };

  const handleSend = () => {
    if (!input.trim() || !selectedTD || chatMutation.isPending) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    chatMutation.mutate(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectTD = (td: TDOption) => {
    setSelectedTD(td);
    setShowSearch(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
    addRecentSearch(td.politician_name);
    setRecentSearches(getRecentSearches());
    setActiveTab('chat');
    setMessages([{
      role: "assistant",
      content: `Hello! I'm an AI representation of **${td.politician_name}** (${td.party}), based on my parliamentary debate records.\n\nAsk me about my positions on any policy issue. You can also ask:\n• "Have you changed your mind on anything?"\n• "Show me contradictions"\n• "Timeline of your stance on [topic]"\n\n⚠️ **Disclaimer:** My responses are AI-generated interpretations of public debate transcripts. They are not official statements.`,
    }]);
  };

  const clearSelection = () => {
    setSelectedTD(null);
    setMessages([]);
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeTab]);

  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const normalizedQuery = normalizeString(query);
    const normalizedText = normalizeString(text);
    const index = normalizedText.indexOf(normalizedQuery);
    
    if (index === -1) return text;
    
    let actualIndex = 0;
    let normalizedIndex = 0;
    while (normalizedIndex < index && actualIndex < text.length) {
      const char = text[actualIndex];
      const normalizedChar = normalizeString(char);
      if (normalizedChar.length > 0) {
        normalizedIndex += normalizedChar.length;
      }
      actualIndex++;
    }
    
    const before = text.slice(0, actualIndex);
    const match = text.slice(actualIndex, actualIndex + query.length);
    const after = text.slice(actualIndex + query.length);
    
    return (
      <>
        {before}
        <span className="bg-emerald-500/30 text-emerald-300">{match}</span>
        {after}
      </>
    );
  };

  const partyStyle = selectedTD ? getPartyStyle(selectedTD.party) : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-900/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedTD && (
                <button 
                  onClick={clearSelection}
                  className="mr-1 rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/20">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Ask a TD</h1>
                <p className="text-xs text-gray-400">AI-powered insights</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedTD && (
                <button
                  onClick={clearSelection}
                  className="hidden sm:flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </button>
              )}
              <button
                onClick={() => setShowInfoModal(true)}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="About this tool"
              >
                <Info className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-5xl px-4 pb-48 pt-6 md:pb-40">
        
        {/* VIEW 1: SEARCH / SELECT */}
        {showSearch && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Search Input */}
            <div className="relative mx-auto mb-8 max-w-2xl">
              <div className="relative group">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 opacity-30 blur transition duration-500 group-hover:opacity-50"></div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search by name, party, or constituency..."
                    className="w-full rounded-xl border border-white/10 bg-slate-900 py-4 pl-12 pr-12 text-sm text-white placeholder-gray-500 shadow-2xl outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              
              {/* Keyboard hints */}
              {searchQuery && searchResults.length > 0 && (
                <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono border border-white/10">↑↓</kbd> navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono border border-white/10">Enter</kbd> select
                  </span>
                </div>
              )}
            </div>

            {/* Results */}
            {tdsLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {!searchQuery && recentSearches.length > 0 && (
                  <div className="mb-6">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-400">
                      <History className="h-4 w-4" />
                      <span>Recent Searches</span>
                    </div>
                    {/* Filter results to show only recent */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                      {searchResults
                        .filter(td => recentSearches.includes(td.politician_name))
                        .map((td, index) => {
                          const style = getPartyStyle(td.party);
                          return (
                            <button
                              key={td.id}
                              onClick={() => selectTD(td)}
                              className="group relative flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4 text-center transition-all hover:border-emerald-500/30 hover:bg-white/10 hover:shadow-lg hover:shadow-emerald-900/20"
                            >
                              {td.image_url ? (
                                <img
                                  src={td.image_url}
                                  alt={td.politician_name}
                                  className="h-16 w-16 rounded-full object-cover ring-2 ring-white/10 transition-all group-hover:ring-emerald-500/50"
                                />
                              ) : (
                                <div className={`h-16 w-16 rounded-full ${style.bg} ring-2 ring-white/10 flex items-center justify-center text-white font-bold text-xl`}>
                                  {td.politician_name.charAt(0)}
                                </div>
                              )}
                              <div className="w-full">
                                <p className="truncate font-medium text-white group-hover:text-emerald-400 transition-colors">
                                  {td.politician_name}
                                </p>
                                <p className={`truncate text-xs ${style.text} opacity-80`}>
                                  {td.party}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div>
                  {!searchQuery && recentSearches.length > 0 && (
                    <div className="mb-3 text-sm font-medium text-gray-400">All TDs</div>
                  )}
                  <div 
                    ref={resultsContainerRef}
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  >
                    {searchResults
                      .filter(td => searchQuery || !recentSearches.includes(td.politician_name))
                      .map((td, index) => {
                        const style = getPartyStyle(td.party);
                        const isHighlighted = index === highlightedIndex;
                        
                        return (
                          <button
                            key={td.id}
                            data-td-item
                            onClick={() => selectTD(td)}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-4 text-center transition-all ${
                              isHighlighted 
                                ? 'border-emerald-500/50 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 scale-[1.02] z-10' 
                                : 'border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10'
                            }`}
                          >
                            {td.image_url ? (
                              <img
                                src={td.image_url}
                                alt={td.politician_name}
                                className={`h-14 w-14 rounded-full object-cover ring-2 transition-all ${
                                  isHighlighted ? 'ring-emerald-500' : 'ring-white/10 group-hover:ring-emerald-500/30'
                                }`}
                              />
                            ) : (
                              <div className={`h-14 w-14 rounded-full ${style.bg} ring-2 ring-white/10 flex items-center justify-center text-white font-bold text-lg`}>
                                {td.politician_name.charAt(0)}
                              </div>
                            )}
                            <div className="w-full">
                              <p className="truncate text-sm font-medium text-white">
                                {searchQuery ? highlightMatch(td.politician_name, searchQuery) : td.politician_name}
                              </p>
                              <p className={`truncate text-xs ${style.text}`}>
                                {searchQuery ? highlightMatch(td.party, searchQuery) : td.party}
                              </p>
                              {searchQuery && td.constituency && (
                                <p className="truncate text-[10px] text-gray-500 mt-0.5">
                                  {highlightMatch(td.constituency, searchQuery)}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
            
            {searchResults.length === 0 && searchQuery && !tdsLoading && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 py-12 text-center">
                <div className="mb-2 text-lg text-gray-400">No results found</div>
                <p className="text-sm text-gray-500">
                  We couldn't find a TD matching "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: SELECTED TD */}
        {selectedTD && !showSearch && (
          <div className="animate-in fade-in duration-300">
            {/* TD Profile Header */}
            <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {selectedTD.image_url ? (
                  <img
                    src={selectedTD.image_url}
                    alt={selectedTD.politician_name}
                    className={`h-20 w-20 rounded-full object-cover ring-4 ${partyStyle?.border || 'ring-gray-700'}`}
                  />
                ) : (
                  <div className={`h-20 w-20 rounded-full ${partyStyle?.bg} ring-4 ring-white/10 flex items-center justify-center text-white font-bold text-3xl`}>
                    {selectedTD.politician_name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedTD.politician_name}</h2>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`font-medium ${partyStyle?.text}`}>{selectedTD.party}</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-gray-400">{selectedTD.constituency}</span>
                  </div>
                </div>
              </div>
              
              {/* Consistency Badge (Mini) */}
              {consistencyData?.overallConsistencyScore !== null && consistencyData?.overallConsistencyScore !== undefined && (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">Consistency</div>
                    <div className={`font-bold ${
                      (consistencyData.overallConsistencyScore || 0) >= 80 ? 'text-emerald-400' : 
                      (consistencyData.overallConsistencyScore || 0) >= 60 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {consistencyData.overallConsistencyScore}%
                    </div>
                  </div>
                  <div className={`h-10 w-1 rounded-full ${
                    (consistencyData.overallConsistencyScore || 0) >= 80 ? 'bg-emerald-500' : 
                    (consistencyData.overallConsistencyScore || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-white/10">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'chat'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => setActiveTab('consistency')}
                  className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'consistency'
                      ? 'border-emerald-500 text-emerald-400'
                      : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
                  }`}
                >
                  Consistency & Insights
                </button>
              </div>
            </div>

            {/* TAB CONTENT: CHAT */}
            {activeTab === 'chat' && (
              <div className="space-y-4">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-lg ${
                        message.role === "user"
                          ? "bg-emerald-500"
                          : partyStyle?.bg || "bg-cyan-600"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
                        message.role === "user"
                          ? "bg-emerald-600 text-white rounded-tr-sm"
                          : "border border-white/10 bg-slate-800 text-gray-100 rounded-tl-sm"
                      }`}
                    >
                      <div className="text-sm leading-relaxed">
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-3 [&>p:last-child]:mb-0 [&>ul]:mb-3 [&>ol]:mb-3">
                            <ReactMarkdown 
                              components={{
                                a: ({node, ...props}) => <a {...props} className="text-emerald-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer" />,
                                strong: ({node, ...props}) => <strong {...props} className="font-bold text-white" />,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-4 border-t border-white/10 pt-3">
                          <p className="mb-2 text-xs font-medium text-gray-400 flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Sources
                          </p>
                          <div className="grid gap-2">
                            {message.citations.map((citation, cidx) => (
                              <div key={cidx} className="rounded-lg bg-black/20 p-2.5 text-xs text-gray-300 border border-white/5">
                                <span className="font-medium text-emerald-400 mr-1.5">[{citation.date}]</span>
                                {citation.content}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback Buttons */}
                      {message.role === "assistant" && idx > 0 && (
                        <div className="mt-3 flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100">
                          <button
                            onClick={() => handleFeedback(idx, 'positive')}
                            disabled={!!message.feedback}
                            className={`rounded p-1 transition-colors ${
                              message.feedback === 'positive' 
                                ? 'text-emerald-400' 
                                : message.feedback 
                                  ? 'text-gray-600 cursor-not-allowed' 
                                  : 'text-gray-500 hover:bg-white/5 hover:text-emerald-400'
                            }`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleFeedback(idx, 'negative')}
                            disabled={!!message.feedback}
                            className={`rounded p-1 transition-colors ${
                              message.feedback === 'negative' 
                                ? 'text-red-400' 
                                : message.feedback 
                                  ? 'text-gray-600 cursor-not-allowed' 
                                  : 'text-gray-500 hover:bg-white/5 hover:text-red-400'
                            }`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex gap-4">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${partyStyle?.bg || "bg-cyan-600"}`}>
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm border border-white/10 bg-slate-800 px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} className="h-4" />

                {/* Sample Questions (only if chat is empty) */}
                {messages.length <= 1 && (
                  <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
                    <p className="mb-4 text-sm font-medium text-gray-400">Suggested questions for {selectedTD.politician_name}:</p>
                    <div className="flex flex-wrap gap-2">
                      {SAMPLE_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInput(q)}
                          className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-300 transition-all hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: CONSISTENCY */}
            {activeTab === 'consistency' && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Overall Score Card */}
                  <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
                        <BarChart3 className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Consistency Score</h3>
                    </div>
                    
                    {consistencyLoading ? (
                      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
                    ) : consistencyData?.overallConsistencyScore !== null ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-5xl font-bold ${
                            (consistencyData?.overallConsistencyScore || 0) >= 90 ? 'text-emerald-400' :
                            (consistencyData?.overallConsistencyScore || 0) >= 75 ? 'text-green-400' :
                            (consistencyData?.overallConsistencyScore || 0) >= 60 ? 'text-yellow-400' :
                            'text-red-400'
                          }`}>
                            {consistencyData?.overallConsistencyScore}%
                          </span>
                          <span className="text-gray-400">/ 100</span>
                        </div>
                        <div className={`mt-2 text-lg font-medium ${
                          (consistencyData?.overallConsistencyScore || 0) >= 90 ? 'text-emerald-400' :
                          (consistencyData?.overallConsistencyScore || 0) >= 75 ? 'text-green-400' :
                          (consistencyData?.overallConsistencyScore || 0) >= 60 ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          {(consistencyData?.overallConsistencyScore || 0) >= 90 ? 'Rock Solid' :
                           (consistencyData?.overallConsistencyScore || 0) >= 75 ? 'Highly Consistent' :
                           (consistencyData?.overallConsistencyScore || 0) >= 60 ? 'Pragmatic / Evolving' :
                           'Volatile / Unclear'}
                        </div>
                        <p className="mt-2 text-sm text-gray-400">
                          Based on analysis of stance consistency across tracked topics over time.
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500">Not enough data to calculate score.</p>
                    )}
                  </div>

                  {/* Position Changes Card */}
                  <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="rounded-lg bg-yellow-500/10 p-2 text-yellow-400">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Recent Shifts</h3>
                    </div>

                    {consistencyData?.recentPositionChanges && consistencyData.recentPositionChanges.length > 0 ? (
                      <div className="space-y-4">
                        {consistencyData.recentPositionChanges.slice(0, 3).map((change, idx) => (
                          <div key={idx} className="relative rounded-xl border border-white/5 bg-black/20 p-3 pl-4">
                            <div className="absolute left-0 top-3 h-8 w-1 rounded-r bg-yellow-500/50" />
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {change.topic.replace('_', ' ')}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(change.statement_date).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="text-red-400/80">{change.previous_stance}</span>
                              <ArrowLeft className="h-3 w-3 rotate-180 text-gray-600" />
                              <span className="text-emerald-400">{change.stance}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
                        <CheckCircle className="mb-2 h-8 w-8 opacity-20" />
                        <p>No major position changes detected recently.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Breakdown */}
                {consistencyData?.topicScores && consistencyData.topicScores.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-slate-800/50 p-6">
                    <h3 className="mb-6 text-lg font-bold text-white">Topic Consistency Breakdown</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {consistencyData.topicScores.map((topic, idx) => (
                        <div key={idx} className="rounded-xl border border-white/5 bg-black/20 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="font-medium capitalize text-gray-200">{topic.topic.replace('_', ' ')}</span>
                            <span className={`text-sm font-bold ${
                              topic.consistency_score >= 0.8 ? 'text-emerald-400' :
                              topic.consistency_score >= 0.6 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {Math.round(topic.consistency_score * 100)}%
                            </span>
                          </div>
                          
                          <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div 
                              className={`h-full rounded-full ${
                                topic.consistency_score >= 0.8 ? 'bg-emerald-500' :
                                topic.consistency_score >= 0.6 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${topic.consistency_score * 100}%` }}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{topic.total_statements} statements</span>
                            <span>{topic.position_changes} changes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Chat Input (Only visible when TD selected and on Chat tab) */}
      {selectedTD && !showSearch && activeTab === 'chat' && (
        <div 
          className="fixed inset-x-0 z-50 border-t border-white/10 bg-gray-900/95 backdrop-blur-xl"
          style={{ 
            bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-1 transition-all focus-within:border-emerald-500/50 focus-within:ring-1 focus-within:ring-emerald-500/20">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Ask ${selectedTD.politician_name} a question...`}
                  className="max-h-32 w-full resize-none bg-transparent px-4 py-3 text-sm text-white placeholder-gray-500 outline-none"
                  rows={1}
                  disabled={chatMutation.isPending}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50 disabled:shadow-none"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-2 flex justify-center text-[10px] text-gray-500">
              AI can make mistakes. Check official records.
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                About Ask a TD
              </h3>
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-sm text-gray-300">
              <p>
                This tool allows you to query the parliamentary record of any TD. The AI responses are grounded in actual Dáil debate transcripts, allowing you to explore their stances, consistency, and policy positions quickly.
              </p>
              
              <div className="rounded-xl bg-white/5 p-4">
                <h4 className="mb-2 font-medium text-white flex items-center gap-2">
                  <Bot className="h-4 w-4 text-emerald-400" />
                  How it works
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-gray-400">
                  <li>Search for any TD to start a session</li>
                  <li>Ask about their stance on specific bills or topics</li>
                  <li>Check their consistency score based on past statements</li>
                  <li>View citations linking back to debate dates</li>
                </ul>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-yellow-200/80">
                <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                <p>
                  Responses are AI-generated interpretations of public records. They are not official statements from the politicians. Always verify with official sources.
                </p>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowInfoModal(false)}
                className="rounded-xl bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}