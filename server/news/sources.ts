/**
 * Every news source, in one place. Ingest upserts this list into `politics.news_sources`
 * before each run, so the table always matches the code.
 *
 * All seven publishers have a feed (checked 2026-09-22). The Irish Examiner's is Atom.
 */
export interface SourceConfig {
  slug: string;
  name: string;
  homepageUrl: string;
  /** NULL only for `manual`. */
  feedUrl: string | null;
  logoUrl: string | null;
  /** 0–1, feeds the ELO update weight in scoring. */
  credibility: number;
}

export const MANUAL_SOURCE_SLUG = 'manual';

export const NEWS_SOURCES: readonly SourceConfig[] = [
  { slug: 'irish-times', name: 'The Irish Times', homepageUrl: 'https://www.irishtimes.com', feedUrl: 'https://www.irishtimes.com/cmlink/news-1.1319192', logoUrl: null, credibility: 0.95 },
  { slug: 'rte', name: 'RTÉ News', homepageUrl: 'https://www.rte.ie', feedUrl: 'https://www.rte.ie/rss/news.xml', logoUrl: null, credibility: 0.95 },
  { slug: 'independent', name: 'Irish Independent', homepageUrl: 'https://www.independent.ie', feedUrl: 'https://www.independent.ie/irish-news/rss/', logoUrl: null, credibility: 0.85 },
  { slug: 'the-journal', name: 'The Journal', homepageUrl: 'https://www.thejournal.ie', feedUrl: 'https://www.thejournal.ie/feed/', logoUrl: null, credibility: 0.9 },
  { slug: 'irish-examiner', name: 'Irish Examiner', homepageUrl: 'https://www.irishexaminer.com', feedUrl: 'https://www.irishexaminer.com/feed/35-top-stories.xml', logoUrl: null, credibility: 0.85 },
  { slug: 'gript', name: 'Gript Media', homepageUrl: 'https://gript.ie', feedUrl: 'https://gript.ie/feed/', logoUrl: null, credibility: 0.75 },
  { slug: 'the-ditch', name: 'The Ditch', homepageUrl: 'https://www.ontheditch.com', feedUrl: 'https://www.ontheditch.com/rss/', logoUrl: null, credibility: 0.78 },
  { slug: MANUAL_SOURCE_SLUG, name: 'Added manually', homepageUrl: 'https://glaspolitics.ie', feedUrl: null, logoUrl: null, credibility: 0.7 },
];

/** The configured source whose homepage host matches the URL's host, or `manual`. */
export function sourceForUrl(url: string): SourceConfig {
  const host = hostOf(url);
  return (
    NEWS_SOURCES.find((s) => s.feedUrl && host && hostOf(s.homepageUrl) === host) ??
    NEWS_SOURCES.find((s) => s.slug === MANUAL_SOURCE_SLUG)!
  );
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
