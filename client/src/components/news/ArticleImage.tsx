/**
 * ArticleImage
 * Fixed aspect-ratio image box with a designed placeholder (never a broken-image icon):
 * publisher logo or initials on a category-tinted gradient, with the category label.
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

// Deterministic per-category gradient (two Tailwind colour stops), light + dark.
const CATEGORY_GRADIENTS: Record<NewsCategory, string> = {
  government: 'from-slate-700 to-slate-900',
  oireachtas: 'from-emerald-700 to-slate-900',
  elections: 'from-purple-700 to-indigo-900',
  economy: 'from-amber-600 to-slate-900',
  housing: 'from-orange-700 to-slate-900',
  health: 'from-rose-700 to-slate-900',
  justice: 'from-blue-800 to-slate-900',
  immigration: 'from-teal-700 to-slate-900',
  environment: 'from-green-700 to-emerald-950',
  education: 'from-sky-700 to-slate-900',
  foreign_affairs: 'from-indigo-700 to-slate-900',
  northern_ireland: 'from-cyan-700 to-slate-900',
  eu: 'from-blue-700 to-indigo-950',
  local: 'from-lime-700 to-slate-900',
  other: 'from-gray-700 to-gray-900',
};

const DEFAULT_GRADIENT = 'from-gray-700 to-gray-900';

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
  const gradient = category ? CATEGORY_GRADIENTS[category] : DEFAULT_GRADIENT;

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-lg bg-muted', className)}>
      {showImage && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0'
          )}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(true)}
          onError={() => setImageFailed(true)}
        />
      )}

      {!showImage && (
        <div className={cn('flex h-full w-full flex-col items-center justify-center bg-gradient-to-br', gradient)}>
          <div className="flex flex-1 items-center justify-center">
            {sourceLogoUrl && !logoFailed ? (
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white">
                <img
                  src={sourceLogoUrl}
                  alt={source}
                  className="h-full w-full object-contain p-1.5"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoFailed(true)}
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-bold text-white">
                {initialsOf(source)}
              </div>
            )}
          </div>
          {category && (
            <span className="pb-2 text-[10px] font-medium uppercase tracking-wide text-white/70">
              {humanizeCategory(category)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
