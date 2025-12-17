/**
 * HomePage Tab System
 * Feed | TDs | Constituencies
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { TDScoresWidget } from '@/components/TDScoresWidget';
import { PartyRankingsWidget } from '@/components/PartyRankingsWidget';
import { ScoringMethodology } from '@/components/ScoringMethodology';
import { InteractiveConstituencyMap } from '@/components/InteractiveConstituencyMap';
import { Newspaper, Users, Map, Clock, TrendingUp, Sparkles, Heart } from 'lucide-react';
import { PersonalRankingsTab } from './PersonalRankingsTab';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorDisplay, NetworkError } from '@/components/ErrorDisplay';
import { EmptyNewsFeedState, LoadingState } from '@/components/onboarding/EmptyStates';
import { PageHeader } from "@/components/PageHeader";

type TabType = 'feed' | 'tds' | 'my-rankings' | 'map';

interface HomePageTabsProps {
  showScrollTop?: boolean;
  onScrollTop?: () => void;
}

export function HomePageTabs({ showScrollTop = false, onScrollTop }: HomePageTabsProps = {}) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [rankingsSubTab, setRankingsSubTab] = useState<'tds' | 'parties'>('tds');
  const [sortBy, setSortBy] = useState<'recent' | 'score'>('score');
  const [page, setPage] = useState(1);
  
  // Always show 10 articles per page for consistent pagination
  const articlesPerPage = 10;

  // News Feed Query
  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['news-feed-v5', sortBy, page],  // v5 - added Irish Independent logo
    queryFn: async () => {
      const offset = (page - 1) * articlesPerPage;
      const res = await fetch(`/api/news-feed?sort=${sortBy}&limit=${articlesPerPage}&offset=${offset}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('News feed not available');
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load news feed');
      }
      return res.json();
    },
    staleTime: 1000, // Very short cache to force refresh
    enabled: activeTab === 'feed',
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleSortChange = (newSort: 'recent' | 'score') => {
    setSortBy(newSort);
    setPage(1); // Reset to first page when changing sort
  };

  const scrollTopHandler =
    onScrollTop ??
    (() => window.scrollTo({ top: 0, behavior: "smooth" }));

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-5">
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white/80 p-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`flex h-11 items-center justify-center rounded-xl transition ${activeTab === 'feed' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            aria-label="News feed"
          >
            <Newspaper className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tds')}
            className={`flex h-11 items-center justify-center rounded-xl transition ${activeTab === 'tds' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            aria-label="Rankings"
          >
            <Users className="h-4 w-4" />
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => setActiveTab('my-rankings')}
              className={`flex h-11 items-center justify-center rounded-xl transition ${activeTab === 'my-rankings' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
              aria-label="My rankings"
            >
              <Heart className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-11 rounded-xl border border-dashed border-slate-300 dark:border-slate-700"></div>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`flex h-11 items-center justify-center rounded-xl transition ${activeTab === 'map' ? 'bg-emerald-500 text-white shadow' : 'text-slate-500 dark:text-slate-400'}`}
            aria-label="Constituency map"
          >
            <Map className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feed Tab Content */}
      {activeTab === 'feed' && (
        <div>
          {/* Feed Controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-2">
              <Button
                variant={sortBy === 'score' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('score')}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Highest Impact
              </Button>
              <Button
                variant={sortBy === 'recent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSortChange('recent')}
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Most Recent
              </Button>
            </div>
            
          </div>

          {/* Feed Content */}
          {error ? (
            <ErrorDisplay
              title="Failed to load news feed"
              message={error instanceof Error ? error.message : 'Unable to fetch the latest news articles'}
              error={error}
              onRetry={() => refetch()}
              variant="default"
              type={error instanceof Error && error.message.includes('Server error') ? 'network' : 'error'}
            />
          ) : isLoading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-6 animate-pulse">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full mb-2"></div>
                  <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6"></div>
                </Card>
              ))}
            </div>
          ) : articles?.articles?.length > 0 ? (
            <>
              <div className="space-y-6">
                {articles.articles.map((article: any) => (
                  <NewsArticleCard key={article.id} article={article} />
                ))}
              </div>

              {/* Pagination */}
              {articles.total > articlesPerPage && (
                <div className="mt-8 space-y-4 border-t pt-6">
                  {/* Results count */}
                  <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    Showing {((page - 1) * articlesPerPage) + 1} - {Math.min(page * articlesPerPage, articles.total)} of {articles.total} articles
                  </div>
                  
                  {/* Pagination controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage(p => Math.max(1, p - 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page === 1}
                      className="w-full sm:w-auto"
                    >
                      ← Previous
                    </Button>
                    
                    {/* Page numbers */}
                    <div className="flex items-center gap-1 flex-wrap justify-center">
                      {(() => {
                        const totalPages = Math.ceil(articles.total / articlesPerPage);
                        const maxVisiblePages = 5;
                        const pages: (number | string)[] = [];
                        
                        if (totalPages <= maxVisiblePages) {
                          // Show all pages if 5 or fewer
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Show first page
                          pages.push(1);
                          
                          if (page > 3) {
                            pages.push('...');
                          }
                          
                          // Show pages around current page
                          const start = Math.max(2, page - 1);
                          const end = Math.min(totalPages - 1, page + 1);
                          
                          for (let i = start; i <= end; i++) {
                            pages.push(i);
                          }
                          
                          if (page < totalPages - 2) {
                            pages.push('...');
                          }
                          
                          // Show last page
                          pages.push(totalPages);
                        }
                        
                        return pages.map((p, idx) => {
                          if (p === '...') {
                            return (
                              <span key={`ellipsis-${idx}`} className="px-2 text-gray-500 dark:text-gray-400">
                                ...
                              </span>
                            );
                          }
                          
                          const pageNum = p as number;
                          const isActive = pageNum === page;
                          
                          return (
                            <button
                              key={pageNum}
                              onClick={() => {
                                setPage(pageNum);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`min-w-[2.5rem] h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                                isActive
                                  ? 'bg-emerald-500 text-white shadow-md'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                              aria-label={`Go to page ${pageNum}`}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              {pageNum}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const totalPages = Math.ceil(articles.total / articlesPerPage);
                        setPage(p => Math.min(totalPages, p + 1));
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={!articles.has_more && page >= Math.ceil(articles.total / articlesPerPage)}
                      className="w-full sm:w-auto"
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyNewsFeedState />
          )}
        </div>
      )}

      {/* Rankings Tab Content */}
      {activeTab === 'tds' && (
        <div>
          <PageHeader
            className="mb-6"
            title="Performance Rankings"
            tooltipTitle="How Scoring Works"
            bullets={[
              "TDs are scored (0-100) using AI analysis of 11 Irish news sources.",
              "Scores combine news sentiment, parliamentary activity, constituency work, and public ratings.",
              "Bias protection reduces partisan skew by 75-85% to ensure fairness.",
              "Party scores track activity: 60% attendance and 40% questions asked per TD.",
              "Rankings update daily at 6 AM using Oireachtas records."
            ]}
          />

          <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900/60 mb-6">
            {(['tds', 'parties'] as const).map((tab) => {
              const isActive = rankingsSubTab === tab;
              const labels = {
                tds: 'TDs',
                parties: 'Parties'
              };

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRankingsSubTab(tab)}
                  className={[
                    "h-11 w-full rounded-xl px-2 text-xs font-semibold tracking-wide transition",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900",
                    isActive
                      ? "bg-emerald-500 text-white shadow"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="block truncate">{labels[tab]}</span>
                </button>
              );
            })}
          </nav>

          <div className="animate-in fade-in duration-300">
            {rankingsSubTab === 'tds' && <TDScoresWidget />}
            {rankingsSubTab === 'parties' && <PartyRankingsWidget />}
          </div>
        </div>
      )}

      {/* My Rankings Tab Content */}
      {activeTab === 'my-rankings' && (
        <PersonalRankingsTab />
      )}

      {/* Map Tab Content */}
      {activeTab === 'map' && (
        <div>
          <PageHeader
            className="mb-6"
            title="Irish Constituencies Map"
            tooltipTitle="About the Map"
            bullets={[
              "Explore all 43 constituencies visually.",
              "Click any area to see TDs, party breakdown, and performance metrics.",
              "Toggle layers to see Party Dominance, Performance, Gender Balance, and Government control."
            ]}
          />
          <InteractiveConstituencyMap />
        </div>
      )}
    </div>
  );
}
