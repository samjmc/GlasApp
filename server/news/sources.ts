/**
 * Every news source, in one place. Ingest upserts this list into `politics.news_sources`
 * before each run, so the table always matches the code.
 *
 * Every feed and logo URL here was fetched and returned 200 on 2026-09-24. The Irish
 * Examiner's feed is Atom. Mediahuis sites (Independent, Belfast Telegraph) answer 403 to
 * bots for their icons, so they show initials instead of a logo.
 */
export interface SourceConfig {
  slug: string;
  name: string;
  homepageUrl: string;
  /** NULL only for `manual`. */
  feedUrl: string | null;
  logoUrl: string | null;
}

export const MANUAL_SOURCE_SLUG = 'manual';

export const NEWS_SOURCES: readonly SourceConfig[] = [
  // Politics desks first: every item is on topic, so fewer are spent on the relevance floor.
  { slug: 'rte-politics', name: 'RTÉ News', homepageUrl: 'https://www.rte.ie', feedUrl: 'https://www.rte.ie/feeds/rss/?index=/news/politics/', logoUrl: 'https://www.rte.ie/apple-touch-icon.png' },
  { slug: 'irish-times-politics', name: 'The Irish Times', homepageUrl: 'https://www.irishtimes.com', feedUrl: 'https://www.irishtimes.com/arc/outboundfeeds/feed-politics/?outputType=xml', logoUrl: 'https://www.irishtimes.com/apple-touch-icon.png' },
  { slug: 'independent-politics', name: 'Irish Independent', homepageUrl: 'https://www.independent.ie', feedUrl: 'https://www.independent.ie/irish-news/politics/rss/', logoUrl: null },
  { slug: 'belfast-telegraph-politics', name: 'Belfast Telegraph', homepageUrl: 'https://www.belfasttelegraph.co.uk', feedUrl: 'https://www.belfasttelegraph.co.uk/news/politics/rss/', logoUrl: null },
  // General news desks: policy stories often run here first.
  { slug: 'rte', name: 'RTÉ News', homepageUrl: 'https://www.rte.ie', feedUrl: 'https://www.rte.ie/rss/news.xml', logoUrl: 'https://www.rte.ie/apple-touch-icon.png' },
  { slug: 'irish-times', name: 'The Irish Times', homepageUrl: 'https://www.irishtimes.com', feedUrl: 'https://www.irishtimes.com/cmlink/news-1.1319192', logoUrl: 'https://www.irishtimes.com/apple-touch-icon.png' },
  { slug: 'independent', name: 'Irish Independent', homepageUrl: 'https://www.independent.ie', feedUrl: 'https://www.independent.ie/irish-news/rss/', logoUrl: null },
  { slug: 'the-journal', name: 'The Journal', homepageUrl: 'https://www.thejournal.ie', feedUrl: 'https://www.thejournal.ie/feed/', logoUrl: 'https://b0.thejournal.ie/redesign/i/thejournal/apple-touch-icon.png' },
  { slug: 'irish-examiner', name: 'Irish Examiner', homepageUrl: 'https://www.irishexaminer.com', feedUrl: 'https://www.irishexaminer.com/feed/35-top-stories.xml', logoUrl: 'https://www.irishexaminer.com/favicon.ico' },
  { slug: 'newstalk', name: 'Newstalk', homepageUrl: 'https://www.newstalk.com', feedUrl: 'https://www.newstalk.com/feed', logoUrl: 'https://www.newstalk.com/i/apple-touch-icon.png?v=7' },
  { slug: 'the-currency', name: 'The Currency', homepageUrl: 'https://thecurrency.news', feedUrl: 'https://thecurrency.news/feed/', logoUrl: 'https://thecurrency.news/wp-content/themes/currency-theme/assets/img/favicon/apple-touch-icon.png' },
  // Independent and investigative outlets, for a spread of editorial lines.
  { slug: 'gript', name: 'Gript Media', homepageUrl: 'https://gript.ie', feedUrl: 'https://gript.ie/feed/', logoUrl: 'https://gript.ie/apple-touch-icon.png' },
  { slug: 'the-ditch', name: 'The Ditch', homepageUrl: 'https://www.ontheditch.com', feedUrl: 'https://www.ontheditch.com/rss/', logoUrl: 'https://storage.ghost.io/c/60/13/601376ae-90a0-4dd3-bd07-658ba046cb76/content/images/size/w256h256/format/jpeg/2022/06/Facebook-Profile-Alt.jpg' },
  { slug: 'village', name: 'Village Magazine', homepageUrl: 'https://villagemagazine.ie', feedUrl: 'https://villagemagazine.ie/feed/', logoUrl: 'https://villagemagazine.ie/wp-content/uploads/2015/12/cropped-profile-2-180x180.jpg' },
  { slug: MANUAL_SOURCE_SLUG, name: 'Added manually', homepageUrl: 'https://glaspolitics.ie', feedUrl: null, logoUrl: null },
];

/**
 * The configured source for this URL's host, or `manual`. Several feeds can share a host
 * (a politics desk and a general desk); the first listed wins, which is only a label.
 */
export function sourceForUrl(url: string): SourceConfig {
  const host = hostOf(url);
  return (
    NEWS_SOURCES.find((s) => s.feedUrl && host && hostOf(s.homepageUrl) === host) ??
    NEWS_SOURCES.find((s) => s.slug === MANUAL_SOURCE_SLUG)!
  );
}

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
