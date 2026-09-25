/**
 * Home page news feed: today's biggest story, then the paged feed with its sort options.
 * (Rankings live on /rankings, personal rankings on /my-politics, the map on /constituencies.)
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import type { FeedArticle } from '@/lib/news';
import { NewsArticleCard } from '@/components/NewsArticleCard';
import { TodaysBiggestImpact } from '@/components/TodaysBiggestImpact';
import { EmptyNewsFeedState } from '@/components/onboarding/EmptyStates';
import { EmptyState } from '@/components/pulse/EmptyState';
import { Segmented } from '@/components/pulse/Segmented';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type SortBy = 'recent' | 'score';

const SORTS: { value: SortBy; label: string }[] = [
  { value: 'score', label: 'Top impact' },
  { value: 'recent', label: 'Latest' },
];

const ARTICLES_PER_PAGE = 10;

/** Page numbers to show: first, last, and the pages next to the current one. */
function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (page > 3) pages.push('…');
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
  if (page < totalPages - 2) pages.push('…');
  pages.push(totalPages);
  return pages;
}

/** The home page news section. */
export function HomePageTabs() {
  const [sortBy, setSortBy] = useState<SortBy>('score');
  const [page, setPage] = useState(1);

  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.news.feed(sortBy, page),
    queryFn: async () => {
      const offset = (page - 1) * ARTICLES_PER_PAGE;
      const res = await fetch(`/api/news-feed?sort=${sortBy}&limit=${ARTICLES_PER_PAGE}&offset=${offset}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('News feed not available');
        if (res.status >= 500) throw new Error('Server error - please try again later');
        throw new Error('Failed to load news feed');
      }
      const json = await res.json();
      return json.data as { articles: FeedArticle[]; total: number; hasMore: boolean };
    },
    staleTime: 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    setPage(1);
  };

  const goToPage = (p: number) => {
    setPage(p);
    document.getElementById('news')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalPages = articles ? Math.ceil(articles.total / ARTICLES_PER_PAGE) : 0;

  return (
    <section id="news" aria-labelledby="news-heading" className="flex scroll-mt-20 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="news-heading" className="font-display text-2xl font-bold tracking-tight">
          News
        </h2>
        <Segmented label="Sort news" options={SORTS} value={sortBy} onChange={handleSortChange} size="sm" />
      </div>

      <TodaysBiggestImpact />

      {error ? (
        <EmptyState
          icon={AlertCircle}
          title="The news feed did not load"
          action={
            <Button variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          {error instanceof Error ? error.message : 'Unable to fetch the latest news articles'}
        </EmptyState>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading news">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="flex flex-col gap-2 p-4">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : articles && articles.articles.length > 0 ? (
        <>
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.articles.map((article) => (
              <NewsArticleCard key={article.id} article={article} />
            ))}
          </div>

          {articles.total > ARTICLES_PER_PAGE && (
            <nav aria-label="News pages" className="flex flex-col items-center gap-3 border-t pt-5">
              <span className="text-sm text-muted-foreground">
                {(page - 1) * ARTICLES_PER_PAGE + 1}–{Math.min(page * ARTICLES_PER_PAGE, articles.total)} of{' '}
                {articles.total} stories
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {pageList(page, totalPages).map((p, idx) =>
                  p === '…' ? (
                    <span key={`gap-${idx}`} className="px-1 text-muted-foreground" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={p === page ? 'page' : undefined}
                      className={cn(
                        'h-11 min-w-11 rounded-lg px-3 text-sm font-semibold transition-colors',
                        p === page ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={!articles.hasMore && page >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <EmptyNewsFeedState onRefresh={() => refetch()} />
      )}
    </section>
  );
}
