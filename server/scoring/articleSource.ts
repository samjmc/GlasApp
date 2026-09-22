/**
 * The pipeline's view of the news domain. News ingestion has not been rebuilt yet and
 * still lives in `public.news_articles` behind the legacy service-role client; this
 * adapter is the only place the scoring module touches it. The news rebuild replaces
 * the implementation, not the interface.
 */
import { supabaseDb } from '../db';

export interface Article {
  id: number;
  title: string;
  content: string;
  source: string | null;
  url: string | null;
  publishedDate: Date | null;
  /** Source credibility 0–1; defaults to 0.8 when the row has none. */
  credibility: number;
}

export interface ArticleOutcome {
  importanceScore: number;
  importanceReasoning: string;
  /** True when at least one TD was scored from it. */
  scoreApplied: boolean;
  skippedReason?: string;
  errorMessage?: string;
  primaryTd?: { name: string; party: string | null; constituency: string | null };
}

export interface ArticleSource {
  fetchUnprocessed(limit: number): Promise<Article[]>;
  fetchById(id: number): Promise<Article | null>;
  /** Persist a fuller body fetched from the publisher. */
  saveContent(id: number, content: string): Promise<void>;
  markProcessed(id: number, outcome: ArticleOutcome): Promise<void>;
}

interface NewsArticleRow {
  id: number;
  title: string;
  content: string | null;
  source: string | null;
  url: string | null;
  published_date: string | null;
  credibility_score: number | string | null;
}

function toArticle(row: NewsArticleRow): Article {
  const credibility = Number(row.credibility_score);
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? '',
    source: row.source,
    url: row.url,
    publishedDate: row.published_date ? new Date(row.published_date) : null,
    credibility: Number.isFinite(credibility) && credibility > 0 ? credibility : 0.8,
  };
}

function client() {
  if (!supabaseDb) throw new Error('News articles are not reachable: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset');
  return supabaseDb;
}

const COLUMNS = 'id, title, content, source, url, published_date, credibility_score';

export const supabaseArticleSource: ArticleSource = {
  async fetchUnprocessed(limit) {
    const { data, error } = await client()
      .from('news_articles')
      .select(COLUMNS)
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as NewsArticleRow[]).map(toArticle);
  },

  async fetchById(id) {
    const { data, error } = await client().from('news_articles').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toArticle(data as NewsArticleRow) : null;
  },

  async saveContent(id, content) {
    const { error } = await client().from('news_articles').update({ content }).eq('id', id);
    if (error) throw error;
  },

  async markProcessed(id, outcome) {
    const update: Record<string, unknown> = {
      processed: true,
      score_applied: outcome.scoreApplied,
      importance_score: outcome.importanceScore,
      importance_reasoning: outcome.importanceReasoning,
      analyzed_by: outcome.scoreApplied ? 'multi-agent' : null,
    };
    if (outcome.skippedReason) update.skipped_reason = outcome.skippedReason;
    if (outcome.errorMessage) update.error_message = outcome.errorMessage;
    if (outcome.primaryTd) {
      update.politician_name = outcome.primaryTd.name;
      update.party = outcome.primaryTd.party;
      update.constituency = outcome.primaryTd.constituency;
    }
    const { error } = await client().from('news_articles').update(update).eq('id', id);
    if (error) throw error;
  },
};
