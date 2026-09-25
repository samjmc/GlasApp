/**
 * ArticleImage
 * Fixed aspect-ratio image box with a designed placeholder (never a broken-image icon):
 * publisher logo or initials on a category-tinted tile, with the category label.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { humanizeCategory, type NewsCategory } from '@/lib/news';

interface ArticleImageProps {
  src: string | null;
  alt: string;
  source: string;
  sourceLogoUrl: string | null;
  category: NewsCategory | null;
  className?: string;
  priority?: boolean;
}

// Per-category tint from the theme tokens, so the fallback works in dark and light.
const CATEGORY_TINTS: Record<NewsCategory, string> = {
  government: 'bg-primary/15',
  oireachtas: 'bg-primary/25',
  elections: 'bg-score-mid/20',
  economy: 'bg-score-mid/15',
  housing: 'bg-warn/20',
  health: 'bg-destructive/15',
  justice: 'bg-elevated',
  immigration: 'bg-warn/15',
  environment: 'bg-score-high/20',
  education: 'bg-primary/10',
  foreign_affairs: 'bg-elevated',
  northern_ireland: 'bg-score-high/10',
  eu: 'bg-primary/20',
  local: 'bg-score-mid/10',
  other: 'bg-elevated',
};

/** First letters of the first two words of a name, uppercased (e.g. "Irish Times" -> "IT"). */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Article image with a fixed aspect ratio; falls back to a designed placeholder on error or when there is no image. */
export function ArticleImage({ src, alt, source, sourceLogoUrl, category, className, priority }: ArticleImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showImage = !!src && !imageFailed;

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-elevated', className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className={cn('h-full w-full object-cover transition-opacity duration-200', loaded ? 'opacity-100' : 'opacity-0')}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className={cn('flex h-full w-full flex-col items-center justify-center gap-2', category ? CATEGORY_TINTS[category] : 'bg-elevated')}>
          {sourceLogoUrl && !logoFailed ? (
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-card">
              <img
                src={sourceLogoUrl}
                alt={source}
                className="h-full w-full object-contain p-1.5"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
              />
            </span>
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full border bg-card font-display text-sm font-bold text-foreground">
              {initialsOf(source)}
            </span>
          )}
          {category && <span className="text-xs font-semibold text-muted-foreground">{humanizeCategory(category)}</span>}
        </div>
      )}
    </div>
  );
}
