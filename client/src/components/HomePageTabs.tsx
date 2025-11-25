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

type TabType = 'feed' | 'tds' | 'my-rankings' | 'map';

interface HomePageTabsProps {
  showScrollTop?: boolean;
  onScrollTop?: () => void;
}

export function HomePageTabs({ showScrollTop = false, onScrollTop }: HomePageTabsProps = {}) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [sortBy, setSortBy] = useState<'recent' | 'score'>('score');
  const [page, setPage] = useState(1);
  
  // Use different limits for different views
  // Highest Impact: Show ALL articles with impact (typically 20-30)
  // Recent: Show paginated 10 at a time
  const articlesPerPage = sortBy === 'score' ? 50 : 10;

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
                <div className="mt-8 flex items-center justify-between border-t pt-6">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {((page - 1) * articlesPerPage) + 1} - {Math.min(page * articlesPerPage, articles.total)} of {articles.total} articles
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage(p => p - 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={page === 1}
                    >
                      ← Previous
                    </Button>
                    
                    <div className="text-sm font-medium px-4">
                      Page {page} of {Math.ceil(articles.total / articlesPerPage)}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPage(p => p + 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      disabled={!articles.has_more}
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
        <div className="space-y-8">
          {/* TD Rankings */}
          <TDScoresWidget />
          
          {/* Party Rankings */}
          <PartyRankingsWidget />
          
          {/* Scoring Methodology */}
          <ScoringMethodology />
        </div>
      )}

      {/* My Rankings Tab Content */}
      {activeTab === 'my-rankings' && (
        <PersonalRankingsTab />
      )}

      {/* Map Tab Content */}
      {activeTab === 'map' && (
        <div>
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-2">Irish Constituencies Map</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Interactive map showing all 43 constituencies. Click any area to see TDs, party breakdown, and performance metrics.
            </p>
          </div>
          <InteractiveConstituencyMap />
        </div>
      )}
    </div>
  );
}

