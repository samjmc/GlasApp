/**
 * News Article Card Component
 * Instagram-style card for news articles with AI summary and comments
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { PolicyVoting } from './PolicyVoting';
import { PolicyVotePrompt, type PolicyVoteData } from './PolicyVotePrompt';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThumbsUp, 
  MessageCircle, 
  Share2, 
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronDown,
  Info,
  ChevronUp,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';

interface Comment {
  id: number;
  author: string;
  avatar: string;
  content: string;
  likes: number;
  timestamp: string;
}

interface PolicyFacts {
  action: string;
  who_affected?: string;
  amount?: string;
  timeline?: string;
  estimated_people?: number;
  stated_reason?: string;
}

interface Perspectives {
  supporters_say: string;
  critics_say: string;
  expert_view?: string;
}

interface AffectedTD {
  name: string;
  impactScore: number;
  transparencyScore?: number;
  integrityScore?: number;
  effectivenessScore?: number;
  consistencyScore?: number;
  transparencyReasoning?: string;
  integrityReasoning?: string;
  effectivenessReasoning?: string;
  consistencyReasoning?: string;
  aiReasoning?: string;
  isOppositionAdvocacy?: boolean;
  flipFlopDetected?: string;
  flipFlopExplanation?: string;
  suspiciousTiming?: boolean;
  needsReview?: boolean;
  eloChange?: number;
  storyType?: string;
  sentiment?: string;
  // Policy stance (for personal rankings)
  tdStance?: string; // 'support' | 'oppose' | 'neutral'
  tdStanceStrength?: number; // 1-5
  tdStanceEvidence?: string; // Quote showing their position
}

interface NewsArticle {
  id: number;
  title: string;
  source: string;
  sourceLogoUrl?: string;
  publishedDate: string;
  imageUrl?: string;
  aiSummary: string;
  url: string;
  
  // TD Impact (backward compatibility - primary TD)
  politicianName?: string;
  impactScore?: number;
  storyType?: string;
  sentiment?: string;
  aiReasoning?: string;
  
  // Process Scores (0-100) - for primary TD
  transparencyScore?: number;
  integrityScore?: number;
  effectivenessScore?: number;
  consistencyScore?: number;
  
  // NEW: Multiple TDs affected by this article
  affectedTDs?: AffectedTD[];
  
  // Policy Voting
  isIdeologicalPolicy?: boolean;
  policyDirection?: 'progressive' | 'conservative' | 'centrist' | 'technical';
  policyFacts?: PolicyFacts;
  perspectives?: Perspectives;
  isOppositionAdvocacy?: boolean;
  hasPolicyOpportunity?: boolean;
  policyVote?: PolicyVoteData | null;
  
  // Engagement
  likes: number;
  commentCount: number;
  comments: Comment[];
}

const PROCESS_SCORE_UNAVAILABLE_TEXT = 'Not enough information to assess from this article.';

const isProcessScoreAvailable = (score: number | null | undefined): score is number =>
  typeof score === 'number' && Number.isFinite(score);

const getConsistencyColorClass = (score: number | null | undefined): string => {
  if (!isProcessScoreAvailable(score)) return 'text-gray-400';
  if (score === 0) return 'text-red-500';
  if (score < 30) return 'text-red-400';
  if (score < 60) return 'text-orange-400';
  return 'text-amber-400';
};

// Format date to relative time (e.g., "2 hours ago")
function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    // For older articles, show the actual date
    return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return 'Recently';
  }
}

export function NewsArticleCard({ article }: { article: NewsArticle }) {
  const [liked, setLiked] = useState(false);
  const [localComments] = useState(article.comments || []);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [showPolicyVote, setShowPolicyVote] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    // In production: POST to /api/articles/:id/like
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.aiSummary,
        url: window.location.origin + `/news/${article.id}`
      });
    } else {
      // Fallback: Copy link
      navigator.clipboard.writeText(window.location.origin + `/news/${article.id}`);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <Card className="mx-auto w-full max-w-[380px] overflow-hidden transition-shadow hover:shadow-lg sm:max-w-none relative min-h-[400px] h-auto flex flex-col border-0 group">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        {article.imageUrl ? (
          <img 
            src={article.imageUrl} 
            alt="" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-800" />
        )}
        {/* Overlay - Dark enough for white text (75% black opacity) */}
        <div className="absolute inset-0 bg-black/75" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10 flex-1 overflow-hidden flex flex-col min-h-0">
        <AnimatePresence initial={false} mode="wait">
          {!showPolicyVote ? (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full min-h-0"
            >
              {/* Content - No scrolling, fits naturally */}
              <div className="flex-1 p-4 sm:p-6 flex flex-col">
                {/* Header: Source & Date */}
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                  {article.sourceLogoUrl && !logoLoadError ? (
                    <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full overflow-hidden border border-white/20 bg-white flex-shrink-0">
                      <img 
                        src={article.sourceLogoUrl} 
                        alt={article.source}
                        className="h-full w-full object-contain p-0.5"
                        onError={() => setLogoLoadError(true)}
                      />
                    </div>
                  ) : (
                    <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center text-[9px] sm:text-[10px] font-bold flex-shrink-0">
                      {article.source.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[10px] sm:text-xs font-semibold text-white shadow-black/50 drop-shadow-sm truncate">{article.source}</span>
                  <span className="text-[10px] sm:text-xs text-gray-300 flex-shrink-0">• {formatTimeAgo(article.publishedDate)}</span>
                  
                  {article.storyType && (
                    <Badge variant="outline" className="ml-auto text-[9px] sm:text-[10px] h-4 sm:h-5 font-normal capitalize text-gray-200 border-white/20 bg-white/5 flex-shrink-0">
                      {article.storyType.replace('_', ' ')}
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-base sm:text-xl font-bold leading-tight mb-3 text-white drop-shadow-md line-clamp-3 flex-shrink-0">
                  {article.title}
                </h2>

                {/* Summary */}
                <div className="mb-4 rounded-xl bg-white/10 p-3 sm:p-4 border border-white/10 backdrop-blur-sm flex-shrink-0">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-purple-300">AI Summary</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-100 leading-relaxed">
                    {article.aiSummary}
                  </p>
                </div>

                {/* Scores Section - Only show if we have REAL TD data */}
                {((article.affectedTDs && article.affectedTDs.length > 0) || article.politicianName) && (
                  <div className="mb-3 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-gray-400">Impact Analysis</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {article.affectedTDs && article.affectedTDs.length > 0 ? (
                        article.affectedTDs.slice(0, 2).map((td, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 sm:gap-2 bg-white/10 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-white/10 backdrop-blur-sm">
                            <span className="text-[10px] sm:text-xs font-medium text-white truncate max-w-[100px] sm:max-w-none">{td.name}</span>
                            <span className={`text-[10px] sm:text-xs font-bold flex-shrink-0 ${td.impactScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {td.impactScore >= 0 ? '+' : ''}{td.impactScore}
                            </span>
                          </div>
                        ))
                      ) : article.politicianName ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-white/10 rounded-full px-2 py-1 sm:px-3 sm:py-1.5 border border-white/10 backdrop-blur-sm">
                          <span className="text-[10px] sm:text-xs font-medium text-white truncate max-w-[100px] sm:max-w-none">{article.politicianName}</span>
                          <span className={`text-[10px] sm:text-xs font-bold flex-shrink-0 ${article.impactScore && article.impactScore >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {article.impactScore && article.impactScore >= 0 ? '+' : ''}{article.impactScore}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Policy Vote Button */}
                {article.policyVote && (
                  <div className="mt-auto pt-2 sm:pt-4 flex-shrink-0">
                    <Button 
                      onClick={() => setShowPolicyVote(true)}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20 border border-emerald-500/50 text-xs sm:text-sm py-2 sm:py-2.5"
                    >
                      <span className="truncate">Policy Vote</span>
                      <ChevronDown className="ml-2 h-3 w-3 sm:h-4 sm:w-4 -rotate-90 flex-shrink-0" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t border-white/10 p-2 sm:p-3 flex items-center justify-around bg-black/40 backdrop-blur-md flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={handleLike} className={`${liked ? "text-rose-500 hover:text-rose-400" : "text-gray-300 hover:text-white hover:bg-white/10"} h-8 sm:h-9 px-2 sm:px-3`}>
                  <ThumbsUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${liked ? "fill-current" : ""} mr-1 sm:mr-1.5`} />
                  <span className="text-[10px] sm:text-xs">{article.likes + (liked ? 1 : 0)}</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-300 hover:text-white hover:bg-white/10 h-8 sm:h-9 px-2 sm:px-3"
                  onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                  <span className="text-[10px] sm:text-xs">Read</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleShare} className="text-gray-300 hover:text-white hover:bg-white/10 h-8 sm:h-9 px-2 sm:px-3">
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-1.5" />
                  <span className="text-[10px] sm:text-xs">Share</span>
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="policy-vote"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl z-20 flex flex-col"
            >
              <div className="border-b border-white/10 p-3 flex items-center gap-2 bg-white/5">
                <Button variant="ghost" size="icon" onClick={() => setShowPolicyVote(false)} className="h-8 w-8 text-gray-300 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-sm text-white">Policy Vote</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {article.policyVote && (
                  <PolicyVotePrompt 
                    articleId={article.id} 
                    policyVote={article.policyVote}
                  />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
