/**
 * /api/parliament — Dáil divisions, debates and each TD's parliament record.
 * Reads are public; the sync trigger needs the job secret. Every response is
 * `{ success, data, meta? }` via formatSuccess; the data types are shared/parliamentApi.ts.
 */
import { Router } from 'express';
import { z } from 'zod';
import { LEADERBOARD_METRICS } from '@shared/parliamentApi';
import { requireJob } from '../auth';
import { asyncHandler } from '../middleware/errorHandler';
import { isSyncRunning, repository as repo, runSync } from '../parliament';
import { formatError, formatSuccess } from '../utils/responseFormatters';

const router = Router();

const idParam = z.coerce.number().int().positive();
/** Our own ids: `dail-34-2025-06-25-vote_91`, `dail-2025-06-25-dbsect_19`. */
const recordId = z.string().regex(/^dail-[a-z0-9_-]{1,70}$/);
const page = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

function badRequest(res: import('express').Response, message: string) {
  return res.status(400).json(formatError('VALIDATION_ERROR', message));
}

router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess({ feeds: await repo.syncStatus() }));
  }),
);

router.get(
  '/tds/:id',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'TD id must be a positive integer');
    const summary = await repo.tdSummary(id.data);
    if (!summary) return res.status(404).json(formatError('ENTITY_NOT_FOUND', `TD ${id.data} not found`));
    res.json(formatSuccess(summary));
  }),
);

router.get(
  '/tds/:id/votes',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(500).default(20), againstParty: z.enum(['true', 'false']).optional() })
      .safeParse(req.query);
    if (!id.success || !q.success) return badRequest(res, 'Invalid TD id or query');
    res.json(formatSuccess(await repo.votesOf(id.data, { limit: q.data.limit, againstParty: q.data.againstParty === 'true' })));
  }),
);

router.get(
  '/tds/:id/debates',
  asyncHandler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(10) }).safeParse(req.query);
    if (!id.success || !q.success) return badRequest(res, 'Invalid TD id or query');
    res.json(formatSuccess(await repo.tdDebates(id.data, q.data.limit)));
  }),
);

router.get(
  '/divisions',
  asyncHandler(async (req, res) => {
    const q = page.safeParse(req.query);
    if (!q.success) return badRequest(res, 'Invalid paging');
    const { rows, total } = await repo.listDivisions(q.data.limit, q.data.offset);
    res.json(formatSuccess(rows, { total }));
  }),
);

router.get(
  '/divisions/:id',
  asyncHandler(async (req, res) => {
    const id = recordId.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'Invalid division id');
    const detail = await repo.divisionDetail(id.data);
    if (!detail) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Division not found'));
    res.json(formatSuccess(detail));
  }),
);

router.get(
  '/debates',
  asyncHandler(async (req, res) => {
    const q = page.safeParse(req.query);
    if (!q.success) return badRequest(res, 'Invalid paging');
    const { rows, total } = await repo.listDebates(q.data.limit, q.data.offset);
    res.json(formatSuccess(rows, { total }));
  }),
);

router.get(
  '/debates/:id',
  asyncHandler(async (req, res) => {
    const id = recordId.safeParse(req.params.id);
    if (!id.success) return badRequest(res, 'Invalid debate id');
    const detail = await repo.debateDetail(id.data);
    if (!detail) return res.status(404).json(formatError('ENTITY_NOT_FOUND', 'Debate not found'));
    res.json(formatSuccess(detail));
  }),
);

router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        metric: z.enum(LEADERBOARD_METRICS).default('attendance'),
        order: z.enum(['asc', 'desc']).default('desc'),
        limit: z.coerce.number().int().min(1).max(200).default(20),
      })
      .safeParse(req.query);
    if (!q.success) return badRequest(res, `metric must be one of ${LEADERBOARD_METRICS.join(', ')}`);
    res.json(formatSuccess(await repo.leaderboard(q.data.metric, q.data.order, q.data.limit)));
  }),
);

router.get(
  '/parties',
  asyncHandler(async (_req, res) => {
    res.json(formatSuccess(await repo.parties()));
  }),
);

/** POST /api/parliament/sync — start a sync in the background; 409 while one is running. */
router.post('/sync', requireJob, (_req, res) => {
  if (isSyncRunning()) return res.status(409).json(formatError('CONFLICT', 'A parliament sync is already running'));
  runSync().catch((error) => console.error('Parliament sync failed:', error instanceof Error ? error.message : error));
  res.status(202).json(formatSuccess({ started: true }));
});

export default router;
