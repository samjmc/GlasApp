/**
 * Ingest-time duplicate detection, the cheap pass. Pure.
 *
 * Catches the same story syndicated or re-headlined within a feed run and against recent
 * rows. Same-EVENT matching (different stories about one event) is events.ts.
 */
import type { Link } from './events';
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
  /** The stored row's root canonical: its own id, or the id it is a duplicate of. */
  id: number;
  url: string;
  title: string;
}

export interface DedupeResult {
  /** Every candidate not stored yet, earliest published first (tie: URL). */
  fresh: NewArticle[];
  /** Title copies: `fresh[index]` is the same story as `of`. */
  links: Array<{ index: number; of: Link }>;
  /** Dropped: the URL is stored already, or repeated in this run. */
  knownUrls: number;
}

/**
 * Sort the candidates by publication time, drop URLs already seen, and link each title copy
 * to the first matching story: a recent stored row, or an earlier candidate of this run.
 */
export function dedupe(candidates: NewArticle[], existing: Existing[], storedUrls: Set<string>): DedupeResult {
  const seenUrls = new Set(Array.from(storedUrls).concat(existing.map((e) => e.url)));
  const targets: Array<{ title: string; of: Link }> = existing.map((e) => ({ title: e.title, of: { stored: e.id } }));
  const fresh: NewArticle[] = [];
  const links: DedupeResult['links'] = [];
  let knownUrls = 0;

  const ordered = [...candidates].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime() || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0),
  );
  for (const article of ordered) {
    if (seenUrls.has(article.url)) {
      knownUrls++;
      continue;
    }
    seenUrls.add(article.url);
    const index = fresh.length;
    const match = targets.find((t) => titleSimilarity(t.title, article.title) >= TITLE_SIMILARITY_THRESHOLD);
    if (match) links.push({ index, of: match.of });
    targets.push({ title: article.title, of: { run: index } });
    fresh.push(article);
  }
  return { fresh, links, knownUrls };
}
