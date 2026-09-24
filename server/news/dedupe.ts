/**
 * Ingest-time duplicate detection. Pure.
 *
 * Catches the same story syndicated or re-headlined within a feed run and against recent
 * rows. Same-EVENT clustering (different stories about one event) is the scoring pipeline's
 * job, not this one.
 */
import type { NewArticle } from './normalize';

export const TITLE_SIMILARITY_THRESHOLD = 0.6;

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'it', 'its', 'this', 'that', 'these',
  'those', 'he', 'she', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
  'more', 'most', 'other', 'some', 'no', 'not', 'only', 'so', 'than', 'too', 'very', 'just', 'also',
  'now', 'new', 'says', 'said', 'over', 'after', 'before', 'about', 'into', 'amid', 'latest',
  'breaking', 'update', 'ireland', 'irish', 'government', 'minister',
]);

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    // Quotes and apostrophes carry no meaning here: "Tánaiste's" = "Tánaiste’s", “plan” = plan.
    .replace(/['‘’"“”]/g, '')
    .replace(/[^a-z0-9À-ɏ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w)));
}

function ngrams(title: string, n = 4): Set<string> {
  const t = normalizeTitle(title);
  const out = new Set<string>();
  for (let i = 0; i <= t.length - n; i++) out.add(t.slice(i, i + n));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  a.forEach((x) => {
    if (b.has(x)) shared++;
  });
  return shared / (a.size + b.size - shared);
}

/** 0–1. Word overlap dominates; character 4-grams catch small rewordings. */
export function titleSimilarity(a: string, b: string): number {
  return jaccard(words(a), words(b)) * 0.7 + jaccard(ngrams(a), ngrams(b)) * 0.3;
}

export interface Existing {
  url: string;
  title: string;
}

export interface DedupeResult {
  fresh: NewArticle[];
  duplicates: Array<{ article: NewArticle; reason: 'url' | 'title'; of: string }>;
}

/**
 * Keep the first occurrence of each story. Candidates are compared against `existing`
 * (recent rows from the database) and against the candidates already kept.
 */
export function dedupe(candidates: NewArticle[], existing: Existing[]): DedupeResult {
  const seenUrls = new Set(existing.map((e) => e.url));
  const kept: Existing[] = [...existing];
  const fresh: NewArticle[] = [];
  const duplicates: DedupeResult['duplicates'] = [];

  for (const article of candidates) {
    if (seenUrls.has(article.url)) {
      duplicates.push({ article, reason: 'url', of: article.url });
      continue;
    }
    const match = kept.find((k) => titleSimilarity(k.title, article.title) >= TITLE_SIMILARITY_THRESHOLD);
    if (match) {
      duplicates.push({ article, reason: 'title', of: match.url });
      continue;
    }
    seenUrls.add(article.url);
    kept.push({ url: article.url, title: article.title });
    fresh.push(article);
  }
  return { fresh, duplicates };
}
