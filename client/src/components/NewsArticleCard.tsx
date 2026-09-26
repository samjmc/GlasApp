/**
 * News article card: image, publisher, headline, AI summary, the other outlets that reported
 * the same event, the TDs it names, the policy vote for the story, and like / read / share actions.
 */

import { ExternalLink, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { PolicyVotePrompt } from './PolicyVotePrompt';
import { ArticleImage } from './news/ArticleImage';
import { humanizeCategory, type FeedArticle } from '@/lib/news';

/** Relative time for recent stories ("2 hours ago"), a date for older ones. */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Card displaying a news article with like, read and share actions. */
export function NewsArticleCard({ article }: { article: FeedArticle }) {
  const { toast } = useToast();
  const body = article.aiSummary ?? article.summary;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, text: article.summary ?? undefined, url: article.url });
      } catch {
        // The user closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(article.url);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy the link', variant: 'destructive' });
    }
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border bg-card">
      <ArticleImage
        src={article.imageUrl}
        alt=""
        source={article.source}
        sourceLogoUrl={article.sourceLogoUrl}
        category={article.category}
        className="rounded-none"
      />

      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <span className="truncate font-semibold text-foreground">{article.source}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={article.publishedAt}>{formatTimeAgo(article.publishedAt)}</time>
          {article.category && <Badge variant="secondary">{humanizeCategory(article.category)}</Badge>}
        </div>

        <h3 className="line-clamp-3 font-display text-xl font-bold leading-tight tracking-tight">{article.title}</h3>

        {body && (
          <div className="rounded-xl bg-elevated p-4">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI summary
            </span>
            <p className="text-sm leading-relaxed">{body}</p>
          </div>
        )}

        {article.alsoReportedBy && article.alsoReportedBy.length > 0 && (
          <p className="text-[13px] text-muted-foreground">
            Also reported by:{' '}
            {article.alsoReportedBy.map((other, i) => (
              <span key={other.url}>
                {i > 0 && ', '}
                <a href={other.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline-offset-2 hover:underline">
                  {other.source}
                </a>
              </span>
            ))}
          </p>
        )}

        {article.affectedTDs && article.affectedTDs.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="TDs in this story">
            {article.affectedTDs.slice(0, 2).map((td) => (
              <span key={td.name} className="inline-flex items-center rounded-full bg-elevated px-3 py-1 text-[13px]">
                <span className="max-w-[10rem] truncate font-semibold">{td.name}</span>
              </span>
            ))}
          </div>
        )}

        {article.policyVote && (
          <div className="rounded-xl border p-4">
            <PolicyVotePrompt articleId={article.id} policyVote={article.policyVote} />
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1 border-t px-2 py-2">
        <Button variant="ghost" size="sm" asChild className="h-11 flex-1">
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Read story
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleShare} className="h-11 flex-1">
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </Button>
      </div>
    </article>
  );
}
