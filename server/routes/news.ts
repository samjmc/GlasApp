/**
 * /api/news-feed — the public news feed. Reads only; every response is `{ success, data }`.
 * Ingest and manual adds are admin routes in admin/news.ts.
 */
import { Router } from 'express';
import { DEFAULT_REGION_CODE } from '@shared/region-config';
import { asyncHandler } from '../middleware/errorHandler';
import { TODAY_FALLBACK_DAYS, hasMore, parseFeedQuery, startOfLocalDay } from '../news/feed';
import * as repo from '../news/repository';
import { formatSuccess } from '../utils/responseFormatters';
import { getQuestionsForArticles } from '../voting';

const router = Router();
const TD_FEED_LIMIT = 20;

type PolicyQuestion = Awaited<ReturnType<typeof getQuestionsForArticles>> extends Map<number, infer Q> ? Q : never;

/** The shape every news card in the client renders (client/src/lib/news.ts). */
export function feedArticle(row: repo.FeedRow, policyVote: PolicyQuestion | null) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    url: row.url,
    source: row.source,
    sourceLogoUrl: row.sourceLogoUrl,
    publishedAt: row.publishedAt.toISOString(),
    imageUrl: row.imageUrl,
    storyType: row.storyType,
    sentiment: row.sentiment,
    impactScore: row.impact,
    affectedTDs: row.affectedTds,
    policyVote,
  };
}

async function withQuestions(rows: repo.FeedRow[]) {
  const questions = await getQuestionsForArticles(rows.map((r) => r.id));
  return rows.map((r) => feedArticle(r, questions.get(r.id) ?? null));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseFeedQuery(req.query);
    // Only Irish news is ingested; other regions are preview pages with their own mock data.
    if ((req.regionCode ?? DEFAULT_REGION_CODE) !== 'IE') {
      return res.json(formatSuccess({ articles: [], total: 0, hasMore: false }));
    }
    const { rows, total } = await repo.feedPage(query, { since: startOfLocalDay(new Date()), fallbackDays: TODAY_FALLBACK_DAYS });
    res.json(formatSuccess({ articles: await withQuestions(rows), total, hasMore: hasMore(query, total) }));
  }),
);

router.get(
  '/td/:name',
  asyncHandler(async (req, res) => {
    const rows = await repo.feedForTd(req.params.name, TD_FEED_LIMIT);
    res.json(formatSuccess({ articles: await withQuestions(rows) }));
  }),
);

export default router;
