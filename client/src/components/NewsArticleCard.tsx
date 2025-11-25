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
  ChevronUp
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
  const [showComments, setShowComments] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [localComments, setLocalComments] = useState(article.comments || []);
const [logoLoadError, setLogoLoadError] = useState(false);
const [showPolicyVote, setShowPolicyVote] = useState(false);
  const hasLegacyProcessScores = [
    article.transparencyScore,
    article.integrityScore,
    article.effectivenessScore,
    article.consistencyScore
  ].some(score => score !== undefined);
  const transparencyAvailable = isProcessScoreAvailable(article.transparencyScore);
  const integrityAvailable = isProcessScoreAvailable(article.integrityScore);
  const effectivenessAvailable = isProcessScoreAvailable(article.effectivenessScore);
  const consistencyAvailable = isProcessScoreAvailable(article.consistencyScore);

  const handleLike = () => {
    setLiked(!liked);
    // In production: POST to /api/articles/:id/like
  };

  const handleComment = () => {
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now(),
      author: 'Dev User',
      avatar: 'DU',
      content: newComment,
      likes: 0,
      timestamp: 'Just now'
    };
    
    setLocalComments([comment, ...localComments]);
    setNewComment('');
    
    // In production: POST to /api/articles/:id/comments
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
    <Card className="mx-auto w-full max-w-[380px] overflow-hidden transition-shadow hover:shadow-lg sm:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3 sm:p-4">
        <div className="flex items-center gap-3">
          {article.sourceLogoUrl && !logoLoadError ? (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white sm:h-10 sm:w-10">
              <img 
                src={article.sourceLogoUrl} 
                alt={`${article.source} logo`}
                className="h-full w-full object-contain p-1"
                onError={() => setLogoLoadError(true)}
              />
            </div>
          ) : (
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 sm:h-10 sm:w-10 sm:text-sm">
              {article.source.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold sm:text-sm">{article.source}</div>
            <div className="text-[11px] text-gray-500">{formatTimeAgo(article.publishedDate)}</div>
          </div>
        </div>
        
        {article.storyType && (
          <Badge variant={
            article.sentiment?.includes('positive') ? 'success' : 
            article.sentiment?.includes('negative') ? 'destructive' : 
            'secondary'
          } className="capitalize text-xs">
            {article.storyType.replace('_', ' ')}
          </Badge>
        )}
      </div>

      {/* Main Content - Horizontal Split Layout */}
      <div className="flex flex-col md:flex-row">
        {/* Image on Left - Fixed width on desktop, full width on mobile */}
      {article.imageUrl && (
          <div className="relative h-56 w-full flex-shrink-0 bg-gray-100 md:h-auto md:w-[400px]">
          <img 
            src={article.imageUrl} 
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

        {/* Content on Right */}
        <div className="flex-1 p-3 sm:p-4">
        {/* Title */}
        <h2 className="mb-2 text-base font-semibold leading-tight sm:text-lg">
          {article.title}
        </h2>

        {/* AI Summary - Always Fully Visible */}
        <div className="mb-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-2.5 dark:from-purple-900/20 dark:to-pink-900/20">
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-purple-900 dark:text-purple-100">AI Summary</span>
          </div>
          <p className="text-xs leading-relaxed text-purple-800 dark:text-purple-200 sm:text-sm">
            {article.aiSummary}
          </p>
        </div>

        {/* Policy Vote Opportunity */}
        {article.policyVote && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <button
              type="button"
              onClick={() => setShowPolicyVote((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-emerald-800 transition-colors dark:text-emerald-100"
            >
              <span>Policy vote opportunity</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showPolicyVote ? "rotate-180" : ""}`}
              />
            </button>
            {showPolicyVote && (
              <div className="border-t border-emerald-200/60 px-3 py-3 dark:border-emerald-500/30">
                <PolicyVotePrompt articleId={article.id} policyVote={article.policyVote} />
              </div>
            )}
          </div>
        )}

        {/* TD Impact (if applicable) - Show ALL affected TDs */}
        {((article.affectedTDs && article.affectedTDs.length > 0) || article.politicianName) && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700/50 mb-3 overflow-hidden">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-300">Affects:</span>
                <div className="flex flex-wrap gap-2 items-center">
                  {article.affectedTDs && article.affectedTDs.length > 0 ? (
                    article.affectedTDs.map((td, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-gray-700/50 rounded-full">
                        <span className="font-semibold text-white text-sm">{td.name}</span>
                        <span className={`text-xs font-bold ${td.impactScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {td.impactScore >= 0 ? '+' : ''}{td.impactScore}
                        </span>
                        {td.needsReview && <span className="text-xs">⚠️</span>}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{article.politicianName}</span>
                      <span className={`text-lg font-bold ${article.impactScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {article.impactScore >= 0 ? '+' : ''}{article.impactScore}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {showReasoning ? 
                  <ChevronUp className="w-4 h-4 text-gray-400" /> :
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </div>
            </button>
            
            {/* Expandable Reasoning Section */}
            {showReasoning && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50 pt-3">
                {/* Show analysis for EACH affected TD */}
                {article.affectedTDs && article.affectedTDs.length > 0 ? (
                  article.affectedTDs.map((td, tdIdx) => {
                    const tdTransparencyAvailable = isProcessScoreAvailable(td.transparencyScore);
                    const tdIntegrityAvailable = isProcessScoreAvailable(td.integrityScore);
                    const tdEffectivenessAvailable = isProcessScoreAvailable(td.effectivenessScore);
                    const tdConsistencyAvailable = isProcessScoreAvailable(td.consistencyScore);
                    
                    return (
                    <div key={tdIdx} className="space-y-3">
                      {/* TD Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-700/30">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                          {td.name}
                          {td.needsReview && (
                            <span className="text-xs px-2 py-0.5 bg-red-900/40 text-red-300 border border-red-700/40 rounded">
                              ⚠️ Flagged for Review
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-bold ${td.impactScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {td.impactScore >= 0 ? '+' : ''}{td.impactScore}
                          </span>
                          {td.impactScore >= 0 ? 
                            <TrendingUp className="w-4 h-4 text-green-400" /> :
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          }
                        </div>
                      </div>
                      
                      {/* AI Reasoning for THIS TD */}
                      {td.aiReasoning && (
                        <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 backdrop-blur-sm">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Sparkles className="w-3 h-3 text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-xs font-semibold text-blue-300 mb-1.5">Why This Changed Their ELO</h4>
                              <p className="text-sm text-blue-200 leading-relaxed">{td.aiReasoning}</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Process Scores for THIS TD */}
                      {(td.transparencyScore !== undefined || td.integrityScore !== undefined || td.effectivenessScore !== undefined || td.consistencyScore !== undefined) && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Process Scores</h4>
                            <span className="text-xs text-gray-500">How they did their job</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {td.transparencyScore !== undefined && (
                              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                                <div className="text-xs text-gray-500 mb-1">Transparency</div>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-2xl font-bold ${tdTransparencyAvailable ? 'text-blue-400' : 'text-gray-400'}`}>
                                    {tdTransparencyAvailable ? td.transparencyScore : 'N/A'}
                                  </span>
                                  {tdTransparencyAvailable && <span className="text-xs text-gray-500">/100</span>}
                                </div>
                                {td.transparencyReasoning && (
                                  <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{td.transparencyReasoning}</div>
                                )}
                              </div>
                            )}
                            {td.integrityScore !== undefined && (
                              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                                <div className="text-xs text-gray-500 mb-1">Integrity</div>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-2xl font-bold ${tdIntegrityAvailable ? 'text-purple-400' : 'text-gray-400'}`}>
                                    {tdIntegrityAvailable ? td.integrityScore : 'N/A'}
                                  </span>
                                  {tdIntegrityAvailable && <span className="text-xs text-gray-500">/100</span>}
                                </div>
                                {td.integrityReasoning && (
                                  <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{td.integrityReasoning}</div>
                                )}
                              </div>
                            )}
                            {td.effectivenessScore !== undefined && (
                              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                                <div className="text-xs text-gray-500 mb-1">Effectiveness</div>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-2xl font-bold ${tdEffectivenessAvailable ? 'text-emerald-400' : 'text-gray-400'}`}>
                                    {tdEffectivenessAvailable ? td.effectivenessScore : 'N/A'}
                                  </span>
                                  {tdEffectivenessAvailable && <span className="text-xs text-gray-500">/100</span>}
                                </div>
                                {td.effectivenessReasoning && (
                                  <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{td.effectivenessReasoning}</div>
                                )}
                              </div>
                            )}
                            {td.consistencyScore !== undefined && (
                              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                                <div className="text-xs text-gray-500 mb-1">Consistency</div>
                                <div className="flex items-baseline gap-1">
                                  <span className={`text-2xl font-bold ${getConsistencyColorClass(td.consistencyScore)}`}>
                                    {tdConsistencyAvailable ? td.consistencyScore : 'N/A'}
                                  </span>
                                  {tdConsistencyAvailable && <span className="text-xs text-gray-500">/100</span>}
                                </div>
                                {td.consistencyReasoning && (
                                  <div className="text-xs text-gray-400 mt-1.5 leading-relaxed">{td.consistencyReasoning}</div>
                                )}
                                {td.flipFlopExplanation && (
                                  <div className="text-xs text-red-300 mt-1.5 leading-relaxed">
                                    🚨 {td.flipFlopExplanation}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Flip-flop warning for THIS TD */}
                      {td.flipFlopDetected && td.flipFlopDetected !== 'none' && (
                        <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <div className="flex-1 text-xs text-red-300">
                            <span className="font-semibold">Flip-flop detected ({td.flipFlopDetected}):</span> {td.flipFlopExplanation}
                          </div>
                        </div>
                      )}
                      
                      {/* Divider between TDs */}
                      {tdIdx < (article.affectedTDs?.length || 0) - 1 && (
                        <div className="border-t border-gray-700/30"></div>
                      )}
                    </div>
                    );
                  })
                ) : (
                  /* Fallback for old articles without affectedTDs */
                  <>
                    {/* AI Reasoning Explanation */}
                    {article.aiReasoning && (
                      <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 backdrop-blur-sm">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Sparkles className="w-3 h-3 text-blue-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-xs font-semibold text-blue-300 mb-1.5">Why This Changed Their ELO</h4>
                            <p className="text-sm text-blue-200 leading-relaxed">{article.aiReasoning}</p>
                          </div>
                        </div>
                      </div>
                    )}
                
        {/* Process Scores Breakdown */}
        {hasLegacyProcessScores && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Process Scores</h4>
                      <span className="text-xs text-gray-500">How they did their job</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {article.transparencyScore !== undefined && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                          <div className="text-xs text-gray-500 mb-1">Transparency</div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${transparencyAvailable ? 'text-blue-400' : 'text-gray-400'}`}>
                              {transparencyAvailable ? article.transparencyScore : 'N/A'}
                            </span>
                            {transparencyAvailable && <span className="text-xs text-gray-500">/100</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {transparencyAvailable
                              ? article.transparencyScore >= 80 ? 'Very open'
                                : article.transparencyScore >= 60 ? 'Fairly open'
                                : article.transparencyScore >= 40 ? 'Some concerns'
                                : article.transparencyScore >= 20 ? 'Not transparent'
                                : '🚨 Deceptive'
                              : (article.transparencyReasoning || PROCESS_SCORE_UNAVAILABLE_TEXT)}
                          </div>
                        </div>
                      )}
                      {article.integrityScore !== undefined && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                          <div className="text-xs text-gray-500 mb-1">Integrity</div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${integrityAvailable ? 'text-purple-400' : 'text-gray-400'}`}>
                              {integrityAvailable ? article.integrityScore : 'N/A'}
                            </span>
                            {integrityAvailable && <span className="text-xs text-gray-500">/100</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {integrityAvailable
                              ? article.integrityScore >= 80 ? 'No ethical issues'
                                : article.integrityScore >= 60 ? 'Minor concerns'
                                : article.integrityScore >= 40 ? 'Some issues'
                                : article.integrityScore >= 20 ? 'Ethics concerns'
                                : '🚨 Corrupt'
                              : (article.integrityReasoning || PROCESS_SCORE_UNAVAILABLE_TEXT)}
                          </div>
                        </div>
                      )}
                      {article.effectivenessScore !== undefined && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                          <div className="text-xs text-gray-500 mb-1">Effectiveness</div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${effectivenessAvailable ? 'text-emerald-400' : 'text-gray-400'}`}>
                              {effectivenessAvailable ? article.effectivenessScore : 'N/A'}
                            </span>
                            {effectivenessAvailable && <span className="text-xs text-gray-500">/100</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {effectivenessAvailable
                              ? article.effectivenessScore >= 80 ? 'Delivers results'
                                : article.effectivenessScore >= 60 ? 'Partially delivers'
                                : article.effectivenessScore >= 40 ? 'Struggling'
                                : article.effectivenessScore >= 20 ? 'Not delivering'
                                : '🚨 Complete failure'
                              : (article.effectivenessReasoning || PROCESS_SCORE_UNAVAILABLE_TEXT)}
                          </div>
                        </div>
                      )}
                      {article.consistencyScore !== undefined && (
                        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/30">
                          <div className="text-xs text-gray-500 mb-1">Consistency</div>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-bold ${getConsistencyColorClass(article.consistencyScore)}`}>
                              {consistencyAvailable ? article.consistencyScore : 'N/A'}
                            </span>
                            {consistencyAvailable && <span className="text-xs text-gray-500">/100</span>}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {consistencyAvailable
                              ? article.consistencyScore === 0 ? '🚨 Major flip-flop'
                                : article.consistencyScore >= 80 ? 'Very consistent'
                                : article.consistencyScore >= 60 ? 'Mostly consistent'
                                : article.consistencyScore >= 40 ? 'Some flip-flops'
                                : article.consistencyScore >= 20 ? 'Inconsistent'
                                : '⚠️ Severe inconsistency'
                              : (article.consistencyReasoning || PROCESS_SCORE_UNAVAILABLE_TEXT)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* ELO Change Explanation */}
                <div className={`rounded-lg p-3 border ${
                  article.impactScore >= 4 ? 'bg-green-900/20 border-green-700/40' :
                  article.impactScore >= 1 ? 'bg-emerald-900/20 border-emerald-700/40' :
                  article.impactScore <= -4 ? 'bg-red-900/20 border-red-700/40' :
                  article.impactScore < 0 ? 'bg-orange-900/20 border-orange-700/40' :
                  'bg-gray-900/20 border-gray-700/40'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      article.impactScore >= 1 ? 'bg-green-600/30' :
                      article.impactScore < 0 ? 'bg-red-600/30' :
                      'bg-gray-600/30'
                    }`}>
                      {article.impactScore >= 1 ? 
                        <TrendingUp className="w-3 h-3 text-green-400" /> :
                        article.impactScore < 0 ?
                        <TrendingDown className="w-3 h-3 text-red-400" /> :
                        <span className="text-xs text-gray-400">→</span>
                      }
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-xs font-semibold mb-1.5 ${
                        article.impactScore >= 1 ? 'text-green-300' :
                        article.impactScore < 0 ? 'text-red-300' :
                        'text-gray-300'
                      }`}>
                        ELO Impact: {article.impactScore >= 0 ? '+' : ''}{article.impactScore}
                      </h4>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {article.impactScore >= 4 ? '🚀 Strong positive impact - Good process scores across the board increase their ELO ranking' :
                         article.impactScore >= 1 ? '📈 Positive impact - Good transparency and integrity boost their score' :
                         article.impactScore <= -4 ? '📉 Strong negative impact - Poor process scores decrease their ELO ranking' :
                         article.impactScore < 0 ? '⚠️ Slight negative impact - Some process concerns lower their score' :
                         '➡️ Neutral impact - Balanced process scores, no significant ELO change'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Opposition Advocacy Badge */}
                {article.isOppositionAdvocacy && (
                  <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-lg p-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-300">Opposition advocacy - calling out issues, holding government accountable</span>
                  </div>
                )}
                
                {/* Story Type & Sentiment */}
                <div className="flex gap-2">
                  {article.storyType && (
                    <div className="flex-1 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-700/30">
                      <div className="text-xs text-gray-400">Type</div>
                      <div className="text-sm font-medium text-gray-200 capitalize">{article.storyType.replace('_', ' ')}</div>
                    </div>
                  )}
                  {article.sentiment && (
                    <div className="flex-1 bg-gray-900/50 rounded-lg px-3 py-2 border border-gray-700/30">
                      <div className="text-xs text-gray-400">Sentiment</div>
                      <div className={`text-sm font-medium capitalize ${
                        article.sentiment.includes('positive') ? 'text-green-400' :
                        article.sentiment.includes('negative') ? 'text-red-400' :
                        'text-gray-300'
                      }`}>
                        {article.sentiment}
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Policy Voting - For ideological policies */}
        {article.isIdeologicalPolicy && article.affectedTDs && article.affectedTDs.length > 0 && (
          <div className="mb-3">
            {/* Show voting for primary TD (first one with strongest stance) */}
            {(() => {
              const primaryTD = article.affectedTDs
                .filter(td => td.tdStance && td.tdStance !== 'unclear')
                .sort((a, b) => (b.tdStanceStrength || 0) - (a.tdStanceStrength || 0))[0];
              
              if (!primaryTD) return null;
              
              return (
                <PolicyVoting
                  articleId={article.id}
                  politicianName={primaryTD.name}
                  policyFacts={article.policyFacts}
                  perspectives={article.perspectives}
                  userId={undefined} // TODO: Get from auth context
                  isIdeologicalPolicy={article.isIdeologicalPolicy}
                  policyDirection={article.policyDirection}
                  tdStance={primaryTD.tdStance}
                  tdStanceEvidence={primaryTD.tdStanceEvidence}
                />
              );
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-4 py-2 border-t border-b">
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              liked ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
            <span>{article.likes + (liked ? 1 : 0)}</span>
          </button>
          
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-500 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span>{localComments.length}</span>
          </button>
          
          <button
            onClick={handleShare}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-500 transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span>Share</span>
          </button>
          
          <a 
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-emerald-500 transition-colors ml-auto"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Source</span>
          </a>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 space-y-4">
            {/* Comment Input */}
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                DU
              </div>
              <div className="flex-1">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                <div className="flex justify-end mt-2">
                  <Button 
                    onClick={handleComment}
                    size="sm"
                    disabled={!newComment.trim()}
                  >
                    Post Comment
                  </Button>
                </div>
              </div>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              {localComments.slice(0, showComments ? undefined : 3).map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xs flex-shrink-0">
                    {comment.avatar}
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{comment.author}</span>
                      <span className="text-xs text-gray-500">• {comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {comment.content}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <button className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {comment.likes > 0 && comment.likes}
                      </button>
                      <button className="text-xs text-gray-500 hover:text-emerald-500">
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {localComments.length > 3 && !showComments && (
                <button 
                  onClick={() => setShowComments(true)}
                  className="text-sm text-gray-500 hover:text-emerald-600"
                >
                  View all {localComments.length} comments
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </Card>
  );
}

