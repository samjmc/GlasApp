import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { 
  Send, Bot, User, Sparkles, AlertCircle, MessageSquare, 
  Search, ChevronDown, TrendingUp, TrendingDown, Minus,
  BarChart3, Clock, AlertTriangle, CheckCircle, X, History,
  ThumbsUp, ThumbsDown
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

// Normalize string for comparison (remove accents, lowercase)
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/['']/g, "'") // Normalize apostrophes
    .trim();
}

// Calculate Levenshtein distance for fuzzy matching
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
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// Check if query matches start of any word
function matchesWordStart(text: string, query: string): boolean {
  const words = text.split(/\s+/);
  return words.some(word => word.startsWith(query));
}

// Calculate match score (higher = better match)
function calculateMatchScore(td: TDOption, query: string): number {
  const normalizedQuery = normalizeString(query);
  const normalizedName = normalizeString(td.politician_name);
  const normalizedParty = normalizeString(td.party || "");
  const normalizedConstituency = normalizeString(td.constituency || "");
  
  let score = 0;
  
  // Exact match bonuses
  if (normalizedName === normalizedQuery) return 1000;
  if (normalizedParty === normalizedQuery) return 800;
  if (normalizedConstituency === normalizedQuery) return 700;
  
  // Name matching (highest priority)
  if (normalizedName.startsWith(normalizedQuery)) {
    score += 500;
  } else if (matchesWordStart(normalizedName, normalizedQuery)) {
    score += 400; // Matches start of first or last name
  } else if (normalizedName.includes(normalizedQuery)) {
    score += 200;
  } else {
    // Fuzzy match on name
    const nameParts = normalizedName.split(/\s+/);
    for (const part of nameParts) {
      const distance = levenshteinDistance(part, normalizedQuery);
      if (distance <= 2 && normalizedQuery.length >= 3) {
        score += Math.max(0, 150 - distance * 50);
      }
    }
  }
  
  // Party matching
  if (normalizedParty.startsWith(normalizedQuery)) {
    score += 150;
  } else if (normalizedParty.includes(normalizedQuery)) {
    score += 100;
  }
  
  // Constituency matching
  if (normalizedConstituency.startsWith(normalizedQuery)) {
    score += 100;
  } else if (normalizedConstituency.includes(normalizedQuery)) {
    score += 50;
  }
  
  // Handle common abbreviations
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

// Local storage for recent searches
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch available TDs
  const { data: tdsData, isLoading: tdsLoading } = useQuery({
    queryKey: ["tds-for-chat"],
    queryFn: async () => {
      const res = await fetch("/api/parliamentary/scores/td-scores?limit=200");
      if (!res.ok) throw new Error("Failed to fetch TDs");
      const data = await res.json();
      return (data.scores || []) as TDOption[];
    },
  });

  // Fetch consistency data for selected TD
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

  // Smart search with ranking
  const searchResults = useMemo(() => {
    if (!tdsData) return [];
    
    // If no query, show recent searches first, then popular TDs
    if (!searchQuery.trim()) {
      const recentTDs = recentSearches
        .map(name => tdsData.find(td => td.politician_name === name))
        .filter((td): td is TDOption => td !== undefined);
      
      const otherTDs = tdsData
        .filter(td => !recentSearches.includes(td.politician_name))
        .slice(0, 50 - recentTDs.length);
      
      return [...recentTDs, ...otherTDs];
    }
    
    // Score and rank all TDs
    const scored = tdsData
      .map(td => ({ td, score: calculateMatchScore(td, searchQuery) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    
    return scored.map(item => item.td);
  }, [tdsData, searchQuery, recentSearches]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchResults]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && resultsContainerRef.current) {
      const items = resultsContainerRef.current.querySelectorAll('[data-td-item]');
      const item = items[highlightedIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  // Keyboard navigation
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

  // Chat mutation
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

  // Feedback mutation
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
    // Find the preceding user message for context
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
  }, [messages]);

  // Focus search on mount
  useEffect(() => {
    if (showSearch) {
      searchInputRef.current?.focus();
    }
  }, [showSearch]);

  // Highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const normalizedQuery = normalizeString(query);
    const normalizedText = normalizeString(text);
    const index = normalizedText.indexOf(normalizedQuery);
    
    if (index === -1) return text;
    
    // Find the actual position in the original text
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-500/20">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Ask a TD</h1>
                <p className="text-xs text-gray-400">AI-powered debate insights</p>
              </div>
            </div>
            
            {selectedTD && (
              <button
                onClick={clearSelection}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Change TD</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content with extra bottom padding for input bar + bottom nav */}
      <div className="mx-auto max-w-5xl px-4 pb-48 pt-4 md:pb-40">
        {/* Search & Select TD */}
        {showSearch && (
          <div className="mb-6">
            {/* Search Input */}
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search by name, party, or constituency... (try 'fg', 'dublin', 'harris')"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-gray-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Keyboard hints */}
            {searchQuery && searchResults.length > 0 && (
              <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Enter</kbd> select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Esc</kbd> clear
                </span>
              </div>
            )}

            {/* Recent searches label */}
            {!searchQuery && recentSearches.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
                <History className="h-3.5 w-3.5" />
                <span>Recent searches shown first</span>
              </div>
            )}

            {/* TD Grid */}
            {tdsLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : (
              <div 
                ref={resultsContainerRef}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-h-[60vh] overflow-y-auto pr-1"
              >
                {searchResults.map((td, index) => {
                  const style = getPartyStyle(td.party);
                  const isHighlighted = index === highlightedIndex;
                  const isRecent = recentSearches.includes(td.politician_name) && !searchQuery;
                  
                  return (
                    <button
                      key={td.id}
                      data-td-item
                      onClick={() => selectTD(td)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                        isHighlighted 
                          ? 'border-emerald-500/50 bg-emerald-500/20 shadow-lg shadow-emerald-500/10 scale-[1.02]' 
                          : 'border-white/5 bg-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10'
                      }`}
                    >
                      {isRecent && (
                        <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white">
                          <History className="h-3 w-3" />
                        </div>
                      )}
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
                          <p className="truncate text-[10px] text-gray-500">
                            {highlightMatch(td.constituency, searchQuery)}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {searchResults.length === 0 && searchQuery && !tdsLoading && (
              <div className="py-12 text-center">
                <div className="mb-2 text-gray-400">No TDs found matching "{searchQuery}"</div>
                <p className="text-sm text-gray-500">
                  Try searching by first name, last name, party (e.g., "fg", "sf"), or constituency
                </p>
              </div>
            )}
          </div>
        )}

        {/* Selected TD Header + Chat */}
        {selectedTD && !showSearch && (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Chat Area */}
            <div className="lg:col-span-2">
              {/* TD Info Card */}
              <div className={`mb-4 rounded-xl border ${partyStyle?.border} border-opacity-30 bg-gradient-to-r from-white/5 to-transparent p-4`}>
                <div className="flex items-center gap-4">
                  {selectedTD.image_url ? (
                    <img
                      src={selectedTD.image_url}
                      alt={selectedTD.politician_name}
                      className={`h-16 w-16 rounded-full object-cover ring-2 ${partyStyle?.border}`}
                    />
                  ) : (
                    <div className={`h-16 w-16 rounded-full ${partyStyle?.bg} flex items-center justify-center text-white font-bold text-2xl`}>
                      {selectedTD.politician_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedTD.politician_name}</h2>
                    <p className={`text-sm ${partyStyle?.text}`}>{selectedTD.party}</p>
                    <p className="text-xs text-gray-400">{selectedTD.constituency}</p>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-4 mb-4">
                {messages.map((message, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
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
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-emerald-500 text-white"
                          : "border border-white/10 bg-slate-800/50 text-gray-100"
                      }`}
                    >
                      <div className="text-sm">
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                            <ReactMarkdown 
                              components={{
                                a: ({node, ...props}) => <a {...props} className="text-emerald-400 hover:underline" target="_blank" rel="noopener noreferrer" />,
                                strong: ({node, ...props}) => <strong {...props} className="font-bold text-white" />,
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                      
                      {message.citations && message.citations.length > 0 && (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <p className="mb-2 text-xs font-medium text-gray-400">📚 Sources:</p>
                          <div className="space-y-2">
                            {message.citations.map((citation, cidx) => (
                              <div key={cidx} className="rounded-lg bg-white/5 p-2 text-xs text-gray-300">
                                <span className="font-medium text-emerald-400">[{citation.date}]</span>{" "}
                                {citation.content}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback Buttons (Assistant only) */}
                      {message.role === "assistant" && idx > 0 && (
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleFeedback(idx, 'positive')}
                            disabled={!!message.feedback}
                            className={`rounded p-1 transition-colors ${
                              message.feedback === 'positive' 
                                ? 'text-emerald-400' 
                                : message.feedback 
                                  ? 'text-gray-600 cursor-not-allowed' 
                                  : 'text-gray-400 hover:bg-white/10 hover:text-emerald-400'
                            }`}
                            title="Good answer"
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
                                  : 'text-gray-400 hover:bg-white/10 hover:text-red-400'
                            }`}
                            title="Inaccurate or hallucinated"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {chatMutation.isPending && (
                  <div className="flex gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${partyStyle?.bg || "bg-cyan-600"}`}>
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-800/50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 animate-bounce rounded-full bg-emerald-400" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Sample Questions */}
              {messages.length <= 1 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs text-gray-500">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => setInput(q)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Consistency Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 space-y-4">
                {/* Overall Score */}
                <div className="rounded-xl border border-white/10 bg-slate-800/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">Consistency Score</h3>
                  </div>
                  
                  {consistencyLoading ? (
                    <div className="h-20 animate-pulse rounded-lg bg-white/5" />
                  ) : consistencyData?.overallConsistencyScore !== null ? (
                    <div className="text-center">
                      <div className={`text-4xl font-bold ${
                        (consistencyData?.overallConsistencyScore || 0) >= 90 ? 'text-emerald-400' :
                        (consistencyData?.overallConsistencyScore || 0) >= 75 ? 'text-green-400' :
                        (consistencyData?.overallConsistencyScore || 0) >= 60 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {consistencyData?.overallConsistencyScore}%
                      </div>
                      <div className={`mt-1 text-sm font-medium ${
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
                      <p className="mt-1 text-xs text-gray-400">across tracked topics</p>
                    </div>
                  ) : (
                    <p className="text-center text-sm text-gray-500">
                      No stance data yet
                    </p>
                  )}
                </div>

                {/* Topic Breakdown */}
                {consistencyData?.topicScores && consistencyData.topicScores.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-white">By Topic</h3>
                    <div className="space-y-3">
                      {consistencyData.topicScores.slice(0, 6).map((topic, idx) => (
                        <div key={idx}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="capitalize text-gray-300">{topic.topic.replace('_', ' ')}</span>
                            <span className={`font-medium ${
                              topic.consistency_score >= 0.8 ? 'text-emerald-400' :
                              topic.consistency_score >= 0.6 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {Math.round(topic.consistency_score * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                topic.consistency_score >= 0.8 ? 'bg-emerald-500' :
                                topic.consistency_score >= 0.6 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${topic.consistency_score * 100}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-gray-500">
                            {topic.total_statements} statements, {topic.position_changes} changes
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Position Changes */}
                {consistencyData?.recentPositionChanges && consistencyData.recentPositionChanges.length > 0 && (
                  <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                      <h3 className="text-sm font-semibold text-yellow-400">Position Changes</h3>
                    </div>
                    <div className="space-y-3">
                      {consistencyData.recentPositionChanges.slice(0, 3).map((change, idx) => (
                        <div key={idx} className="rounded-lg bg-white/5 p-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="capitalize font-medium text-white">{change.topic.replace('_', ' ')}</span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-400">
                              {new Date(change.statement_date).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs">
                            <span className="text-red-400">{change.previous_stance}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-emerald-400">{change.stance}</span>
                          </div>
                          <p className="mt-1 text-[10px] text-gray-400 line-clamp-2">
                            {change.stance_summary}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Data State */}
                {!consistencyLoading && (!consistencyData?.topicScores || consistencyData.topicScores.length === 0) && (
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-4 text-center">
                    <Clock className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                    <p className="text-sm text-gray-400">Stance analysis pending</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Chat to explore their debate record
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Input Area - positioned above bottom nav on mobile */}
      {selectedTD && !showSearch && (
        <div 
          className="fixed inset-x-0 z-50 border-t border-white/10 bg-slate-950/95 backdrop-blur-xl"
          style={{ 
            bottom: 'calc(56px + env(safe-area-inset-bottom, 0px))', // Height of bottom nav + safe area
          }}
        >
          <div className="mx-auto max-w-5xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Ask ${selectedTD.politician_name} a question...`}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                  disabled={chatMutation.isPending}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || chatMutation.isPending}
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 disabled:opacity-50 disabled:shadow-none"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
              <AlertCircle className="h-3 w-3" />
              <span>AI-generated from public debate records • Not official statements</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
